import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { changelogSchema } from "@/lib/validations/changelog";
import { createAuditLog } from "@/lib/audit";
import { sendChangelogToDiscord } from "@/lib/discord";
import { getClientIp } from "@/lib/ip-utils";

// GET /api/admin/changelog/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
    const changelog = await prisma.changelog.findUnique({
      where: { id: params.id },
      include: {
        products: { include: { product: true } },
        webhookDeliveries: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!changelog) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: changelog });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/changelog/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "EDITOR"]);
    const body = await req.json();
    const ip = getClientIp(req);
    const userId = (session.user as any).id;

    const validation = changelogSchema.safeParse(body);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((e) => { errors[e.path.join(".")] = e.message; });
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const existing = await prisma.changelog.findUnique({
      where: { id: params.id },
      include: { products: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { productIds, ...data } = validation.data;
    const wasPublished = !existing.isDraft;
    const isNowPublished = !data.isDraft;
    const justPublished = !wasPublished && isNowPublished;

    const changelog = await prisma.changelog.update({
      where: { id: params.id },
      data: {
        ...data,
        publishedAt: data.isDraft ? null : (existing.publishedAt || new Date()),
        products: {
          deleteMany: {},
          create: productIds?.map((id) => ({ productId: id })) || [],
        },
      },
      include: { products: { include: { product: true } } },
    });

    // Update Last Update for related products
    if (isNowPublished && productIds && productIds.length > 0) {
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
      action: justPublished ? "PUBLISH" : "UPDATE",
      entity: "Changelog",
      entityId: changelog.id,
      before: { title: existing.title, isDraft: existing.isDraft },
      after: { title: changelog.title, isDraft: changelog.isDraft },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    // Send to Discord if just published
    if (justPublished) {
      console.log("[Discord] Changelog published, sending webhook for:", changelog.id);
      sendChangelogToDiscord(changelog.id)
        .then((result) => {
          if (result) {
            console.log("[Discord] Webhook result:", result.success ? "SUCCESS" : "FAILED", result);
          } else {
            console.log("[Discord] Webhook skipped (disabled or no URL)");
          }
        })
        .catch((err) => {
          console.error("[Discord] Webhook error:", err);
        });
    }

    return NextResponse.json({ success: true, data: changelog });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("PUT /api/admin/changelog/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/changelog/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "EDITOR"]);
    const existing = await prisma.changelog.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.changelog.delete({ where: { id: params.id } });

    const ip = getClientIp(req);
    await createAuditLog({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "Changelog",
      entityId: params.id,
      before: { title: existing.title },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
