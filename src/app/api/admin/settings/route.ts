import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

export const dynamic = "force-dynamic";

const SETTING_DEFAULTS: Record<string, { value: string; type: string; group: string; label: string }> = {
  announcement_active: {
    value: "true",
    type: "boolean",
    group: "announcement",
    label: "Announcement Active",
  },
  announcement_type: {
    value: "promo",
    type: "string",
    group: "announcement",
    label: "Announcement Type",
  },
  announcement_text: {
    value: "NEW UPDATE AVAILABLE",
    type: "string",
    group: "announcement",
    label: "Announcement Text",
  },
  discord_topup_webhook_url: {
    value: "",
    type: "string",
    group: "discord",
    label: "Top-up Webhook URL",
  },
  discord_topup_webhook_enabled: {
    value: "false",
    type: "boolean",
    group: "discord",
    label: "Top-up Webhook Enabled",
  },
  release_automation_enabled: {
    value: "true",
    type: "boolean",
    group: "discord",
    label: "Release Automation Enabled",
  },
  release_discord_enabled: {
    value: "true",
    type: "boolean",
    group: "discord",
    label: "Release Discord Dispatch Enabled",
  },
  release_notifications_enabled: {
    value: "true",
    type: "boolean",
    group: "discord",
    label: "Release Site Notification Enabled",
  },
  release_webhook_enabled: {
    value: "false",
    type: "boolean",
    group: "discord",
    label: "Release Webhook Enabled",
  },
  release_webhook_url: {
    value: "",
    type: "string",
    group: "discord",
    label: "Release Webhook URL",
  },
  release_email_hook_enabled: {
    value: "false",
    type: "boolean",
    group: "discord",
    label: "Release Email Hook Enabled",
  },
  release_email_hook_url: {
    value: "",
    type: "string",
    group: "discord",
    label: "Release Email Hook URL",
  },
  referral_enabled: {
    value: "true",
    type: "boolean",
    group: "growth",
    label: "Referral Program Enabled",
  },
  referral_reward_referrer: {
    value: "5",
    type: "number",
    group: "growth",
    label: "Referral Reward (Referrer)",
  },
  site_public_url: {
    value: "https://www.litysoftware.com",
    type: "string",
    group: "general",
    label: "Public Site URL",
  },
};

// GET /api/admin/settings
export async function GET() {
  try {
    await requireAdmin();

    const settings = await prisma.siteSetting.findMany({ orderBy: { group: "asc" } });
    const missingDefaults = Object.entries(SETTING_DEFAULTS)
      .filter(([key]) => !settings.some((setting) => setting.key === key))
      .map(([key, config]) => ({
        id: `virtual-${key}`,
        key,
        value: config.value,
        type: config.type,
        group: config.group,
        label: config.label,
        updatedAt: new Date(),
      }));

    const mergedSettings = [...settings, ...missingDefaults].sort((a, b) => a.group.localeCompare(b.group));
    return NextResponse.json({ success: true, data: mergedSettings });
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

    const before: Record<string, string> = {};
    const after: Record<string, string> = {};

    for (const { key, value } of body.settings) {
      const existing = await prisma.siteSetting.findUnique({ where: { key } });
      const preset = SETTING_DEFAULTS[key];

      if (existing) {
        before[key] = existing.value;
        after[key] = value;
      } else if (preset) {
        before[key] = preset.value;
        after[key] = value;
      }

      await prisma.siteSetting.upsert({
        where: { key },
        update: {
          value,
          ...(preset ? { type: preset.type, group: preset.group, label: preset.label } : {}),
        },
        create: {
          key,
          value,
          type: preset?.type || "string",
          group: preset?.group || "custom",
          label: preset?.label || key,
        },
      });
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
