import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

export const dynamic = "force-dynamic";

const AUTO_PROMOTE_ROLES = new Set(["MEMBER", "USER", "CUSTOMER"]);

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const status = String(searchParams.get("status") || "ALL").toUpperCase();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)));
    const q = String(searchParams.get("q") || "").trim();

    const where: any = {};
    if (status !== "ALL") where.status = status;
    if (q) {
      where.OR = [
        { senderName: { contains: q, mode: "insensitive" } },
        { senderBankName: { contains: q, mode: "insensitive" } },
        { customer: { username: { contains: q, mode: "insensitive" } } },
        { customer: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.topUpRequest.findMany({
        where,
        select: {
          id: true,
          customerId: true,
          senderName: true,
          senderBankName: true,
          amount: true,
          note: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          customer: { select: { id: true, username: true, email: true, balance: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }).then((legacyRows) =>
        legacyRows.map((row) => ({
          ...row,
          proofImageUrl: null,
          reviewedById: null,
          reviewedBy: null,
          reviewNote: null,
          approvedAt: null,
          rejectedAt: null,
        }))
      ),
      prisma.topUpRequest.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("GET /api/admin/topup-requests error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const adminId = (session.user as any).id as string;
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || undefined;
    const body = await req.json();

    const id = String(body.id || "").trim();
    const action = String(body.action || "").toUpperCase();
    const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : "";

    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    if (!["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ success: false, error: "action must be APPROVE or REJECT" }, { status: 400 });
    }

    if (action === "APPROVE") {
      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.topUpRequest.findUnique({
          where: { id },
          select: {
            id: true,
            customerId: true,
            amount: true,
            status: true,
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
          select: { id: true },
        });

        await tx.balanceTransaction.create({
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

        const updatedRequest = await tx.topUpRequest.update({
          where: { id: request.id },
          data: {
            status: "APPROVED",
          },
        });

        return { request, updatedRequest, before, after };
      });

      await createAuditLog({
        userId: adminId,
        action: "TOPUP_APPROVE",
        entity: "TopUpRequest",
        entityId: id,
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
    }

    const existing = await prisma.topUpRequest.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ success: false, error: "Request already processed" }, { status: 409 });
    }

    const updated = await prisma.topUpRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
      },
    });

    await createAuditLog({
      userId: adminId,
      action: "TOPUP_REJECT",
      entity: "TopUpRequest",
      entityId: id,
      before: { status: "PENDING" },
      after: { status: "REJECTED", reviewNote: reviewNote || null },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    if (error.message === "ALREADY_PROCESSED") return NextResponse.json({ success: false, error: "Request already processed" }, { status: 409 });
    if (error.message === "CUSTOMER_NOT_ELIGIBLE") return NextResponse.json({ success: false, error: "Customer is not eligible for balance top-up" }, { status: 400 });
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("PATCH /api/admin/topup-requests error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
