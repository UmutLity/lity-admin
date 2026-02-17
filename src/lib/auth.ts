import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "@/lib/prisma";
import {
  isAccountLocked,
  recordLoginAttempt,
  checkAndLockAccount,
  detectSuspiciousActivity,
} from "@/lib/security";
import { getUserPermissions, type Permission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

const VERIFY_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_SESSION_AGE = 8 * 60 * 60 * 1000; // 8 hours hard limit

type Role = "ADMIN" | "EDITOR" | "VIEWER";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours (soft)
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

        const ip =
          req?.headers?.["x-forwarded-for"]?.toString().split(",")[0] ||
          req?.headers?.["x-real-ip"]?.toString() ||
          "127.0.0.1";

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
              email: credentials.email,
              ip,
              userAgent,
              success: false,
              userId: user.id,
            });

            throw new Error(
              `Account locked until ${lockStatus.lockedUntil?.toISOString()}. Please try again later.`
            );
          }
        }

        // Basic validation
        if (!user || !user.isActive) {
          await recordLoginAttempt({
            email: credentials.email,
            ip,
            userAgent,
            success: false,
            userId: user?.id,
          });

          if (user) await checkAndLockAccount(credentials.email);
          throw new Error("Invalid email or password");
        }

        // Password check
        const isValid = await compare(credentials.password, user.password);
        if (!isValid) {
          await recordLoginAttempt({
            email: credentials.email,
            ip,
            userAgent,
            success: false,
            userId: user.id,
          });

          await checkAndLockAccount(credentials.email);
          throw new Error("Invalid email or password");
        }

        // 2FA check
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!credentials.totpCode) {
            throw new Error("2FA_REQUIRED");
          }

          const { verifyTOTP } = await import("@/lib/totp");
          const isValidTotp = verifyTOTP(user.twoFactorSecret, credentials.totpCode);

          if (!isValidTotp) {
            const isRecoveryValid = await checkRecoveryCode(user.id, credentials.totpCode);
            if (!isRecoveryValid) {
              await recordLoginAttempt({
                email: credentials.email,
                ip,
                userAgent,
                success: false,
                userId: user.id,
              });

              throw new Error("Invalid 2FA code");
            }
          }
        }

        // Success
        await recordLoginAttempt({
          email: credentials.email,
          ip,
          userAgent,
          success: true,
          userId: user.id,
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
          role: user.role as Role,
          image: user.avatar,
        };
      },
    }),
  ],

  callbacks: {
  async jwt({ token, user }) {
    if (user) {
      (token as any).id = (user as any).id as string;
      (token as any).role = (user as any).role as Role;
      (token as any).invalid = false;
      (token as any).loginAt = Date.now();
      (token as any).lastVerified = Date.now();
    }

    if (
      (token as any).id &&
      (!(token as any).lastVerified ||
        Date.now() - (token as any).lastVerified > VERIFY_INTERVAL)
    ) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: (token as any).id as string },
          select: { role: true, isActive: true },
        });

        if (!dbUser || !dbUser.isActive) {
          (token as any).invalid = true;
          return token;
        }

        (token as any).role = dbUser.role as any;
        (token as any).lastVerified = Date.now();
      } catch {}
    }

    if ((token as any).loginAt && Date.now() - (token as any).loginAt > MAX_SESSION_AGE) {
      (token as any).invalid = true;
    }

    return token;
  },

  async session({ session, token }) {
    if ((token as any).invalid) {
      return { ...session, user: undefined, expires: new Date(0).toISOString() };
    }

    if (session.user) {
      (session.user as any).id = (token as any).id as string;
      (session.user as any).role = (token as any).role as Role;
      (session.user as any).invalid = (token as any).invalid ?? false;
    }

    return session;
  },
},
};

// ─── Recovery Code Check ────────────────────────────────

async function checkRecoveryCode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { recoveryCodes: true },
  });
  if (!user?.recoveryCodes) return false;

  try {
    const codes: string[] = JSON.parse(user.recoveryCodes);
    const { compare: bcryptCompare } = await import("bcryptjs");

    for (let i = 0; i < codes.length; i++) {
      const isMatch = await bcryptCompare(code, codes[i]);
      if (isMatch) {
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
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if ((session.user as any).role !== "ADMIN") throw new Error("Forbidden: Admin only");
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireAuth();
  const userRole = (session.user as any).role as Role;
  if (!roles.includes(userRole)) throw new Error(`Forbidden: Requires ${roles.join(" or ")} role`);
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireAuth();
  const userId = (session.user as any).id as string;
  const fallbackRole = (session.user as any).role as Role;
  const perms = await getUserPermissions(userId, fallbackRole);
  if (!perms.includes(permission)) throw new Error(`Forbidden: Missing permission ${permission}`);
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
