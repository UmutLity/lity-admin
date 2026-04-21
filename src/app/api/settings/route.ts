import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/settings - Public: site ayarları
export async function GET() {
  try {
    // Read pause flag but do not hard-fail this endpoint.
    // Frontend maintenance guard depends on /api/settings to render maintenance screen.
    const apiPause = await prisma.siteSetting.findUnique({ where: { key: "public_api_pause" } });

    // Check maintenance mode
    const maintenance = await prisma.siteSetting.findUnique({ where: { key: "maintenance_mode" } });

    const settings = await prisma.siteSetting.findMany();
    const data: Record<string, string> = {};
    for (const s of settings) {
      // Don't expose sensitive settings publicly
      if (s.group === "security" || s.key.includes("webhook_url") || s.key.includes("secret") || s.key.includes("last_test")) continue;
      data[s.key] = s.value;
    }

    if (apiPause?.value === "true") {
      data.public_api_pause = "true";
    }

    // Add maintenance flag
    if (maintenance?.value === "true") {
      data.maintenance_mode = "true";
    }

    // Add disable_purchases flag
    const purchases = await prisma.siteSetting.findUnique({ where: { key: "disable_purchases" } });
    if (purchases?.value === "true") {
      data.disable_purchases = "true";
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
