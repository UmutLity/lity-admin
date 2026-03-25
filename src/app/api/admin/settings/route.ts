import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

// GET /api/admin/settings
export async function GET() {
  try {
    await requireAdmin();

    const defaults = [
      { key: "reviews_webhook_enabled", value: "false", type: "boolean", group: "discord", label: "Reviews Webhook Enabled" },
      { key: "reviews_webhook_url", value: "", type: "string", group: "discord", label: "Reviews Webhook URL" },
      { key: "reviews_webhook_secret", value: "", type: "string", group: "discord", label: "Reviews Webhook Secret" },
      { key: "reviews_webhook_source", value: "DISCORD_BRIDGE", type: "string", group: "discord", label: "Reviews Webhook Source" },
    ];

    for (const item of defaults) {
      await prisma.siteSetting.upsert({
        where: { key: item.key },
        update: {},
        create: item,
      });
    }

    const settings = await prisma.siteSetting.findMany({ orderBy: { group: "asc" } });
    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/settings
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const ip = getClientIp(req);

    if (!body.settings || !Array.isArray(body.settings)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const incoming = new Map<string, string>(
      body.settings.map((item: { key: string; value: string }) => [item.key, String(item.value ?? "")])
    );
    const updateWebhookUrl = (incoming.get("discord_webhook_url") || "").trim();
    const reviewsWebhookUrl = (incoming.get("reviews_webhook_url") || "").trim();
    if (updateWebhookUrl && reviewsWebhookUrl && updateWebhookUrl === reviewsWebhookUrl) {
      return NextResponse.json(
        { error: "Update webhook and review webhook must be different URLs" },
        { status: 400 }
      );
    }

    const before: Record<string, string> = {};
    const after: Record<string, string> = {};

    for (const { key, value } of body.settings) {
      const existing = await prisma.siteSetting.findUnique({ where: { key } });
      if (existing) {
        before[key] = existing.value;
        after[key] = value;
        await prisma.siteSetting.update({ where: { key }, data: { value } });
      } else {
        // Create new setting if it doesn't exist
        after[key] = value;
        await prisma.siteSetting.create({
          data: { key, value, type: "string", group: "custom", label: key },
        });
      }
    }

    await createAuditLog({
      userId: (session.user as any).id,
      action: "SETTINGS_UPDATE",
      entity: "SiteSetting",
      before,
      after,
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("PUT /api/admin/settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
