import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";
import { buildReferralLink, encodeReferralCode } from "@/lib/referrals";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = verifyCustomerToken(token);
    if (!payload?.id) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

    const customer = await prisma.customer.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, isActive: true },
    });
    if (!customer || !customer.isActive) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    const notePattern = `ref_by:${customer.id}`;
    const [referredCustomers, totalRewards] = await Promise.all([
      prisma.customer.findMany({
        where: { adminNotes: { contains: notePattern } },
        select: { id: true, totalSpent: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.balanceTransaction.aggregate({
        where: {
          customerId: customer.id,
          type: "CREDIT",
          reason: { startsWith: "REFERRAL_BONUS:" },
        },
        _sum: { amount: true },
      }),
    ]);

    const successfulReferrals = referredCustomers.filter((row) => Number(row.totalSpent || 0) > 0).length;
    const inviteCode = encodeReferralCode(customer.id);
    const inviteLink = await buildReferralLink(customer.id);

    return NextResponse.json({
      success: true,
      data: {
        inviteCode,
        inviteLink,
        totalReferrals: referredCustomers.length,
        successfulReferrals,
        totalRewards: Number(totalRewards?._sum?.amount || 0),
      },
    });
  } catch (error) {
    console.error("GET /api/auth/customer/referral error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

