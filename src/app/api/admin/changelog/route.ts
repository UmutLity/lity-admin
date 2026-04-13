import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { changelogSchema } from "@/lib/validations/changelog";
import { createAuditLog } from "@/lib/audit";
import { sendChangelogToDiscord } from "@/lib/discord";
import { getClientIp } from "@/lib/ip-utils";

export const dynamic = "force-dynamic";

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
    const publishAt = data.isDraft
      ? null
      : (data.publishedAt ? new Date(data.publishedAt) : new Date());
    const isPublishedNow = !!publishAt && publishAt.getTime() <= Date.now();
    const isScheduled = !!publishAt && publishAt.getTime() > Date.now();

    const changelog = await prisma.changelog.create({
      data: {
        ...data,
        publishedAt: publishAt,
        products: productIds?.length
          ? { create: productIds.map((id) => ({ productId: id })) }
          : undefined,
      },
      include: { products: { include: { product: true } } },
    });

    // Update Last Update for related products if published
    if (isPublishedNow && productIds && productIds.length > 0) {
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
      action: isPublishedNow ? "PUBLISH" : "CREATE",
      entity: "Changelog",
      entityId: changelog.id,
      after: { title: changelog.title, type: changelog.type, isDraft: changelog.isDraft, isScheduled },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    // Send to Discord if published
    if (isPublishedNow) {
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
