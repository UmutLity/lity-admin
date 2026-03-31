import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { parseOrderTimeline } from "@/lib/orders";

const LICENSE_MATCH_WINDOW_MS = 10 * 60 * 1000;

export async function GET() {
  try {
    await requireAdmin();

    const [orders, licenses] = await Promise.all([
      prisma.order.findMany({
        where: { status: { in: ["PAID", "PROCESSING", "DELIVERED"] } },
        select: {
          id: true,
          customerId: true,
          status: true,
          createdAt: true,
          totalAmount: true,
          customer: { select: { id: true, username: true, email: true } },
          items: {
            select: {
              id: true,
              productId: true,
              plan: true,
              amount: true,
              product: { select: { name: true, slug: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }).then((rows) =>
        rows.map((order) => ({
          ...order,
          customerNote: null,
          couponCode: null,
          discountAmount: 0,
          timeline: null,
        }))
      ),
      prisma.license.findMany({
        where: { status: "PENDING" },
        select: {
          id: true,
          customerId: true,
          productId: true,
          plan: true,
          createdAt: true,
        },
      }),
    ]);

    const rows = orders
      .map((order) => {
        const pendingMatches = licenses.filter((license) => {
          if (!order.customerId || license.customerId !== order.customerId) return false;

          const orderTime = order.createdAt.getTime();
          const licenseTime = license.createdAt.getTime();
          const sameItem = order.items.some(
            (item) => item.productId === license.productId && item.plan === license.plan
          );

          return sameItem && Math.abs(licenseTime - orderTime) <= LICENSE_MATCH_WINDOW_MS;
        });

        if (!pendingMatches.length && order.status !== "DELIVERED") return null;

        return {
          id: order.id,
          status: order.status,
          createdAt: order.createdAt,
          totalAmount: order.totalAmount,
          customerNote: order.customerNote,
          couponCode: order.couponCode,
          discountAmount: order.discountAmount,
          deliveryContent: null,
          deliveredAt: null,
          deliveredBy: null,
          customer: order.customer,
          items: order.items.map((item) => ({
            id: item.id,
            productName: item.product.name,
            productSlug: item.product.slug,
            plan: item.plan,
            amount: item.amount,
          })),
          pendingCount: pendingMatches.length,
          timeline: parseOrderTimeline(order.timeline),
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    console.error("GET /api/admin/pending-deliveries error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
