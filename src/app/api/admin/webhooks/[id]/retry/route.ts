import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { sendChangelogToDiscord } from "@/lib/discord";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["FOUNDER", "ADMIN", "EDITOR", "SUPPORT"]);

    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: params.id },
      select: { id: true, event: true, entityId: true, provider: true, success: true },
    });
    if (!delivery) return NextResponse.json({ success: false, error: "Webhook delivery not found" }, { status: 404 });

    if (delivery.event !== "CHANGELOG_PUBLISHED") {
      return NextResponse.json(
        { success: false, error: "Retry is currently supported for changelog deliveries only." },
        { status: 400 }
      );
    }

    const result = await sendChangelogToDiscord(delivery.entityId, { force: true });
    if (!result) {
      return NextResponse.json({ success: false, error: "Discord webhook is not configured." }, { status: 400 });
    }

    await createAuditLog({
      userId: (session.user as any).id,
      action: "WEBHOOK_SEND",
      entity: "Webhook",
      entityId: delivery.id,
      before: { success: delivery.success, event: delivery.event, provider: delivery.provider },
      after: { success: result.success, responseCode: result.responseCode, attempts: result.attempts },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1",
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.success ? "Webhook redelivered successfully." : "Webhook retry failed.",
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("POST /api/admin/webhooks/[id]/retry error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
