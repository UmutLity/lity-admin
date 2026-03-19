import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { changelogSchema } from "@/lib/validations/changelog";
import { createAuditLog } from "@/lib/audit";
import { sendChangelogToDiscord } from "@/lib/discord";
import { getClientIp } from "@/lib/ip-utils";

// GET /api/admin/changelog
export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const changelogs = await prisma.changelog.findMany({
      include: {
        products: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: changelogs });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/changelog
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "EDITOR"]);
    const body = await req.json();
    const ip = getClientIp(req);
    const userId = (session.user as any).id;

    const validation = changelogSchema.safeParse(body);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((e) => {
        errors[e.path.join(".")] = e.message;
      });
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const { productIds, ...data } = validation.data;
    const isPublished = !data.isDraft;

    const changelog = await prisma.changelog.create({
      data: {
        ...data,
        publishedAt: data.isDraft ? null : new Date(),
        products: productIds?.length
          ? { create: productIds.map((id) => ({ productId: id })) }
          : undefined,
      },
      include: { products: { include: { product: true } } },
    });

    // Update Last Update for related products if published
    if (isPublished && productIds && productIds.length > 0) {
      const publishedAt = changelog.publishedAt || new Date();
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: {
          lastUpdateAt: publishedAt,
          lastUpdateChangelogId: changelog.id,
        },
      });
    }

    await createAuditLog({
      userId,
      action: isPublished ? "PUBLISH" : "CREATE",
      entity: "Changelog",
      entityId: changelog.id,
      after: { title: changelog.title, type: changelog.type, isDraft: changelog.isDraft },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    // Send to Discord if published
    if (isPublished) {
      sendChangelogToDiscord(changelog.id).catch((err) => {
        console.error("Discord webhook error:", err);
      });
    }

    return NextResponse.json({ success: true, data: changelog }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("POST /api/admin/changelog error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
