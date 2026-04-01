import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const adminId = (session.user as any).id as string;
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    await req.json().catch(() => ({}));

    const request = await prisma.topUpRequest.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        amount: true,
        customerId: true,
        customer: {
          select: { id: true, balance: true, isActive: true, role: true },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    if (request.status !== "PENDING") {
      return NextResponse.json({ success: false, error: "Request already processed" }, { status: 409 });
    }

    if (!request.customer?.isActive || request.customer.role === "BANNED") {
      return NextResponse.json({ success: false, error: "Customer is not eligible for balance top-up" }, { status: 400 });
    }

    const before = Number(request.customer.balance || 0);
    const amount = Number(request.amount || 0);
    const after = before + amount;

    await prisma.customer.update({
      where: { id: request.customer.id },
      data: { balance: after },
      select: { id: true },
    });

    const updatedRequest = await prisma.topUpRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED" },
      select: {
        id: true,
        customerId: true,
        amount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    try {
      await prisma.balanceTransaction.create({
        data: {
          customerId: request.customer.id,
          type: "CREDIT",
          amount,
          balanceBefore: before,
          balanceAfter: after,
          reason: `Manual top-up approved (request #${request.id.slice(-8)})`,
          adminUserId: adminId,
        },
      });
    } catch (error) {
      console.error("Optional balance transaction write failed during top-up approval:", error);
    }

    await createAuditLog({
      userId: adminId,
      action: "TOPUP_APPROVE",
      entity: "TopUpRequest",
      entityId: params.id,
      before: { status: "PENDING", balanceBefore: before },
      after: { status: "APPROVED", balanceAfter: after, amount },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, data: updatedRequest });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("Forbidden")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    console.error("PATCH /api/topup/[id]/approve error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
