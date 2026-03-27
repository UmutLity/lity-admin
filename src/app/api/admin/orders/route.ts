import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const LICENSE_MATCH_WINDOW_MS = 10 * 60 * 1000;

function clampLimit(raw: string | null) {
  const parsed = Number(raw || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.floor(parsed)));
}

function withFallbackLicenseCount(status: string, count: number) {
  if (count > 0) return count;
  return status === "PAID" ? 1 : 0;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const query = (req.nextUrl.searchParams.get("q") || "").trim();
    const limit = clampLimit(req.nextUrl.searchParams.get("limit"));

    const where = query
      ? {
          OR: [
            { id: { contains: query, mode: "insensitive" as const } },
            {
              customer: {
                OR: [
                  { username: { contains: query, mode: "insensitive" as const } },
                  { email: { contains: query, mode: "insensitive" as const } },
                ],
              },
            },
            {
              items: {
                some: {
                  product: { name: { contains: query, mode: "insensitive" as const } },
                },
              },
            },
          ],
        }
      : {};

    const [totalOrders, totalRevenueAgg, totalOrderItems, orders] = await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: { not: "CANCELED" } },
      }),
      prisma.orderItem.count(),
      prisma.order.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
            },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      }),
    ]);

    if (!orders.length) {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalOrders,
            totalRevenue: Number(totalRevenueAgg._sum.totalAmount || 0),
            licensesSold: totalOrderItems,
          },
          orders: [],
        },
      });
    }

    const customerIds = Array.from(
      new Set(
        orders
          .map((order) => order.customerId)
          .filter((value): value is string => !!value)
      )
    );
    const productIds = Array.from(
      new Set(orders.flatMap((order) => order.items.map((item) => item.productId)))
    );
    const plans = Array.from(
      new Set(orders.flatMap((order) => order.items.map((item) => item.plan)))
    );

    const createdTimes = orders.map((order) => order.createdAt.getTime());
    const lowerBound = new Date(Math.min(...createdTimes) - 24 * 60 * 60 * 1000);
    const upperBound = new Date(Math.max(...createdTimes) + 24 * 60 * 60 * 1000);

    const licenses =
      customerIds.length && productIds.length && plans.length
        ? await prisma.license.findMany({
            where: {
              customerId: { in: customerIds },
              productId: { in: productIds },
              plan: { in: plans },
              createdAt: { gte: lowerBound, lte: upperBound },
            },
            select: {
              id: true,
              customerId: true,
              productId: true,
              plan: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          })
        : [];

    const bucket = new Map<string, typeof licenses>();
    for (const license of licenses) {
      const key = `${license.customerId}::${license.productId}::${license.plan}`;
      const list = bucket.get(key) || [];
      list.push(license);
      bucket.set(key, list);
    }

    const usedLicenseIds = new Set<string>();
    const oldestFirst = [...orders].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    const itemLicenseCount = new Map<string, number>();

    for (const order of oldestFirst) {
      for (const item of order.items) {
        const key = `${order.customerId || ""}::${item.productId}::${item.plan}`;
        const candidates = bucket.get(key) || [];
        const orderTs = +new Date(order.createdAt);
        const match = candidates.find((candidate) => {
          if (usedLicenseIds.has(candidate.id)) return false;
          return Math.abs(+new Date(candidate.createdAt) - orderTs) <= LICENSE_MATCH_WINDOW_MS;
        });
        if (match) {
          usedLicenseIds.add(match.id);
          itemLicenseCount.set(item.id, 1);
        } else {
          itemLicenseCount.set(item.id, 0);
        }
      }
    }

    const rows = orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      status: order.status,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      customer: order.customer
        ? {
            id: order.customer.id,
            username: order.customer.username,
            email: order.customer.email,
            avatar: order.customer.avatar,
          }
        : null,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        productSlug: item.product.slug,
        plan: item.plan,
        amount: item.amount,
        licenseCount: withFallbackLicenseCount(order.status, itemLicenseCount.get(item.id) || 0),
      })),
    }));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalOrders,
          totalRevenue: Number(totalRevenueAgg._sum.totalAmount || 0),
          licensesSold: totalOrderItems,
        },
        orders: rows,
      },
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/admin/orders error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

