import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const adminId = (session.user as any).id as string;
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || undefined;
    const body = await req.json().catch(() => ({}));
    const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : "";

    const existing = await prisma.topUpRequest.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ success: false, error: "Request already processed" }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const request = await tx.topUpRequest.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          reviewedById: adminId,
          reviewNote: reviewNote || null,
          rejectedAt: new Date(),
          approvedAt: null,
        },
      });

      await tx.notification.create({
        data: {
          userId: request.customerId,
          type: "TOPUP_REJECTED",
          message: reviewNote
            ? `Your top-up request was rejected. Reason: ${reviewNote}`
            : "Your top-up request was rejected. Please review your payment details and try again.",
        },
      });

      return request;
    });

    await createAuditLog({
      userId: adminId,
      action: "TOPUP_REJECT",
      entity: "TopUpRequest",
      entityId: params.id,
      before: { status: "PENDING" },
      after: { status: "REJECTED", reviewNote: reviewNote || null },
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    console.error("PATCH /api/topup/[id]/reject error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
