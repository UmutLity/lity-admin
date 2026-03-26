import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

const ALLOWED_PLANS = new Set(["DAILY", "WEEKLY", "MONTHLY", "LIFETIME"]);

function getPlanExpiry(plan: string): Date | null {
  const now = Date.now();
  if (plan === "DAILY") return new Date(now + 24 * 60 * 60 * 1000);
  if (plan === "WEEKLY") return new Date(now + 7 * 24 * 60 * 60 * 1000);
  if (plan === "MONTHLY") return new Date(now + 30 * 24 * 60 * 60 * 1000);
  return null;
}

function buildLicenseKey(productSlug: string, plan: string): string {
  const partA = crypto.randomBytes(4).toString("hex").toUpperCase();
  const partB = crypto.randomBytes(4).toString("hex").toUpperCase();
  const partC = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${productSlug.slice(0, 4).toUpperCase()}-${plan.slice(0, 3).toUpperCase()}-${partA}-${partB}-${partC}`;
}

async function createUniqueLicenseKey(productSlug: string, plan: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const key = buildLicenseKey(productSlug, plan);
    const exists = await prisma.license.findUnique({ where: { key }, select: { id: true } });
    if (!exists) return key;
  }
  throw new Error("Could not generate a unique license key");
}

export async function POST(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const productId = typeof body?.productId === "string" ? body.productId : "";
    const rawPlan = typeof body?.plan === "string" ? body.plan.toUpperCase().trim() : "";

    if (!productId || !rawPlan || !ALLOWED_PLANS.has(rawPlan)) {
      return NextResponse.json({ success: false, error: "Valid product and plan required" }, { status: 400 });
    }

    const [customer, product, priceRow] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, username: true, role: true, isActive: true, balance: true, totalSpent: true },
      }),
      prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, slug: true, isActive: true, status: true, currency: true, defaultLoaderUrl: true },
      }),
      prisma.productPrice.findUnique({
        where: { productId_plan: { productId, plan: rawPlan } },
      }),
    ]);

    if (!customer || !customer.isActive || customer.role === "BANNED") {
      return NextResponse.json({ success: false, error: "Your account cannot perform purchases." }, { status: 403 });
    }
    if (!product || !product.isActive || product.status === "DISCONTINUED") {
      return NextResponse.json({ success: false, error: "Product is not available." }, { status: 404 });
    }
    if (!priceRow) {
      return NextResponse.json({ success: false, error: "Selected plan is not available." }, { status: 400 });
    }

    const amount = Number(priceRow.price || 0);
    if (amount <= 0) return NextResponse.json({ success: false, error: "Invalid product price." }, { status: 400 });
    if (customer.balance < amount) {
      return NextResponse.json({ success: false, error: "Insufficient balance." }, { status: 400 });
    }

    const expiresAt = getPlanExpiry(rawPlan);
    const licenseKey = await createUniqueLicenseKey(product.slug, rawPlan);

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.customer.findUnique({
        where: { id: customer.id },
        select: { id: true, balance: true, totalSpent: true },
      });
      if (!current) throw new Error("Customer not found");
      if (current.balance < amount) throw new Error("Insufficient balance");

      const before = current.balance;
      const after = Math.max(0, before - amount);

      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          balance: after,
          totalSpent: { increment: amount },
        },
        select: { id: true, balance: true, totalSpent: true },
      });

      const order = await tx.order.create({
        data: {
          customerId: customer.id,
          status: "PAID",
          paymentMethod: "BALANCE",
          currency: product.currency || "USD",
          totalAmount: amount,
        },
      });

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          plan: rawPlan,
          amount,
        },
      });

      const license = await tx.license.create({
        data: {
          customerId: customer.id,
          productId: product.id,
          plan: rawPlan,
          key: licenseKey,
          status: "ACTIVE",
          downloadUrl: product.defaultLoaderUrl || null,
          note: "Purchased with wallet balance",
          expiresAt,
        },
      });

      await tx.balanceTransaction.create({
        data: {
          customerId: customer.id,
          type: "DEBIT",
          amount,
          balanceBefore: before,
          balanceAfter: after,
          reason: `Purchase: ${product.name} (${rawPlan})`,
          orderId: order.id,
        },
      });

      await tx.cartItem.deleteMany({
        where: { customerId: customer.id, productId: product.id, plan: rawPlan },
      });

      return { updatedCustomer, order, license };
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: result.order.id,
        licenseId: result.license.id,
        licenseKey: result.license.key,
        balance: result.updatedCustomer.balance,
        totalSpent: result.updatedCustomer.totalSpent,
      },
    });
  } catch (error: any) {
    if (String(error?.message || "").toLowerCase().includes("insufficient balance")) {
      return NextResponse.json({ success: false, error: "Insufficient balance." }, { status: 400 });
    }
    console.error("POST /api/auth/customer/purchase error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

