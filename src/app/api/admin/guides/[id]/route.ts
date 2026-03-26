import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { guideSchema } from "@/lib/validations/guide";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
    const guide = await prisma.guide.findUnique({
      where: { id: params.id },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });
    if (!guide) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: guide });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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

    const existing = await prisma.guide.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = parsed.data;
    const guide = await prisma.guide.update({
      where: { id: params.id },
      data: {
        title: data.title,
        body: data.body,
        productId: data.productId,
        isDraft: data.isDraft,
        publishedAt: data.isDraft ? null : (existing.publishedAt || new Date()),
      },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });

    await createAuditLog({
      userId: (session.user as any).id,
      action: existing.isDraft && !guide.isDraft ? "PUBLISH" : "UPDATE",
      entity: "Guide",
      entityId: guide.id,
      before: { title: existing.title, isDraft: existing.isDraft, productId: existing.productId },
      after: { title: guide.title, isDraft: guide.isDraft, productId: guide.productId },
    });

    return NextResponse.json({ success: true, data: guide });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "EDITOR"]);
    const existing = await prisma.guide.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.guide.delete({ where: { id: params.id } });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "Guide",
      entityId: params.id,
      before: { title: existing.title, productId: existing.productId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
