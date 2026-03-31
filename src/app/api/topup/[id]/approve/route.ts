import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

const AUTO_PROMOTE_ROLES = new Set(["MEMBER", "USER", "CUSTOMER"]);

function isSchemaMismatch(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("P2021") || message.includes("P2022");
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const adminId = (session.user as any).id as string;
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || undefined;
    await req.json().catch(() => ({}));

    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.topUpRequest.findUnique({
        where: { id: params.id },
        include: {
          customer: {
            select: { id: true, username: true, email: true, isActive: true, role: true, balance: true },
          },
        },
      });

      if (!request) throw new Error("NOT_FOUND");
      if (request.status !== "PENDING") throw new Error("ALREADY_PROCESSED");
      if (!request.customer.isActive || request.customer.role === "BANNED") throw new Error("CUSTOMER_NOT_ELIGIBLE");

      const before = Number(request.customer.balance || 0);
      const amount = Number(request.amount || 0);
      const after = before + amount;
      const normalizedRole = String(request.customer.role || "").toUpperCase();
      const shouldPromoteToCustomer = AUTO_PROMOTE_ROLES.has(normalizedRole);

      await tx.customer.update({
        where: { id: request.customer.id },
        data: {
          balance: after,
          ...(shouldPromoteToCustomer ? { role: "CUSTOMER" } : {}),
        },
      });

      const updatedRequest = await tx.topUpRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
        },
      });

      return { request, updatedRequest, before, after };
    });

    try {
      await prisma.balanceTransaction.create({
        data: {
          customerId: result.request.customer.id,
          type: "CREDIT",
          amount: Number(result.request.amount || 0),
          balanceBefore: result.before,
          balanceAfter: result.after,
          reason: `Manual top-up approved (request #${result.request.id.slice(-8)})`,
          adminUserId: adminId,
        },
      });
    } catch (error) {
      if (!isSchemaMismatch(error)) {
        console.error("Failed to create balance transaction for top-up approval:", error);
      }
    }

    await createAuditLog({
      userId: adminId,
      action: "TOPUP_APPROVE",
      entity: "TopUpRequest",
      entityId: params.id,
      before: { status: "PENDING" },
      after: {
        status: "APPROVED",
        customerId: result.request.customerId,
        amount: result.request.amount,
        balanceBefore: result.before,
        balanceAfter: result.after,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, data: result.updatedRequest });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    if (error.message === "ALREADY_PROCESSED") return NextResponse.json({ success: false, error: "Request already processed" }, { status: 409 });
    if (error.message === "CUSTOMER_NOT_ELIGIBLE") return NextResponse.json({ success: false, error: "Customer is not eligible for balance top-up" }, { status: 400 });
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("PATCH /api/topup/[id]/approve error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
