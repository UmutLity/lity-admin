import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// GET /api/admin/resellers - List all resellers with sale counts
export async function GET() {
  try {
    await requireRole(["ADMIN"]);

    const resellers = await prisma.reseller.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { sales: true } },
      },
    });

    const data = resellers.map((r) => {
      const { apiKey, _count, ...rest } = r;
      return {
        ...rest,
        saleCount: _count.sales,
        apiKeyMasked: apiKey ? `••••••••${apiKey.slice(-4)}` : null,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("Resellers GET error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/resellers - Create reseller
export async function POST(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);

    const body = await req.json();
    const { name, email, discountPercent } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 }
      );
    }

    const apiKey = randomUUID();
    const discount = typeof discountPercent === "number" ? discountPercent : parseFloat(discountPercent) || 0;

    const reseller = await prisma.reseller.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        discountPercent: discount,
        apiKey,
      },
    });

    return NextResponse.json({ success: true, data: reseller }, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "Unauthorized")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (err.message?.includes("Forbidden"))
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    console.error("Resellers POST error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
