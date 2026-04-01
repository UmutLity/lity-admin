import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { blogSchema } from "@/lib/validations/blog";
import { createAuditLog } from "@/lib/audit";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
    const posts = await prisma.blogPost.findMany({
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: posts });
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
    const parsed = blogSchema.safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        errors[e.path.join(".")] = e.message;
      });
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const data = parsed.data;
    const authorId = (session.user as any).id as string;
    const authorName = (data.authorName || (session.user?.name as string) || "Lity Team").trim();
    const normalizedSlug = slugify(data.slug || data.title);

    const existing = await prisma.blogPost.findUnique({ where: { slug: normalizedSlug } });
    if (existing) {
      return NextResponse.json({ error: "Slug is already in use", errors: { slug: "Slug is already in use" } }, { status: 409 });
    }

    const post = await prisma.blogPost.create({
      data: {
        title: data.title.trim(),
        slug: normalizedSlug,
        excerpt: data.excerpt?.trim() || null,
        content: data.content,
        coverImageUrl: data.coverImageUrl?.trim() || null,
        authorId,
        authorName,
        isDraft: data.isDraft,
        publishedAt: data.isDraft ? null : new Date(),
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    await createAuditLog({
      userId: authorId,
      action: data.isDraft ? "CREATE" : "PUBLISH",
      entity: "BlogPost",
      entityId: post.id,
      after: { title: post.title, slug: post.slug, isDraft: post.isDraft },
    });

    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("POST /api/admin/blog error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

