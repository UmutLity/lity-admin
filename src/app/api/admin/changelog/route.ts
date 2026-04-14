import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { changelogSchema } from "@/lib/validations/changelog";
import { createAuditLog } from "@/lib/audit";
import { sendChangelogToDiscord } from "@/lib/discord";
import { getClientIp } from "@/lib/ip-utils";
import { Prisma } from "@prisma/client";

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
      console.warn("resolveExistingProductIds schema mismatch, skipping related products attach");
      return [];
    }
    throw error;
  }
}

async function attachRelatedProducts(changelogId: string, productIds: string[]) {
  const normalizedIds = normalizeProductIds(productIds);
  if (!normalizedIds.length) {
    return { attachedIds: [] as string[], relationUnavailable: false };
  }

  const existingIds = await resolveExistingProductIds(normalizedIds);
  if (!existingIds.length) {
    return { attachedIds: [] as string[], relationUnavailable: false };
  }

  try {
    await prisma.changelogProduct.createMany({
      data: existingIds.map((productId) => ({ changelogId, productId })),
      skipDuplicates: true,
    });
    return { attachedIds: existingIds, relationUnavailable: false };
  } catch (error) {
    const known = asKnownRequestError(error);
    if (isSchemaMismatchError(error) || known?.code === "P2003") {
      console.warn("attachRelatedProducts failed, skipping relation attach", {
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
      },
    });

    const relationResult = await attachRelatedProducts(changelog.id, productIds || []);
    const created = await loadChangelogWithProducts(changelog.id);
    if (!created) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Update Last Update for related products if published
    if (isPublishedNow && relationResult.attachedIds.length > 0) {
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
          console.warn("POST /api/admin/changelog product last-update fields unavailable, skipping updateMany");
        } else {
          throw error;
        }
      }
    }

    await createAuditLog({
      userId,
      action: isPublishedNow ? "PUBLISH" : "CREATE",
      entity: "Changelog",
      entityId: changelog.id,
      after: {
        title: changelog.title,
        type: changelog.type,
        isDraft: changelog.isDraft,
        isScheduled,
        relatedProductsAttached: relationResult.attachedIds.length,
        relatedProductsUnavailable: relationResult.relationUnavailable,
      },
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    // Send to Discord if published
    if (isPublishedNow) {
      sendChangelogToDiscord(changelog.id).catch((err) => {
        console.error("Discord webhook error:", err);
      });
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("POST /api/admin/changelog error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
