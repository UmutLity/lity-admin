import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { guideSchema } from "@/lib/validations/guide";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
    const guides = await prisma.guide.findMany({
      include: { product: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: guides });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "EDITOR"]);
    const body = await req.json();
    const parsed = guideSchema.safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        errors[e.path.join(".")] = e.message;
      });
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const data = parsed.data;
    const product = await prisma.product.findUnique({ where: { id: data.productId }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const guide = await prisma.guide.create({
      data: {
        title: data.title,
        body: data.body,
        productId: data.productId,
        isDraft: data.isDraft,
        publishedAt: data.isDraft ? null : new Date(),
      },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });

    await createAuditLog({
      userId: (session.user as any).id,
      action: data.isDraft ? "CREATE" : "PUBLISH",
      entity: "Guide",
      entityId: guide.id,
      after: { title: guide.title, isDraft: guide.isDraft, productId: guide.productId },
    });

    return NextResponse.json({ success: true, data: guide }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
