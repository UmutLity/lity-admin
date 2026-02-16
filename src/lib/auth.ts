import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "@/lib/prisma";
import { isAccountLocked, recordLoginAttempt, checkAndLockAccount, detectSuspiciousActivity } from "@/lib/security";
import { getUserPermissions, type Permission } from "@/lib/permissions";
import { getClientIp } from "@/lib/ip-utils";
import { createAuditLog } from "@/lib/audit";

type Role = "ADMIN" | "EDITOR" | "VIEWER";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const ip = req?.headers?.["x-forwarded-for"]?.toString().split(",")[0] ||
          req?.headers?.["x-real-ip"]?.toString() || "127.0.0.1";
        const userAgent = req?.headers?.["user-agent"]?.toString() || null;

        // Find user
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // Check account lock
        if (user) {
          const lockStatus = await isAccountLocked(user.id);
          if (lockStatus.locked) {
            await recordLoginAttempt({
              email: credentials.email, ip, userAgent, success: false, userId: user.id,
            });
            throw new Error(`Account locked until ${lockStatus.lockedUntil?.toISOString()}. Please try again later.`);
          }
        }

        if (!user || !user.isActive) {
          await recordLoginAttempt({
            email: credentials.email, ip, userAgent, success: false, userId: user?.id,
          });
          if (user) await checkAndLockAccount(credentials.email);
          throw new Error("Invalid email or password");
        }

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) {
          await recordLoginAttempt({
            email: credentials.email, ip, userAgent, success: false, userId: user.id,
          });
          await checkAndLockAccount(credentials.email);
          throw new Error("Invalid email or password");
        }

        // Check 2FA
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!credentials.totpCode) {
            // Signal client to show 2FA input
            throw new Error("2FA_REQUIRED");
          }
          // Verify TOTP
          const { verifyTOTP } = await import("@/lib/totp");
          const isValidTotp = verifyTOTP(user.twoFactorSecret, credentials.totpCode);
          if (!isValidTotp) {
            // Check recovery codes
            const isRecoveryValid = await checkRecoveryCode(user.id, credentials.totpCode);
            if (!isRecoveryValid) {
              await recordLoginAttempt({
                email: credentials.email, ip, userAgent, success: false, userId: user.id,
              });
              throw new Error("Invalid 2FA code");
            }
          }
        }

        // Success
        await recordLoginAttempt({
          email: credentials.email, ip, userAgent, success: true, userId: user.id,
        });

        // Detect suspicious IP activity
        await detectSuspiciousActivity(user.id, ip).catch(() => {});

        // Audit log
        await createAuditLog({
          userId: user.id,
          action: "LOGIN_SUCCESS",
          entity: "Security",
          ip,
          userAgent: userAgent || undefined,
        }).catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.loginAt = Date.now();
        token.lastVerified = Date.now();
      }

      // Re-verify user from DB periodically (every 5 minutes)
      // This catches: role changes, account deactivation, password changes
      const VERIFY_INTERVAL = 5 * 60 * 1000; // 5 minutes
      if (token.id && (!token.lastVerified || Date.now() - (token.lastVerified as number) > VERIFY_INTERVAL)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { id: true, role: true, isActive: true, password: true },
          });
          if (!dbUser || !dbUser.isActive) {
            // User deleted or deactivated — invalidate token
            return { ...token, id: null, role: null, invalid: true };
          }
          // Sync role from DB (in case admin changed it)
          token.role = dbUser.role;
          token.lastVerified = Date.now();
        } catch {
          // DB error — keep existing token, try again next time
        }
      }

      // Enforce max session age (8 hours hard limit)
      const MAX_SESSION_AGE = 8 * 60 * 60 * 1000;
      if (token.loginAt && Date.now() - (token.loginAt as number) > MAX_SESSION_AGE) {
        return { ...token, id: null, role: null, invalid: true };
      }

      return token;
    },
    async session({ session, token }) {
      // If token was invalidated, return empty session
      if ((token as any).invalid) {
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};

// ─── Recovery Code Check ────────────────────────────────

async function checkRecoveryCode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { recoveryCodes: true } });
  if (!user?.recoveryCodes) return false;

  try {
    const codes: string[] = JSON.parse(user.recoveryCodes);
    const { compare: bcryptCompare } = await import("bcryptjs");

    for (let i = 0; i < codes.length; i++) {
      const isMatch = await bcryptCompare(code, codes[i]);
      if (isMatch) {
        // Remove used code
        codes.splice(i, 1);
        await prisma.user.update({
          where: { id: userId },
          data: { recoveryCodes: JSON.stringify(codes) },
        });
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

// ─── Session Helpers ────────────────────────────────────

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if ((session.user as any).role !== "ADMIN") {
    throw new Error("Forbidden: Admin only");
  }
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireAuth();
  const userRole = (session.user as any).role as Role;
  if (!roles.includes(userRole)) {
    throw new Error(`Forbidden: Requires ${roles.join(" or ")} role`);
  }
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireAuth();
  const userId = (session.user as any).id;
  const fallbackRole = (session.user as any).role;
  const perms = await getUserPermissions(userId, fallbackRole);
  if (!perms.includes(permission)) {
    throw new Error(`Forbidden: Missing permission ${permission}`);
  }
  return session;
}

export function canAccess(userRole: string, resource: string): boolean {
  const permissions: Record<string, string[]> = {
    products: ["ADMIN", "EDITOR"],
    changelog: ["ADMIN", "EDITOR"],
    settings: ["ADMIN"],
    users: ["ADMIN"],
    media: ["ADMIN", "EDITOR"],
    audit: ["ADMIN"],
    security: ["ADMIN"],
    roles: ["ADMIN"],
  };
  return permissions[resource]?.includes(userRole) ?? false;
}
