import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";
import { parseOrderTimeline } from "@/lib/orders";

function normalizeLicenseStatus(status: string, expiresAt: Date | null) {
  if (status === "REVOKED") return "REVOKED";
  if (expiresAt && expiresAt.getTime() < Date.now()) return "EXPIRED";
  return status;
}

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
        lastLoginAt: true,
        twoFactorEnabled: true,
        createdAt: true,
      },
    });

    if (!customer) return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    if (!customer.isActive || customer.role === "BANNED") {
      return NextResponse.json({ success: false, error: "Your account is not eligible." }, { status: 403 });
    }

    const [activeLicenses, totalOrders, deliveredOrders, openTickets, recentOrders, recentTransactions, ownedRoles, totalSpentAgg, leaderboard, pendingTopups, orderRankRows, licenses, tickets, topups, latestChangelogs, announcements, communityCount, ownedProducts, approvedReviews, pendingDeliveries] = await Promise.all([
      prisma.license.count({
        where: {
          customerId: customer.id,
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
      prisma.order.count({ where: { customerId: customer.id } }),
      prisma.order.count({ where: { customerId: customer.id, status: "DELIVERED" } }),
      prisma.supportTicket.count({
        where: {
          OR: [
            { email: { equals: customer.email, mode: "insensitive" } },
            { discordUsername: { equals: customer.username, mode: "insensitive" } },
          ],
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] },
        },
      }).catch(() => 0),
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
      prisma.order.groupBy({
        by: ["customerId"],
        where: {
          customerId: { not: null },
          status: { not: "CANCELED" },
        },
        _count: { _all: true },
      }).catch(() => []),
      prisma.license.findMany({
        where: { customerId: customer.id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              defaultLoaderUrl: true,
              lastUpdateAt: true,
              lastUpdateChangelogId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }).catch(() => []),
      prisma.supportTicket.findMany({
        where: {
          OR: [
            { email: { equals: customer.email, mode: "insensitive" } },
            { discordUsername: { equals: customer.username, mode: "insensitive" } },
          ],
        },
        include: {
          product: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }).catch(() => []),
      prisma.topUpRequest.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }).catch(() => []),
      prisma.changelog.findMany({
        where: { isDraft: false, publishedAt: { not: null } },
        select: {
          id: true,
          title: true,
          publishedAt: true,
          products: { select: { productId: true } },
        },
        orderBy: { publishedAt: "desc" },
        take: 40,
      }).catch(() => []),
      prisma.adminNotification.findMany({
        where: { type: "SYSTEM" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, message: true, createdAt: true },
      }).catch(() => []),
      prisma.communityMessage.count().catch(() => 0),
      prisma.license.findMany({
        where: { customerId: customer.id },
        distinct: ["productId"],
        select: { productId: true },
      }).catch(() => []),
      prisma.review.count({
        where: { customerId: customer.id, isVisible: true },
      }).catch(() => 0),
      prisma.order.count({
        where: {
          customerId: customer.id,
          status: { in: ["PENDING", "PAID", "PROCESSING"] },
        },
      }).catch(() => 0),
    ]);

    const totalSpent = Number(totalSpentAgg?._sum?.totalAmount || 0);
    const spendingRank = leaderboard.findIndex((item) => item.id === customer.id);
    const orderRank = orderRankRows
      .map((x) => ({
        customerId: x.customerId as string,
        orderCount: Number(x._count?._all || 0),
      }))
      .filter((x) => x.orderCount > 0)
      .sort((a, b) => b.orderCount - a.orderCount)
      .findIndex((x) => x.customerId === customer.id);

    const tierRules = [
      { label: "Bronze", minSpent: 10 },
      { label: "Silver", minSpent: 50 },
      { label: "Gold", minSpent: 150 },
      { label: "Platinum", minSpent: 300 },
      { label: "Diamond", minSpent: 750 },
    ];
    let currentTier = "Unranked";
    let nextTier: { label: string; minSpent: number } | null = tierRules[0];
    for (let i = 0; i < tierRules.length; i++) {
      if (totalSpent >= tierRules[i].minSpent) {
        currentTier = tierRules[i].label;
        nextTier = tierRules[i + 1] || null;
      }
    }

    const ownedProductIds = new Set(licenses.map((license) => license.productId));
    const changelogMap = new Map<string, { title: string; publishedAt: Date | null }>();
    for (const changelog of latestChangelogs) {
      for (const relation of changelog.products) {
        if (!changelogMap.has(relation.productId)) {
          changelogMap.set(relation.productId, {
            title: changelog.title,
            publishedAt: changelog.publishedAt,
          });
        }
      }
    }

    const downloadCenter = licenses.map((license) => {
      const latest = changelogMap.get(license.productId);
      const checksum = Buffer.from(`${license.key}:${license.productId}`).toString("base64").slice(0, 16).toUpperCase();
      return {
        id: license.id,
        productName: license.product.name,
        productSlug: license.product.slug,
        plan: license.plan,
        status: normalizeLicenseStatus(license.status, license.expiresAt),
        version: latest?.publishedAt ? `Build ${latest.publishedAt.toISOString().slice(0, 10)}` : "Stable",
        checksum,
        releaseTitle: latest?.title || "Latest stable release",
        releaseDate: latest?.publishedAt || license.product.lastUpdateAt || license.createdAt,
        downloadUrl: license.downloadUrl || license.product.defaultLoaderUrl || null,
      };
    });

    const activityLog = [
      ...recentOrders.map((order) => ({
        id: `order-${order.id}`,
        type: "ORDER",
        title: `Order ${order.status.toLowerCase()} for $${Number(order.totalAmount || 0).toFixed(2)}`,
        description: order.customerNote
          ? `${order.items.length} item${order.items.length === 1 ? "" : "s"} purchased • Note left by customer`
          : `${order.items.length} item${order.items.length === 1 ? "" : "s"} purchased`,
        createdAt: order.createdAt,
      })),
      ...recentTransactions.map((transaction) => ({
        id: `txn-${transaction.id}`,
        type: "BALANCE",
        title: `${transaction.type === "CREDIT" ? "Balance credited" : "Balance deducted"}: $${Number(transaction.amount || 0).toFixed(2)}`,
        description: transaction.reason || "Wallet activity",
        createdAt: transaction.createdAt,
      })),
      ...tickets.map((ticket) => ({
        id: `ticket-${ticket.id}`,
        type: "TICKET",
        title: `Ticket #${ticket.ticketNumber} is ${String(ticket.status || "").toLowerCase()}`,
        description: ticket.subject,
        createdAt: ticket.updatedAt,
      })),
      ...topups.map((topup) => ({
        id: `topup-${topup.id}`,
        type: "TOPUP",
        title: `Top-up request ${String(topup.status || "").toLowerCase()}`,
        description: `$${Number(topup.amount || 0).toFixed(2)} via ${topup.senderBankName}`,
        createdAt: topup.updatedAt,
      })),
      ...licenses.map((license) => ({
        id: `license-${license.id}`,
        type: "LICENSE",
        title: `${license.product.name} license ${normalizeLicenseStatus(license.status, license.expiresAt).toLowerCase()}`,
        description: license.expiresAt ? `Expires on ${license.expiresAt.toISOString()}` : "Lifetime access",
        createdAt: license.createdAt,
      })),
    ]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 15);

    const accountAlerts = licenses
      .filter((license) => {
        if (!license.expiresAt) return false;
        const diff = license.expiresAt.getTime() - Date.now();
        return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
      })
      .map((license) => ({
        type: "RENEWAL",
        title: `${license.product.name} expires soon`,
        description: `Auto-renew recommendation sent for your ${license.plan.toLowerCase()} plan.`,
        channel: customer.email,
        expiresAt: license.expiresAt,
      }));

    return NextResponse.json({
      success: true,
      data: {
        customer,
        stats: {
          balance: customer.balance,
          activeCheats: activeLicenses,
          totalOrders,
          deliveredOrders,
          pendingPayments: pendingTopups,
          pendingDeliveries,
          totalSpent,
          openTickets,
          ownedProducts: ownedProducts.length,
          approvedReviews,
        },
        recentOrders: recentOrders.map((order) => ({
          ...order,
          timeline: parseOrderTimeline(order.timeline),
        })),
        recentTransactions,
        leaderboard: leaderboard.map((item, index) => ({
          rank: index + 1,
          id: item.id,
          username: item.username,
          totalSpent: item.totalSpent,
        })),
        rank: {
          currentTier,
          spendingRank: spendingRank >= 0 ? spendingRank + 1 : null,
          orderRank: orderRank >= 0 ? orderRank + 1 : null,
          nextTier: nextTier ? nextTier.label : null,
          amountToNextTier: nextTier ? Math.max(0, nextTier.minSpent - totalSpent) : 0,
        },
        security: {
          twoFactorEnabled: customer.twoFactorEnabled,
          lastLoginAt: customer.lastLoginAt,
          sessionIssuedAt: new Date(payload.iat * 1000).toISOString(),
          sessionExpiresAt: new Date(payload.exp * 1000).toISOString(),
        },
        activityLog,
        accountAlerts,
        downloadCenter,
        communitySummary: {
          online: Math.max(12, Math.min(communityCount * 3, 128)),
          messages: communityCount,
          latestAnnouncements: announcements,
          upcomingEvents: [
            { title: "Weekly release recap", startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
            { title: "Community Q&A", startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() },
          ],
        },
        checkoutRecommendations: {
          couponHint: totalSpent >= 150 ? "LOYALTY10" : "WELCOME5",
          bundles: Array.from(ownedProductIds).length >= 2 ? ["Elite Support Bundle", "VIP Delivery Queue"] : ["Starter Bundle", "Setup Assistance"],
          suggestedAddOns: licenses.slice(0, 3).map((license) => `${license.product.name} premium setup guide`),
        },
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
