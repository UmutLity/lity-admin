import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { appendOrderTimeline } from "@/lib/orders";
import { sendOrderNotificationToDiscord } from "@/lib/discord";

const LICENSE_MATCH_WINDOW_MS = 10 * 60 * 1000;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const action = String(body?.action || "").toUpperCase();

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        customer: { select: { id: true, email: true, username: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, defaultLoaderUrl: true } },
          },
        },
      },
    });

    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });

    if (action === "MARK_PROCESSING") {
      if (String(order.status || "").toUpperCase() === "DELIVERED") {
        return NextResponse.json({ success: false, error: "Delivered orders cannot be moved back to processing." }, { status: 409 });
      }

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PROCESSING",
          timeline: appendOrderTimeline(order.timeline, {
            type: "PROCESSING",
            title: "Manual delivery in progress",
            description: `${(session.user as any).name || "Admin"} started preparing this delivery.`,
          }),
        },
      });

      if (order.customerId) {
        await prisma.notification.create({
          data: {
            userId: order.customerId,
            type: "DELIVERY_PROCESSING",
            message: `Your order #${order.id.slice(-8)} is now being prepared by staff.`,
          },
        });
      }

      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "MARK_DELIVERED") {
      if (!order.customerId || !order.items.length) {
        return NextResponse.json({ success: false, error: "Order is missing customer or item data." }, { status: 400 });
      }

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

      await prisma.$transaction(async (tx) => {
        for (const license of matchedLicenses) {
          await tx.license.update({
            where: { id: license.id },
            data: {
              status: "ACTIVE",
              downloadUrl: license.product.defaultLoaderUrl || null,
              note: "Delivery has been completed by admin.",
            },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "DELIVERED",
            timeline: appendOrderTimeline(order.timeline, {
              type: "DELIVERED",
              title: "Manual delivery completed",
              description: `${matchedLicenses.length || order.items.length} item(s) marked as delivered.`,
            }),
          },
        });

        if (order.customerId) {
          await tx.notification.create({
            data: {
              userId: order.customerId,
              type: "DELIVERY",
              message: `Your order #${order.id.slice(-8)} has been delivered. Open your orders page to view the delivery content.`,
            },
          });
        }
      });

      return NextResponse.json({ success: true });
    }

    if (action === "SEND_DISCORD") {
      const firstItem = order.items[0];
      if (!firstItem) {
        return NextResponse.json({ success: false, error: "Order has no items." }, { status: 400 });
      }

      await sendOrderNotificationToDiscord({
        orderId: order.id,
        productName: firstItem.product.name,
        productSlug: firstItem.product.slug,
        plan: firstItem.plan,
        amount: order.totalAmount,
        subtotalAmount: order.subtotalAmount || order.totalAmount,
        discountAmount: order.discountAmount || 0,
        couponCode: order.couponCode || null,
        customerEmail: order.customer?.email || null,
        customerUsername: order.customer?.username || null,
        customerNote: order.customerNote || null,
        manualDelivery: true,
      });

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PROCESSING",
          timeline: appendOrderTimeline(order.timeline, {
            type: "DISCORD_SENT",
            title: "Discord order notification sent",
            description: "Admin triggered a manual Discord reminder for this order.",
          }),
        },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unsupported action." }, { status: 400 });
  } catch (error: any) {
    if (error?.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (String(error?.message || "").includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("PATCH /api/admin/orders/[id] error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
