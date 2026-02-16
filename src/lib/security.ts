import prisma from "@/lib/prisma";

// ─── Configuration ──────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// ─── Account Lock Check ─────────────────────────────────

export async function isAccountLocked(userId: string): Promise<{ locked: boolean; lockedUntil?: Date }> {
  const lock = await prisma.accountLock.findFirst({
    where: {
      userId,
      lockedUntil: { gt: new Date() },
    },
    orderBy: { lockedUntil: "desc" },
  });

  return lock ? { locked: true, lockedUntil: lock.lockedUntil } : { locked: false };
}

// ─── Check If Should Lock (after failed attempt) ────────

export async function checkAndLockAccount(email: string): Promise<boolean> {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000);

  const recentFailures = await prisma.loginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: { gte: since },
    },
  });

  if (recentFailures >= MAX_LOGIN_ATTEMPTS) {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return false;

    // Check if already locked
    const existingLock = await prisma.accountLock.findFirst({
      where: {
        userId: user.id,
        lockedUntil: { gt: new Date() },
      },
    });

    if (!existingLock) {
      await prisma.accountLock.create({
        data: {
          userId: user.id,
          lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
          reason: `${recentFailures} failed login attempts within ${LOCKOUT_MINUTES} minutes`,
        },
      });

      // Create security alert
      await prisma.securityAlert.create({
        data: {
          type: "BRUTE_FORCE",
          severity: "HIGH",
          message: `Account locked: ${email} (${recentFailures} failed attempts)`,
          userId: user.id,
          meta: JSON.stringify({ email, failedAttempts: recentFailures }),
        },
      });

      return true;
    }
  }

  return false;
}

// ─── Record Login Attempt ───────────────────────────────

export async function recordLoginAttempt(data: {
  email: string;
  ip: string;
  userAgent: string | null;
  success: boolean;
  userId?: string;
}) {
  await prisma.loginAttempt.create({
    data: {
      email: data.email,
      ip: data.ip,
      userAgent: data.userAgent,
      success: data.success,
      userId: data.userId,
    },
  });
}

// ─── Detect Suspicious IP Changes ───────────────────────

export async function detectSuspiciousActivity(userId: string, currentIp: string) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentIps = await prisma.loginAttempt.findMany({
    where: {
      userId,
      success: true,
      createdAt: { gte: oneHourAgo },
    },
    select: { ip: true },
    distinct: ["ip"],
  });

  const uniqueIps = new Set(recentIps.map((r) => r.ip));
  uniqueIps.add(currentIp);

  if (uniqueIps.size >= 3) {
    // Check if already alerted recently
    const existingAlert = await prisma.securityAlert.findFirst({
      where: {
        type: "IP_CHANGE",
        userId,
        createdAt: { gte: oneHourAgo },
        resolvedAt: null,
      },
    });

    if (!existingAlert) {
      await prisma.securityAlert.create({
        data: {
          type: "IP_CHANGE",
          severity: "MEDIUM",
          message: `Multiple IP addresses detected for user in 1 hour: ${Array.from(uniqueIps).join(", ")}`,
          userId,
          meta: JSON.stringify({ ips: Array.from(uniqueIps) }),
        },
      });
    }
  }
}

// ─── Detect Rapid Status Changes ────────────────────────

export async function detectRapidStatusChanges() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const recentStatusChanges = await prisma.auditLog.count({
    where: {
      action: "STATUS_CHANGE",
      entity: "Product",
      createdAt: { gte: tenMinutesAgo },
    },
  });

  if (recentStatusChanges > 10) {
    const existingAlert = await prisma.securityAlert.findFirst({
      where: {
        type: "RAPID_STATUS_CHANGE",
        createdAt: { gte: tenMinutesAgo },
        resolvedAt: null,
      },
    });

    if (!existingAlert) {
      await prisma.securityAlert.create({
        data: {
          type: "RAPID_STATUS_CHANGE",
          severity: "MEDIUM",
          message: `${recentStatusChanges} product status changes in the last 10 minutes`,
          meta: JSON.stringify({ count: recentStatusChanges }),
        },
      });
    }
  }
}

// ─── Unlock Account ─────────────────────────────────────

export async function unlockAccount(lockId: string) {
  await prisma.accountLock.update({
    where: { id: lockId },
    data: { lockedUntil: new Date() }, // Set to now (expired)
  });
}

// ─── IP Whitelist Check ─────────────────────────────────

export async function isWhitelistEnabled(): Promise<boolean> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "whitelist_enabled" } });
  return setting?.value === "true";
}

export async function getGlobalAllowedCidrs(): Promise<string[]> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "global_allowed_cidrs" } });
  if (!setting || !setting.value) return [];
  try {
    return JSON.parse(setting.value);
  } catch {
    return setting.value.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

// ─── Emergency Toggles ──────────────────────────────────

export async function getEmergencyToggles() {
  const keys = ["maintenance_mode", "disable_purchases", "public_api_pause"];
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: keys } },
  });

  const result: Record<string, boolean> = {
    maintenance_mode: false,
    disable_purchases: false,
    public_api_pause: false,
  };

  for (const s of settings) {
    result[s.key] = s.value === "true";
  }

  return result;
}
