import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";
import { appendOrderTimeline } from "@/lib/orders";
import { sendOrderNotificationToDiscord } from "@/lib/discord";
import { parseCouponDescription } from "@/lib/coupon-rules";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const AUTO_PROMOTE_ROLES = new Set(["MEMBER", "USER", "CUSTOMER"]);
const IDEMPOTENCY_PREFIX = "idempotency:purchase";

function isSchemaMismatch(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("P2021") || message.includes("P2022");
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function normalizeIdempotencyKey(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 96);
  return normalized.length >= 8 ? normalized : null;
}

function buildIdempotencyStoreKey(customerId: string, idempotencyKey: string): string {
  return `${IDEMPOTENCY_PREFIX}:${customerId}:${idempotencyKey}`;
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type PurchaseIdempotencyPayload = {
  status: "PENDING" | "COMPLETED" | "FAILED";
  createdAt: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
  response?: any;
};

async function acquirePurchaseIdempotencyLock(lockKey: string) {
  const payload: PurchaseIdempotencyPayload = {
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };

  try {
    await prisma.siteSetting.create({
      data: {
        key: lockKey,
        value: JSON.stringify(payload),
        type: "json",
        group: "idempotency",
        label: "purchase lock",
      },
    });
    return { acquired: true as const, payload };
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
  }

  const existing = await prisma.siteSetting.findUnique({
    where: { key: lockKey },
    select: { value: true, updatedAt: true },
  });

  return {
    acquired: false as const,
    payload: safeJsonParse<PurchaseIdempotencyPayload>(existing?.value || null),
  };
}

async function setPurchaseIdempotencyState(lockKey: string, nextPayload: PurchaseIdempotencyPayload) {
  await prisma.siteSetting.update({
    where: { key: lockKey },
    data: {
      value: JSON.stringify(nextPayload),
      type: "json",
      group: "idempotency",
      label: "purchase lock",
    },
  });
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
  let idempotencyLockKey: string | null = null;
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const productId = typeof body?.productId === "string" ? body.productId : "";
    const requestedPlan = typeof body?.plan === "string" ? body.plan.trim() : "";
    const customerNote = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
    const couponCode = typeof body?.couponCode === "string" ? body.couponCode.trim().toUpperCase() : "";
    const idempotencyKey = normalizeIdempotencyKey(
      req.headers.get("idempotency-key") ||
      (typeof body?.idempotencyKey === "string" ? body.idempotencyKey : null)
    );

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
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          isActive: true,
          status: true,
          currency: true,
          defaultLoaderUrl: true,
          deliveryType: true,
        },
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

    const baseAmount = Number(priceRow.price || 0);
    const manualDelivery = String(product.deliveryType || "MANUAL").toUpperCase() !== "INSTANT";
    if (baseAmount <= 0) return NextResponse.json({ success: false, error: "Invalid product price." }, { status: 400 });

    let coupon: null | {
      id: string;
      code: string;
      type: string;
      value: number;
      minOrderAmount: number | null;
      usageLimit: number | null;
      usedCount: number;
      expiresAt: Date | null;
      isActive: boolean;
      description: string | null;
    } = null;

    if (couponCode) {
      coupon = await prisma.coupon.findUnique({
        where: { code: couponCode },
        select: {
          id: true,
          code: true,
          type: true,
          value: true,
          minOrderAmount: true,
          usageLimit: true,
          usedCount: true,
          expiresAt: true,
          isActive: true,
          description: true,
        },
      });

      if (!coupon || !coupon.isActive) {
        return NextResponse.json({ success: false, error: "Coupon is not valid." }, { status: 400 });
      }
      if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
        return NextResponse.json({ success: false, error: "Coupon has expired." }, { status: 400 });
      }
      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        return NextResponse.json({ success: false, error: "Coupon usage limit reached." }, { status: 400 });
      }
      if (coupon.minOrderAmount !== null && baseAmount < coupon.minOrderAmount) {
        return NextResponse.json(
          { success: false, error: `Coupon requires a minimum order of $${Number(coupon.minOrderAmount).toFixed(2)}.` },
          { status: 400 }
        );
      }

      const parsedCoupon = parseCouponDescription(coupon.description || null);
      const rules = parsedCoupon.ruleConfig || {};

      if (rules.firstPurchaseOnly) {
        const hasPreviousOrder = await prisma.order.findFirst({
          where: {
            customerId: customer.id,
            status: { not: "CANCELED" },
          },
          select: { id: true },
        });
        if (hasPreviousOrder || Number(customer.totalSpent || 0) > 0) {
          return NextResponse.json({ success: false, error: "Coupon is only valid for first purchase." }, { status: 400 });
        }
      }

      if (rules.allowedProductIds?.length && !rules.allowedProductIds.includes(product.id)) {
        return NextResponse.json({ success: false, error: "Coupon is not valid for this product." }, { status: 400 });
      }

      if (rules.allowedCategories?.length) {
        const productCategory = String(product.category || "").toUpperCase();
        if (!rules.allowedCategories.includes(productCategory)) {
          return NextResponse.json({ success: false, error: "Coupon is not valid for this product category." }, { status: 400 });
        }
      }

      if (rules.allowedPlans?.length) {
        const planKey = String(selectedPlan || "").toUpperCase();
        if (!rules.allowedPlans.includes(planKey)) {
          return NextResponse.json({ success: false, error: "Coupon is not valid for this billing plan." }, { status: 400 });
        }
      }

      if (rules.customerRoleAllowlist?.length) {
        const roleKey = String(customer.role || "").toUpperCase();
        if (!rules.customerRoleAllowlist.includes(roleKey)) {
          return NextResponse.json({ success: false, error: "Coupon is not allowed for your account role." }, { status: 400 });
        }
      }
    }

    let discountAmount = coupon
      ? Math.min(
          baseAmount,
          coupon.type === "FIXED"
            ? Number(coupon.value || 0)
            : (baseAmount * Number(coupon.value || 0)) / 100
        )
      : 0;

    if (coupon) {
      const parsedCoupon = parseCouponDescription(coupon.description || null);
      const maxDiscountAmount = Number(parsedCoupon.ruleConfig?.maxDiscountAmount || 0);
      if (Number.isFinite(maxDiscountAmount) && maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, maxDiscountAmount);
      }
    }
    const amount = Math.max(0, Number((baseAmount - discountAmount).toFixed(2)));

    if (customer.balance < amount) {
      return NextResponse.json({ success: false, error: "Insufficient balance." }, { status: 400 });
    }

    if (idempotencyKey) {
      idempotencyLockKey = buildIdempotencyStoreKey(customer.id, idempotencyKey);
      const lockResult = await acquirePurchaseIdempotencyLock(idempotencyLockKey);

      if (!lockResult.acquired) {
        const existingPayload = lockResult.payload;

        if (existingPayload?.status === "COMPLETED" && existingPayload.response) {
          return NextResponse.json({
            success: true,
            duplicate: true,
            idempotencyKey,
            data: existingPayload.response,
          });
        }

        if (existingPayload?.status === "PENDING") {
          return NextResponse.json(
            {
              success: false,
              error: "This purchase request is already being processed. Please wait a few seconds.",
              code: "PURCHASE_IN_PROGRESS",
            },
            { status: 409 }
          );
        }

        await setPurchaseIdempotencyState(idempotencyLockKey, {
          status: "PENDING",
          createdAt: new Date().toISOString(),
        });
      }
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

      let updatedCustomer: { id: string; balance: number; totalSpent: number; role: string };
      try {
        updatedCustomer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            balance: after,
            totalSpent: { increment: amount },
            ...(shouldPromoteToCustomer ? { role: "CUSTOMER" } : {}),
          },
          select: { id: true, balance: true, totalSpent: true, role: true },
        });
      } catch (error) {
        if (!isSchemaMismatch(error)) throw error;
        const fallbackCustomer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            balance: after,
            ...(shouldPromoteToCustomer ? { role: "CUSTOMER" } : {}),
          },
          select: { id: true, balance: true, role: true },
        });
        updatedCustomer = {
          ...fallbackCustomer,
          totalSpent: Number(current.totalSpent || 0) + amount,
        };
      }

      let order: { id: string; customerId: string | null; status: string; paymentMethod: string; currency: string; totalAmount: number };
      try {
        order = await tx.order.create({
          data: {
            customerId: customer.id,
            status: "PAID",
            paymentMethod: "BALANCE",
            currency: product.currency || "USD",
            totalAmount: amount,
            subtotalAmount: baseAmount,
            discountAmount,
            couponCode: coupon?.code || null,
            customerNote: customerNote || null,
            timeline: appendOrderTimeline(null, {
              type: "ORDER_CREATED",
              title: "Order placed",
              description: manualDelivery
                ? "Payment received. Manual delivery queue created."
                : "Payment received.",
            }),
          },
          select: {
            id: true,
            customerId: true,
            status: true,
            paymentMethod: true,
            currency: true,
            totalAmount: true,
          },
        });
      } catch (error) {
        if (!isSchemaMismatch(error)) throw error;
        order = await tx.order.create({
          data: {
            customerId: customer.id,
            status: "PAID",
            paymentMethod: "BALANCE",
            currency: product.currency || "USD",
            totalAmount: amount,
          },
          select: {
            id: true,
            customerId: true,
            status: true,
            paymentMethod: true,
            currency: true,
            totalAmount: true,
          },
        });
      }

      try {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            plan: selectedPlan,
            amount,
          },
        });
      } catch (error) {
        if (!isSchemaMismatch(error)) throw error;
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            plan: selectedPlan,
          } as any,
        });
      }

      let license: { id: string; key: string; status: string };
      try {
        license = await tx.license.create({
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
          select: { id: true, key: true, status: true },
        });
      } catch (error) {
        if (!isSchemaMismatch(error)) throw error;
        license = await tx.license.create({
          data: {
            customerId: customer.id,
            productId: product.id,
            plan: selectedPlan,
            key: licenseKey,
            status: manualDelivery ? "PENDING" : "ACTIVE",
          } as any,
          select: { id: true, key: true, status: true },
        });
      }

      try {
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
      } catch (error) {
        if (!isSchemaMismatch(error)) throw error;
        await tx.balanceTransaction.create({
          data: {
            customerId: customer.id,
            type: "DEBIT",
            amount,
            reason: `Purchase: ${product.name} (${selectedPlan})`,
          } as any,
        });
      }

      await tx.cartItem
        .deleteMany({
          where: { customerId: customer.id, productId: product.id, plan: selectedPlan },
        })
        .catch(() => {});

      if (coupon) {
        await tx.coupon
          .update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } },
          })
          .catch(() => {});
      }

      return { updatedCustomer, order, license };
    });

    sendOrderNotificationToDiscord({
      orderId: result.order.id,
      productName: product.name,
      productSlug: product.slug,
      plan: selectedPlan,
      amount,
      subtotalAmount: baseAmount,
      discountAmount,
      couponCode: coupon?.code || null,
      customerEmail: customer.email,
      customerUsername: customer.username,
      customerNote: customerNote || null,
      manualDelivery,
    }).catch((err) => {
      console.error("Order Discord webhook error:", err);
    });

    const responseData = {
      orderId: result.order.id,
      licenseId: result.license.id,
      licenseKey: result.license.key,
      licenseStatus: result.license.status,
      manualDelivery,
      subtotalAmount: baseAmount,
      discountAmount,
      couponCode: coupon?.code || null,
      totalAmount: amount,
      balance: result.updatedCustomer.balance,
      totalSpent: result.updatedCustomer.totalSpent,
      role: result.updatedCustomer.role,
    };

    if (idempotencyLockKey) {
      await setPurchaseIdempotencyState(idempotencyLockKey, {
        status: "COMPLETED",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        response: responseData,
      }).catch((err) => {
        console.error("Purchase idempotency completion update failed:", err);
      });
    }

    return NextResponse.json({
      success: true,
      idempotencyKey: idempotencyKey || null,
      data: responseData,
    });
  } catch (error: any) {
    if (idempotencyLockKey) {
      await setPurchaseIdempotencyState(idempotencyLockKey, {
        status: "FAILED",
        createdAt: new Date().toISOString(),
        failedAt: new Date().toISOString(),
        error: String(error?.message || "purchase failed"),
      }).catch((idemErr) => {
        console.error("Purchase idempotency failure update failed:", idemErr);
      });
    }
    if (String(error?.message || "").toLowerCase().includes("insufficient balance")) {
      return NextResponse.json({ success: false, error: "Insufficient balance." }, { status: 400 });
    }
    console.error("POST /api/auth/customer/purchase error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
