import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { sendDiscordWebhook, buildWebhookPayload } from "@/lib/discord";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

// POST /api/admin/discord/test - Send test webhook
export async function POST(req: NextRequest) {
  try {
    // Use requireRole instead of permission check to avoid stale session issues
    const session = await requireRole(["ADMIN", "EDITOR"]);
    const userId = (session.user as any).id;

    const webhookUrlSetting = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_url" } });
    if (!webhookUrlSetting || !webhookUrlSetting.value) {
      return NextResponse.json({ success: false, error: "Webhook URL not configured. Save the URL first." }, { status: 400 });
    }

    const usernameSetting = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_username" } });
    const avatarSetting = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_avatar_url" } });

    const payload = buildWebhookPayload(
      {
        embeds: [{
          title: "🧪 Test Webhook",
          description: "This is a test message. Discord webhook connection is working correctly!",
          color: 0x22c55e,
          footer: { text: "Lity Software Admin Panel" },
          timestamp: new Date().toISOString(),
        }],
      },
      usernameSetting?.value || undefined,
      avatarSetting?.value || undefined
    );

    const result = await sendDiscordWebhook(webhookUrlSetting.value, payload, 1);

    // Store last test result
    await prisma.siteSetting.upsert({
      where: { key: "discord_webhook_last_test" },
      update: { value: JSON.stringify({ success: result.success, responseCode: result.responseCode, date: new Date().toISOString() }) },
      create: { key: "discord_webhook_last_test", value: JSON.stringify({ success: result.success, responseCode: result.responseCode, date: new Date().toISOString() }), type: "json", group: "discord", label: "Last Test Result" },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "WEBHOOK_TEST",
      entity: "Webhook",
      after: { success: result.success, responseCode: result.responseCode },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Discord test error:", error);
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized - please log in again" }, { status: 401 });
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
