import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const tierRules = [
  { label: "Bronze", minSpent: 10, color: "amber" },
  { label: "Silver", minSpent: 25, color: "slate" },
  { label: "Gold", minSpent: 50, color: "yellow" },
  { label: "Platinum", minSpent: 100, color: "cyan" },
  { label: "Diamond", minSpent: 250, color: "sky" },
  { label: "Master", minSpent: 500, color: "violet" },
  { label: "Grandmaster", minSpent: 1000, color: "orange" },
  { label: "Legend", minSpent: 2500, color: "amber" },
  { label: "Mythic", minSpent: 5000, color: "rose" },
] as const;

function getTier(totalSpent: number) {
  let current = { label: "Unranked", minSpent: 0, color: "zinc" };
  for (const rule of tierRules) {
    if (totalSpent >= rule.minSpent) current = rule;
  }
  return current;
}

export async function GET() {
  try {
    await requireAdmin();

    const grouped = await prisma.order.groupBy({
      by: ["customerId"],
      where: {
        customerId: { not: null },
        status: { not: "CANCELED" },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });

    const rankedRows = grouped
      .map((row) => ({
        customerId: row.customerId as string,
        totalSpent: Number(row._sum.totalAmount || 0),
        orderCount: Number(row._count._all || 0),
      }))
      .filter((row) => row.totalSpent > 0);

    if (!rankedRows.length) {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalRankedUsers: 0,
            totalRevenue: 0,
            averageSpent: 0,
            topSpenderAmount: 0,
          },
          tiers: tierRules.map((rule) => ({
            ...rule,
            count: 0,
          })),
          leaderboard: [],
        },
      });
    }

    const customers = await prisma.customer.findMany({
      where: {
        id: { in: rankedRows.map((row) => row.customerId) },
        isActive: true,
        role: { not: "BANNED" },
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
    const leaderboard = rankedRows
      .filter((row) => customerMap.has(row.customerId))
      .map((row) => {
        const customer = customerMap.get(row.customerId)!;
        const tier = getTier(row.totalSpent);
        return {
          id: customer.id,
          username: customer.username || customer.email?.split("@")[0] || "Unknown",
          email: customer.email,
          createdAt: customer.createdAt,
          totalSpent: row.totalSpent,
          orderCount: row.orderCount,
          tier,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent || b.orderCount - a.orderCount || a.username.localeCompare(b.username))
      .map((row, index) => ({
        rank: index + 1,
        ...row,
      }));

    const totalRevenue = leaderboard.reduce((sum, row) => sum + row.totalSpent, 0);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRankedUsers: leaderboard.length,
          totalRevenue,
          averageSpent: leaderboard.length ? totalRevenue / leaderboard.length : 0,
          topSpenderAmount: leaderboard[0]?.totalSpent || 0,
        },
        tiers: tierRules.map((rule) => ({
          ...rule,
          count: leaderboard.filter((row) => row.tier.label === rule.label).length,
        })),
        leaderboard,
      },
    });
  } catch (error: any) {
    const message = String(error?.message || "");
    if (message.includes("Unauthorized")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/admin/leaderboard error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
