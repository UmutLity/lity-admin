import prisma from "@/lib/prisma";

// ─── Action Types ───────────────────────────────────────

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "PUBLISH"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAIL"
  | "LOCK"
  | "UNLOCK"
  | "2FA_ENABLE"
  | "2FA_DISABLE"
  | "WEBHOOK_TEST"
  | "WEBHOOK_SEND"
  | "STATUS_CHANGE"
  | "SETTINGS_UPDATE"
  | "MEDIA_UPLOAD"
  | "MEDIA_DELETE"
  | "ROLE_CHANGE"
  | "PASSWORD_RESET";

export type AuditEntity =
  | "Product"
  | "Changelog"
  | "SiteSetting"
  | "User"
  | "Media"
  | "Role"
  | "Security"
  | "Webhook"
  | "Category"
  | "Customer"
  | "ProductEnvironment"
  | "AdminSession";

// ─── Enhanced Audit Log Input ───────────────────────────

interface AuditLogInput {
  userId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  ip?: string;
  userAgent?: string;
}

// ─── Create Audit Log ───────────────────────────────────

export async function createAuditLog(input: AuditLogInput) {
  try {
    const diff = input.before && input.after ? computeDiffSummary(input.before, input.after) : null;

    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        before: input.before ? JSON.stringify(input.before) : null,
        after: input.after ? JSON.stringify(input.after) : null,
        diff: diff,
        ip: input.ip || null,
        userAgent: input.userAgent || null,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

// ─── Diff Computation ───────────────────────────────────

export function diffObjects(
  before: Record<string, any>,
  after: Record<string, any>
): { before: Record<string, any>; after: Record<string, any> } {
  const diff = { before: {} as Record<string, any>, after: {} as Record<string, any> };

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff.before[key] = before[key];
      diff.after[key] = after[key];
    }
  }

  return diff;
}

export function computeDiffSummary(
  before: Record<string, any>,
  after: Record<string, any>
): string {
  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const bVal = before[key];
    const aVal = after[key];
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      if (bVal === undefined || bVal === null) {
        changes.push(`+ ${key}: ${truncVal(aVal)}`);
      } else if (aVal === undefined || aVal === null) {
        changes.push(`- ${key}: ${truncVal(bVal)}`);
      } else {
        changes.push(`~ ${key}: ${truncVal(bVal)} → ${truncVal(aVal)}`);
      }
    }
  }

  return changes.join("\n");
}

function truncVal(val: any): string {
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  return str.length > 80 ? str.slice(0, 77) + "..." : str;
}
