import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getClientIp, isValidCidr } from "@/lib/ip-utils";

// GET /api/admin/security/whitelist
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "security.view");
    if (!hasPerm) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const enabledSetting = await prisma.siteSetting.findUnique({ where: { key: "whitelist_enabled" } });
    const cidrsSetting = await prisma.siteSetting.findUnique({ where: { key: "global_allowed_cidrs" } });
    const userIps = await prisma.userAllowedIp.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    let globalCidrs: string[] = [];
    try {
      globalCidrs = cidrsSetting?.value ? JSON.parse(cidrsSetting.value) : [];
    } catch {
      globalCidrs = [];
    }

    return NextResponse.json({
      success: true,
      data: {
        enabled: enabledSetting?.value === "true",
        globalCidrs,
        userIps,
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/security/whitelist
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "security.manage");
    if (!hasPerm) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { enabled, globalCidrs } = body;

    // Validate CIDRs
    if (globalCidrs) {
      for (const cidr of globalCidrs) {
        if (!isValidCidr(cidr)) {
          return NextResponse.json({ success: false, error: `Invalid CIDR: ${cidr}` }, { status: 400 });
        }
      }
    }

    // Update settings
    if (typeof enabled === "boolean") {
      await prisma.siteSetting.upsert({
        where: { key: "whitelist_enabled" },
        update: { value: String(enabled) },
        create: { key: "whitelist_enabled", value: String(enabled), type: "boolean", group: "security", label: "IP Whitelist Enabled" },
      });
    }

    if (globalCidrs) {
      await prisma.siteSetting.upsert({
        where: { key: "global_allowed_cidrs" },
        update: { value: JSON.stringify(globalCidrs) },
        create: { key: "global_allowed_cidrs", value: JSON.stringify(globalCidrs), type: "json", group: "security", label: "Global Allowed CIDRs" },
      });
    }

    const ip = getClientIp(req);
    await createAuditLog({
      userId,
      action: "SETTINGS_UPDATE",
      entity: "Security",
      after: { enabled, globalCidrs },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
