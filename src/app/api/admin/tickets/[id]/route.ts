import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

const ALLOWED_STATUS = new Set(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]);
const ALLOWED_PRIORITY = new Set(["LOW", "NORMAL", "HIGH"]);

function safeParseMeta(meta: string | null) {
  if (!meta) return {};
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}

function safeArray(input: any): any[] {
  return Array.isArray(input) ? input : [];
}

function parseThreadFromAdminNotes(adminNotes: string | null) {
  if (!adminNotes) return { notes: null as string | null, replies: [] as any[] };
  try {
    const parsed = JSON.parse(adminNotes);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.replies)) {
      return {
        notes: typeof parsed.notes === "string" ? parsed.notes : null,
        replies: safeArray(parsed.replies),
      };
    }
  } catch {}
  return { notes: adminNotes, replies: [] as any[] };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const status = typeof body.status === "string" ? body.status : undefined;
    const priority = typeof body.priority === "string" ? body.priority : undefined;
    const adminNotes = typeof body.adminNotes === "string" ? body.adminNotes.trim() : undefined;
    const replyMessage = typeof body.replyMessage === "string" ? body.replyMessage.trim() : "";

    if (status && !ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    if (priority && !ALLOWED_PRIORITY.has(priority)) {
      return NextResponse.json({ success: false, error: "Invalid priority" }, { status: 400 });
    }

    // Fallback records are stored in admin notifications (id starts with fallback-).
    if (params.id.startsWith("fallback-")) {
      const notificationId = params.id.replace("fallback-", "");
      const notification = await prisma.adminNotification.findUnique({ where: { id: notificationId } });
      if (!notification) {
        return NextResponse.json({ success: false, error: "Fallback ticket not found" }, { status: 404 });
      }

      const currentMeta: any = safeParseMeta(notification.meta);
      const currentReplies = safeArray(currentMeta.replies);
      const nextReplies = replyMessage
        ? [
            ...currentReplies,
            {
              id: `r-${Date.now()}`,
              sender: "ADMIN",
              author: (session.user as any).name || (session.user as any).email || "Admin",
              message: replyMessage,
              createdAt: new Date().toISOString(),
            },
          ]
        : currentReplies;
      const updatedMeta = {
        ...currentMeta,
        status: status || currentMeta.status || "OPEN",
        priority: priority || currentMeta.priority || "NORMAL",
        adminNotes: adminNotes !== undefined ? adminNotes : (currentMeta.adminNotes || null),
        replies: nextReplies,
        lastAdminUpdateAt: new Date().toISOString(),
        fallback: true,
      };

      const updatedNotification = await prisma.adminNotification.update({
        where: { id: notificationId },
        data: {
          meta: JSON.stringify(updatedMeta),
          message: currentMeta.subject
            ? `${currentMeta.subject} from ${currentMeta.email || currentMeta.discordUsername || "unknown contact"}`
            : notification.message,
        },
      });

      await createAuditLog({
        userId: (session.user as any).id,
        action: "UPDATE",
        entity: "SupportTicket",
        entityId: params.id,
        before: {
          status: currentMeta.status || "OPEN",
          priority: currentMeta.priority || "NORMAL",
          adminNotes: currentMeta.adminNotes || null,
        },
        after: {
          status: updatedMeta.status,
          priority: updatedMeta.priority,
          adminNotes: updatedMeta.adminNotes,
        },
        ip: getClientIp(req),
        userAgent: req.headers.get("user-agent") || undefined,
      });

      return NextResponse.json({
        success: true,
        data: {
          id: params.id,
          isFallback: true,
          ticketNumber: updatedMeta.ticketNumber || 0,
          subject: updatedMeta.subject || updatedNotification.title,
          message: updatedMeta.message || updatedNotification.message,
          status: updatedMeta.status,
          priority: updatedMeta.priority,
          adminNotes: updatedMeta.adminNotes,
          replies: nextReplies,
          conversation: [
            {
              id: `${params.id}-customer`,
              sender: "CUSTOMER",
              author: updatedMeta.email || updatedMeta.discordUsername || "Customer",
              message: updatedMeta.message || updatedNotification.message,
              createdAt: updatedNotification.createdAt,
            },
            ...nextReplies,
          ],
          contactType: updatedMeta.contactType || "DISCORD",
          email: updatedMeta.email || null,
          discordUsername: updatedMeta.discordUsername || null,
          createdAt: updatedNotification.createdAt,
          updatedAt: new Date(),
        },
      });
    }

    const existing = await prisma.supportTicket.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    const parsedThread = parseThreadFromAdminNotes(existing.adminNotes);
    const nextReplies = replyMessage
      ? [
          ...parsedThread.replies,
          {
            id: `r-${Date.now()}`,
            sender: "ADMIN",
            author: (session.user as any).name || (session.user as any).email || "Admin",
            message: replyMessage,
            createdAt: new Date().toISOString(),
          },
        ]
      : parsedThread.replies;
    const nextNotes = adminNotes !== undefined ? (adminNotes || null) : parsedThread.notes;

    const updated = await prisma.supportTicket.update({
      where: { id: params.id },
      data: {
        ...(status ? { status, resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null } : {}),
        ...(priority ? { priority } : {}),
        adminNotes: JSON.stringify({
          notes: nextNotes,
          replies: nextReplies,
        }),
      },
    });

    await createAuditLog({
      userId: (session.user as any).id,
      action: status && status !== existing.status ? "TICKET_STATUS_CHANGE" : "UPDATE",
      entity: "SupportTicket",
      entityId: existing.id,
      before: {
        status: existing.status,
        priority: existing.priority,
        adminNotes: parsedThread.notes,
      },
      after: {
        status: updated.status,
        priority: updated.priority,
        adminNotes: nextNotes,
        replyAdded: !!replyMessage,
      },
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        adminNotes: nextNotes,
        replies: nextReplies,
        conversation: [
          {
            id: `${updated.id}-customer`,
            sender: "CUSTOMER",
            author: updated.email || updated.discordUsername || "Customer",
            message: updated.message,
            createdAt: updated.createdAt,
          },
          ...nextReplies,
        ],
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
