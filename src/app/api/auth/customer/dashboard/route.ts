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
        createdAt: true,
      },
    });

    if (!customer) return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    if (!customer.isActive || customer.role === "BANNED") {
      return NextResponse.json({ success: false, error: "Your account is not eligible." }, { status: 403 });
    }

    const [activeLicenses, totalOrders, recentOrders, openTickets, recentTransactions, ownedRoles, totalSpentAgg, leaderboard, pendingTopups] = await Promise.all([
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
      prisma.license.findMany({
        where: {
          customerId: customer.id,
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          product: { accessRoleKey: { not: null } },
        },
        select: { product: { select: { accessRoleKey: true, name: true, slug: true } } },
        distinct: ["productId"],
      }),
      prisma.order
        .aggregate({
          where: { customerId: customer.id, status: { not: "CANCELED" } },
          _sum: { totalAmount: true },
        })
        .catch(() => ({ _sum: { totalAmount: 0 } })),
      (async () => {
        try {
          const grouped = await prisma.order.groupBy({
            by: ["customerId"],
            where: {
              customerId: { not: null },
              status: { not: "CANCELED" },
            },
            _sum: { totalAmount: true },
          });

          const nonZero = grouped
            .map((x) => ({
              customerId: x.customerId as string,
              totalSpent: Number(x._sum.totalAmount || 0),
            }))
            .filter((x) => x.totalSpent > 0);

          if (!nonZero.length) return [];

          const customers = await prisma.customer.findMany({
            where: {
              id: { in: nonZero.map((x) => x.customerId) },
              isActive: true,
              role: { not: "BANNED" },
            },
            select: { id: true, username: true },
          });

          const userMap = new Map(customers.map((x) => [x.id, x.username]));
          return nonZero
            .filter((x) => userMap.has(x.customerId))
            .map((x) => ({
              id: x.customerId,
              username: userMap.get(x.customerId)!,
              totalSpent: x.totalSpent,
            }))
            .sort((a, b) => b.totalSpent - a.totalSpent || a.username.localeCompare(b.username));
        } catch {
          return [];
        }
      })(),
      prisma.topUpRequest.count({
        where: { customerId: customer.id, status: "PENDING" },
      }).catch(() => 0),
    ]);

    const totalSpent = Number(totalSpentAgg?._sum?.totalAmount || 0);

    return NextResponse.json({
      success: true,
      data: {
        customer,
        stats: {
          balance: customer.balance,
          activeCheats: activeLicenses,
          totalOrders,
          pendingPayments: pendingTopups,
          totalSpent,
          openTickets,
        },
        recentOrders,
        recentTransactions,
        leaderboard: leaderboard.map((item, index) => ({
          rank: index + 1,
          id: item.id,
          username: item.username,
          totalSpent: item.totalSpent,
        })),
        ownedProductRoles: ownedRoles
          .map((item) => ({
            roleKey: item.product.accessRoleKey!,
            productName: item.product.name,
            productSlug: item.product.slug,
          }))
          .filter((item) => !!item.roleKey),
      },
    });
  } catch (error) {
    console.error("GET /api/auth/customer/dashboard error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
