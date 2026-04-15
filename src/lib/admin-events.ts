import prisma from "@/lib/prisma";
import { createAuditLog, type AuditAction, type AuditEntity } from "@/lib/audit";

type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
type AlertType = "SECURITY" | "WEBHOOK" | "TRAFFIC" | "STATUS" | "SYSTEM";

interface AdminAlertInput {
  userId?: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  meta?: Record<string, any> | null;
}

interface TrackAdminEventInput {
  userId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  ip?: string;
  userAgent?: string;
  alert?: AdminAlertInput;
}

function toJsonMeta(meta?: Record<string, any> | null) {
  if (!meta || typeof meta !== "object") return null;
  try {
    return JSON.stringify(meta);
  } catch {
    return null;
  }
}

export async function createAdminAlert(input: AdminAlertInput) {
  try {
    await prisma.adminNotification.create({
      data: {
        userId: input.userId ?? null,
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        meta: toJsonMeta(input.meta),
      },
    });
  } catch (error) {
    console.error("Failed to create admin alert:", error);
  }
}

export async function trackAdminEvent(input: TrackAdminEventInput) {
  await createAuditLog({
    userId: input.userId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  if (input.alert) {
    await createAdminAlert(input.alert);
  }
}
