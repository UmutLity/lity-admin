import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { blogSchema } from "@/lib/validations/blog";
import { createAuditLog } from "@/lib/audit";
import { slugify } from "@/lib/utils";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
    const post = await prisma.blogPost.findUnique({
      where: { id: params.id },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: post });
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
    const parsed = blogSchema.safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        errors[e.path.join(".")] = e.message;
      });
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const existing = await prisma.blogPost.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = parsed.data;
    const normalizedSlug = slugify(data.slug || data.title);
    const slugOwner = await prisma.blogPost.findUnique({ where: { slug: normalizedSlug } });
    if (slugOwner && slugOwner.id !== existing.id) {
      return NextResponse.json({ error: "Slug is already in use", errors: { slug: "Slug is already in use" } }, { status: 409 });
    }

    const nextDraft = data.isDraft;
    const post = await prisma.blogPost.update({
      where: { id: params.id },
      data: {
        title: data.title.trim(),
        slug: normalizedSlug,
        excerpt: data.excerpt?.trim() || null,
        content: data.content,
        coverImageUrl: data.coverImageUrl?.trim() || null,
        authorName: data.authorName.trim(),
        isDraft: nextDraft,
        publishedAt: nextDraft ? null : existing.publishedAt || new Date(),
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    await createAuditLog({
      userId: (session.user as any).id,
      action: existing.isDraft && !post.isDraft ? "PUBLISH" : "UPDATE",
      entity: "BlogPost",
      entityId: post.id,
      before: { title: existing.title, slug: existing.slug, isDraft: existing.isDraft },
      after: { title: post.title, slug: post.slug, isDraft: post.isDraft },
    });

    return NextResponse.json({ success: true, data: post });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "EDITOR"]);
    const existing = await prisma.blogPost.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.blogPost.delete({ where: { id: params.id } });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "BlogPost",
      entityId: params.id,
      before: { title: existing.title, slug: existing.slug },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

