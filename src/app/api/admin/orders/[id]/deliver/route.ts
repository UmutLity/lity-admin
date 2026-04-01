import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { appendOrderTimeline } from "@/lib/orders";

export const dynamic = "force-dynamic";

const LICENSE_MATCH_WINDOW_MS = 10 * 60 * 1000;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const deliveryContent = typeof body.deliveryContent === "string" ? body.deliveryContent.trim() : "";

    if (deliveryContent.length < 3) {
      return NextResponse.json({ success: false, error: "deliveryContent must be at least 3 characters." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        customer: { select: { id: true, username: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, defaultLoaderUrl: true } },
          },
        },
      },
    });

    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    if (!order.customerId) return NextResponse.json({ success: false, error: "Order is missing a customer." }, { status: 400 });

    const matchedLicenses = await prisma.license.findMany({
      where: {
        customerId: order.customerId,
        status: "PENDING",
        createdAt: {
          gte: new Date(order.createdAt.getTime() - LICENSE_MATCH_WINDOW_MS),
          lte: new Date(order.createdAt.getTime() + LICENSE_MATCH_WINDOW_MS),
        },
        OR: order.items.map((item) => ({
          productId: item.productId,
          plan: item.plan,
        })),
      },
      include: {
        product: { select: { defaultLoaderUrl: true } },
      },
    });

    const updatedOrder = await prisma.$transaction(async (tx) => {
      for (const license of matchedLicenses) {
        await tx.license.update({
          where: { id: license.id },
          data: {
            status: "ACTIVE",
            downloadUrl: license.product.defaultLoaderUrl || null,
            note: "Delivery has been sent in your order details.",
          },
        });
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "DELIVERED",
          deliveryContent,
          deliveredAt: new Date(),
          deliveredById: (session.user as any).id,
          timeline: appendOrderTimeline(order.timeline, {
            type: "DELIVERED",
            title: "Manual delivery completed",
            description: `${matchedLicenses.length || order.items.length} item(s) delivered by ${(session.user as any).name || "admin"}.`,
          }),
        },
      });

      await tx.notification.create({
        data: {
          userId: order.customerId!,
          type: "DELIVERY",
          message: `Your order #${order.id.slice(-8)} has been delivered. Open your orders page to view the delivery content.`,
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, data: updatedOrder });
  } catch (error: any) {
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (String(error?.message || "").includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("PATCH /api/admin/orders/[id]/deliver error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
