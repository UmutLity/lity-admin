import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

const AUTO_PROMOTE_ROLES = new Set(["MEMBER", "USER", "CUSTOMER"]);

function isManualDeliveryProduct(product: { defaultLoaderUrl?: string | null }) {
  return !String(product?.defaultLoaderUrl || "").trim();
}

function getPlanExpiry(plan: string): Date | null {
  const normalized = String(plan || "").toUpperCase().trim();
  const now = Date.now();
  if (normalized === "DAILY") return new Date(now + 24 * 60 * 60 * 1000);
  if (normalized === "3_DAYS") return new Date(now + 3 * 24 * 60 * 60 * 1000);
  if (normalized === "WEEKLY") return new Date(now + 7 * 24 * 60 * 60 * 1000);
  if (normalized === "MONTHLY") return new Date(now + 30 * 24 * 60 * 60 * 1000);
  if (normalized === "3_MONTHS") return new Date(now + 90 * 24 * 60 * 60 * 1000);
  return null;
}

function buildLicenseKey(productSlug: string, plan: string): string {
  const planKey = String(plan || "").replace(/[^A-Z0-9]+/gi, "").toUpperCase() || "GEN";
  const partA = crypto.randomBytes(4).toString("hex").toUpperCase();
  const partB = crypto.randomBytes(4).toString("hex").toUpperCase();
  const partC = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${productSlug.slice(0, 4).toUpperCase()}-${planKey.slice(0, 3)}-${partA}-${partB}-${partC}`;
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
    const requestedPlan = typeof body?.plan === "string" ? body.plan.trim() : "";

    if (!productId || !requestedPlan) {
      return NextResponse.json({ success: false, error: "Valid product and plan required" }, { status: 400 });
    }

    const normalizedPlan = requestedPlan.toUpperCase();

    const [customer, product] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, username: true, role: true, isActive: true, balance: true, totalSpent: true },
      }),
      prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, slug: true, isActive: true, status: true, currency: true, defaultLoaderUrl: true },
      }),
    ]);

    if (!customer || !customer.isActive || customer.role === "BANNED") {
      return NextResponse.json({ success: false, error: "Your account cannot perform purchases." }, { status: 403 });
    }
    if (!product || !product.isActive || product.status === "DISCONTINUED") {
      return NextResponse.json({ success: false, error: "Product is not available." }, { status: 404 });
    }

    const priceRow = await prisma.productPrice.findFirst({
      where: {
        productId,
        OR: [{ plan: requestedPlan }, { plan: normalizedPlan }],
      },
    });
    if (!priceRow) {
      return NextResponse.json({ success: false, error: "Selected plan is not available." }, { status: 400 });
    }

    const selectedPlan = priceRow.plan;

    const amount = Number(priceRow.price || 0);
    const manualDelivery = isManualDeliveryProduct(product);
    if (amount <= 0) return NextResponse.json({ success: false, error: "Invalid product price." }, { status: 400 });
    if (customer.balance < amount) {
      return NextResponse.json({ success: false, error: "Insufficient balance." }, { status: 400 });
    }

    const expiresAt = getPlanExpiry(selectedPlan);
    const licenseKey = await createUniqueLicenseKey(product.slug, selectedPlan);

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.customer.findUnique({
        where: { id: customer.id },
        select: { id: true, balance: true, totalSpent: true, role: true },
      });
      if (!current) throw new Error("Customer not found");
      if (current.balance < amount) throw new Error("Insufficient balance");

      const before = current.balance;
      const after = Math.max(0, before - amount);

      const normalizedRole = String(current.role || "").toUpperCase();
      const shouldPromoteToCustomer = AUTO_PROMOTE_ROLES.has(normalizedRole);

      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          balance: after,
          totalSpent: { increment: amount },
          ...(shouldPromoteToCustomer ? { role: "CUSTOMER" } : {}),
        },
        select: { id: true, balance: true, totalSpent: true, role: true },
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
          plan: selectedPlan,
          amount,
        },
      });

      const license = await tx.license.create({
        data: {
          customerId: customer.id,
          productId: product.id,
          plan: selectedPlan,
          key: licenseKey,
          status: manualDelivery ? "PENDING" : "ACTIVE",
          downloadUrl: manualDelivery ? null : (product.defaultLoaderUrl || null),
          note: manualDelivery ? "Manual delivery pending. Our team will contact you after review." : "Purchased with wallet balance",
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
          reason: `Purchase: ${product.name} (${selectedPlan})`,
          orderId: order.id,
        },
      });

      await tx.cartItem.deleteMany({
        where: { customerId: customer.id, productId: product.id, plan: selectedPlan },
      });

      return { updatedCustomer, order, license };
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: result.order.id,
        licenseId: result.license.id,
        licenseKey: result.license.key,
        licenseStatus: result.license.status,
        manualDelivery,
        balance: result.updatedCustomer.balance,
        totalSpent: result.updatedCustomer.totalSpent,
        role: result.updatedCustomer.role,
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
