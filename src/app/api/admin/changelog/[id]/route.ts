import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { changelogSchema } from "@/lib/validations/changelog";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";
import { Prisma } from "@prisma/client";
import { dispatchChangelogReleaseAutomation } from "@/lib/release-automation";

export const dynamic = "force-dynamic";

function asKnownRequestError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error : null;
}

function isSchemaMismatchError(error: unknown) {
  const known = asKnownRequestError(error);
  return known?.code === "P2021" || known?.code === "P2022";
}

function normalizeProductIds(productIds?: string[]) {
  if (!Array.isArray(productIds)) return [];
  return Array.from(
    new Set(
      productIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );
}

async function resolveExistingProductIds(productIds: string[]) {
  if (!productIds.length) return [];
  try {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    return products.map((p) => p.id);
  } catch (error) {
    if (isSchemaMismatchError(error)) {
      console.warn("resolveExistingProductIds schema mismatch, skipping related products sync");
      return [];
    }
    throw error;
  }
}

async function syncRelatedProducts(changelogId: string, productIds: string[]) {
  const normalizedIds = normalizeProductIds(productIds);
  try {
    await prisma.changelogProduct.deleteMany({ where: { changelogId } });

    if (!normalizedIds.length) {
      return { attachedIds: [] as string[], relationUnavailable: false };
    }

    const existingIds = await resolveExistingProductIds(normalizedIds);
    if (!existingIds.length) {
      return { attachedIds: [] as string[], relationUnavailable: false };
    }

    await prisma.changelogProduct.createMany({
      data: existingIds.map((productId) => ({ changelogId, productId })),
      skipDuplicates: true,
    });

    return { attachedIds: existingIds, relationUnavailable: false };
  } catch (error) {
    const known = asKnownRequestError(error);
    if (isSchemaMismatchError(error) || known?.code === "P2003") {
      console.warn("syncRelatedProducts failed, skipping relation sync", {
        code: known?.code,
        meta: known?.meta,
      });
      return { attachedIds: [] as string[], relationUnavailable: true };
    }
    throw error;
  }
}

async function loadChangelogWithProducts(changelogId: string) {
  try {
    return await prisma.changelog.findUnique({
      where: { id: changelogId },
      include: { products: { include: { product: true } } },
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    const fallback = await prisma.changelog.findUnique({ where: { id: changelogId } });
    return fallback ? { ...fallback, products: [] } : null;
  }
}

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
    const now = Date.now();
    const publishAt = data.isDraft
      ? null
      : (data.publishedAt ? new Date(data.publishedAt) : (existing.publishedAt || new Date()));
    const wasLive = !existing.isDraft && !!existing.publishedAt && new Date(existing.publishedAt).getTime() <= now;
    const isLiveNow = !!publishAt && publishAt.getTime() <= now;
    const justPublishedNow = !wasLive && isLiveNow;
    const isScheduled = !!publishAt && publishAt.getTime() > now;

    const changelog = await prisma.changelog.update({
      where: { id: params.id },
      data: {
        ...data,
        publishedAt: publishAt,
      },
    });

    const relationResult = await syncRelatedProducts(changelog.id, productIds || []);
    const updated = await loadChangelogWithProducts(changelog.id);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Update Last Update for related products
    if (isLiveNow && relationResult.attachedIds.length > 0) {
      const publishedAt = changelog.publishedAt || new Date();
      try {
        await prisma.product.updateMany({
          where: { id: { in: relationResult.attachedIds } },
          data: {
            lastUpdateAt: publishedAt,
            lastUpdateChangelogId: changelog.id,
          },
        });
      } catch (error) {
        if (isSchemaMismatchError(error)) {
          console.warn("PUT /api/admin/changelog/[id] product last-update fields unavailable, skipping updateMany");
        } else {
          throw error;
        }
      }
    }

    await createAuditLog({
      userId,
      action: justPublishedNow ? "PUBLISH" : "UPDATE",
      entity: "Changelog",
      entityId: changelog.id,
      before: { title: existing.title, isDraft: existing.isDraft },
      after: {
        title: changelog.title,
        isDraft: changelog.isDraft,
        isScheduled,
        relatedProductsAttached: relationResult.attachedIds.length,
        relatedProductsUnavailable: relationResult.relationUnavailable,
      },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    // Run release automation for live changelogs (newly published or updated while live)
    if (isLiveNow) {
      console.log("[ReleaseAutomation] Changelog live update, dispatching:", changelog.id);
      try {
        const automation = await dispatchChangelogReleaseAutomation(changelog.id);
        console.log("[ReleaseAutomation] Result:", automation);
      } catch (err) {
        console.error("[ReleaseAutomation] Error:", err);
      }
    }

    return NextResponse.json({ success: true, data: updated });
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
