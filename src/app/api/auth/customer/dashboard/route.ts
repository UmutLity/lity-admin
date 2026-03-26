import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

export async function GET(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const customer = await prisma.customer.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        balance: true,
        totalSpent: true,
        createdAt: true,
      },
    });

    if (!customer) return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    if (!customer.isActive || customer.role === "BANNED") {
      return NextResponse.json({ success: false, error: "Your account is not eligible." }, { status: 403 });
    }

    const [activeLicenses, totalOrders, recentOrders, openTickets, recentTransactions] = await Promise.all([
      prisma.license.count({
        where: {
          customerId: customer.id,
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
      prisma.order.count({ where: { customerId: customer.id } }),
      prisma.order.findMany({
        where: { customerId: customer.id },
        include: {
          items: {
            include: { product: { select: { id: true, name: true, slug: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.supportTicket.count({
        where: {
          OR: [
            { email: { equals: customer.email, mode: "insensitive" } },
            { discordUsername: { equals: customer.username, mode: "insensitive" } },
          ],
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] },
        },
      }).catch(() => 0),
      prisma.balanceTransaction.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        customer,
        stats: {
          balance: customer.balance,
          activeCheats: activeLicenses,
          totalOrders,
          pendingPayments: 0,
          totalSpent: customer.totalSpent,
          openTickets,
        },
        recentOrders,
        recentTransactions,
      },
    });
  } catch (error) {
    console.error("GET /api/auth/customer/dashboard error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

