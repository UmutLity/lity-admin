import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCustomerToken, getCustomerTokenFromRequest } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ success: false, error: "Token required" }, { status: 401 });
    }

    const payload = verifyCustomerToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: "Invalid or expired token" }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        twoFactorEnabled: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }

    // Check if banned
    if (customer.role === "BANNED") {
      return NextResponse.json({ success: false, error: "Your account has been suspended" }, { status: 403 });
    }

    if (!customer.isActive) {
      return NextResponse.json({ success: false, error: "Your account has been deactivated" }, { status: 403 });
    }

    let balance = 0;
    let totalSpent = 0;
    const financial = await prisma.customer
      .findUnique({
        where: { id: customer.id },
        select: { balance: true, totalSpent: true },
      })
      .catch((error) => {
        console.warn("Customer financial fields unavailable in /me:", error);
        return null;
      });
    if (financial) {
      balance = Number(financial.balance || 0);
      totalSpent = Number(financial.totalSpent || 0);
    }

    const ownedRoles = await prisma.license.findMany({
      where: {
        customerId: customer.id,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        product: { accessRoleKey: { not: null } },
      },
      select: { product: { select: { accessRoleKey: true, name: true, slug: true } } },
      distinct: ["productId"],
    });

    const ownedProductRoles = ownedRoles
      .map((item) => ({
        roleKey: item.product.accessRoleKey!,
        productName: item.product.name,
        productSlug: item.product.slug,
      }))
      .filter((item) => !!item.roleKey);

    const [recentOrders, recentTickets] = await Promise.all([
      prisma.order.findMany({
        where: { customerId: customer.id },
        select: { id: true, status: true, totalAmount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).catch(() => []),
      prisma.supportTicket.findMany({
        where: {
          OR: [
            { email: { equals: customer.email, mode: "insensitive" } },
            { discordUsername: { equals: customer.username, mode: "insensitive" } },
          ],
        },
        select: { id: true, ticketNumber: true, subject: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }).catch(() => []),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...customer,
        balance,
        totalSpent,
        security: {
          twoFactorEnabled: customer.twoFactorEnabled,
          lastLoginAt: customer.lastLoginAt,
          sessionIssuedAt: new Date(payload.iat * 1000).toISOString(),
          sessionExpiresAt: new Date(payload.exp * 1000).toISOString(),
        },
        recentOrders,
        recentTickets,
        ownedProductRoles,
      },
    });
  } catch (error: any) {
    console.error("Customer me error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
