import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { encodeCouponDescription, parseCouponDescription, sanitizeCouponRuleConfig } from "@/lib/coupon-rules";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const body = await req.json();
    const existing = await prisma.coupon.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Coupon not found" }, { status: 404 });
    }

    const parsed = parseCouponDescription(existing.description);
    const payload: Record<string, any> = {};

    if (body?.isActive !== undefined) payload.isActive = !!body.isActive;
    if (body?.expiresAt !== undefined) payload.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body?.usageLimit !== undefined) payload.usageLimit = body.usageLimit === "" || body.usageLimit === null ? null : Math.max(1, Math.floor(Number(body.usageLimit)));

    if (body?.description !== undefined || body?.ruleConfig !== undefined) {
      const nextDescription = body?.description !== undefined
        ? String(body.description || "").trim()
        : (parsed.description || "");
      const nextRules = body?.ruleConfig !== undefined
        ? sanitizeCouponRuleConfig(body.ruleConfig)
        : parsed.ruleConfig;
      payload.description = encodeCouponDescription(nextDescription, nextRules);
    }

    const updated = await prisma.coupon.update({
      where: { id: params.id },
      data: payload,
    });
    const updatedParsed = parseCouponDescription(updated.description);
    return NextResponse.json({
      success: true,
      data: { ...updated, description: updatedParsed.description, ruleConfig: updatedParsed.ruleConfig },
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (String(error?.message || "").includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("PATCH /api/admin/coupons/[id] error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    await prisma.coupon.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (String(error?.message || "").includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("DELETE /api/admin/coupons/[id] error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
