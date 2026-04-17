import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { encodeCouponDescription, parseCouponDescription, sanitizeCouponRuleConfig } from "@/lib/coupon-rules";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const rawCoupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
    });

    const coupons = rawCoupons.map((coupon) => {
      const parsed = parseCouponDescription(coupon.description);
      return {
        ...coupon,
        description: parsed.description,
        ruleConfig: parsed.ruleConfig,
      };
    });

    return NextResponse.json({ success: true, data: coupons });
  } catch (error: any) {
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (String(error?.message || "").includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("GET /api/admin/coupons error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const code = String(body?.code || "").trim().toUpperCase();
    const description = String(body?.description || "").trim();
    const ruleConfig = sanitizeCouponRuleConfig(body?.ruleConfig);
    const type = String(body?.type || "PERCENT").toUpperCase();
    const value = Number(body?.value || 0);
    const minOrderAmount = body?.minOrderAmount === "" || body?.minOrderAmount === undefined ? null : Number(body.minOrderAmount);
    const usageLimit = body?.usageLimit === "" || body?.usageLimit === undefined ? null : Number(body.usageLimit);
    const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;

    if (!code || code.length < 3) {
      return NextResponse.json({ success: false, error: "Coupon code must be at least 3 characters." }, { status: 400 });
    }
    if (!["PERCENT", "FIXED"].includes(type)) {
      return NextResponse.json({ success: false, error: "Coupon type is invalid." }, { status: 400 });
    }
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ success: false, error: "Coupon value must be greater than 0." }, { status: 400 });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        description: encodeCouponDescription(description || null, ruleConfig),
        type,
        value,
        minOrderAmount: Number.isFinite(minOrderAmount as number) ? minOrderAmount : null,
        usageLimit: Number.isFinite(usageLimit as number) ? Math.max(1, Math.floor(usageLimit as number)) : null,
        expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      },
    });
    const parsed = parseCouponDescription(coupon.description);
    return NextResponse.json({
      success: true,
      data: { ...coupon, description: parsed.description, ruleConfig: parsed.ruleConfig },
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (String(error?.message || "").includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("POST /api/admin/coupons error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
