import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/admin/resellers/[id] - Fetch reseller with full API key (for copy)
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["ADMIN"]);

    const { id } = await params;
    const reseller = await prisma.reseller.findUnique({
      where: { id },
      include: { _count: { select: { sales: true } } },
    });

    if (!reseller) {
      return NextResponse.json({ success: false, error: "Reseller not found" }, { status: 404 });
    }

    const { _count, ...r } = reseller;
    return NextResponse.json({
      success: true,
      data: { ...r, saleCount: _count.sales },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("Reseller GET error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/resellers/[id] - Update reseller
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["ADMIN"]);

    const { id } = await params;
    const body = await req.json();
    const { name, email, discountPercent, isActive } = body;

    const existing = await prisma.reseller.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Reseller not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (discountPercent !== undefined) data.discountPercent = discountPercent;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.reseller.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("Reseller PUT error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/resellers/[id] - Regenerate API key
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["ADMIN"]);

    const { id } = await params;

    const existing = await prisma.reseller.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Reseller not found" }, { status: 404 });
    }

    const newApiKey = randomUUID();
    const updated = await prisma.reseller.update({
      where: { id },
      data: { apiKey: newApiKey },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("Reseller regenerate error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/resellers/[id] - Delete reseller
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(["ADMIN"]);

    const { id } = await params;

    const existing = await prisma.reseller.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Reseller not found" }, { status: 404 });
    }

    await prisma.reseller.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("Reseller DELETE error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
