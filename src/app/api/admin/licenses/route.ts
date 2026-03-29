import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

const licenseSchema = z.object({
  productId: z.string().cuid(),
  plan: z.enum(["DAILY", "LIFETIME"]).default("LIFETIME"),
  key: z.string().min(3).max(120).regex(/^[a-zA-Z0-9_.-]+$/, "License key can only contain letters, numbers, dot, underscore and dash").optional(),
  keys: z.array(z.string().min(3).max(120).regex(/^[a-zA-Z0-9_.-]+$/)).optional(),
  status: z.enum(["ACTIVE", "PENDING", "REVOKED"]).default("ACTIVE"),
  note: z.string().max(500).optional().nullable(),
}).refine((value) => Boolean(value.key || (value.keys && value.keys.length > 0)), {
  message: "At least one license key is required",
  path: ["key"],
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";

    const licenses = await prisma.license.findMany({
      where: search ? {
        OR: [
          { key: { contains: search, mode: "insensitive" } },
          { plan: { contains: search, mode: "insensitive" } },
          { note: { contains: search, mode: "insensitive" } },
          { product: { name: { contains: search, mode: "insensitive" } } },
          { customer: { username: { contains: search, mode: "insensitive" } } },
          { customer: { email: { contains: search, mode: "insensitive" } } },
        ],
      } : undefined,
      include: {
        product: {
          select: { id: true, name: true, slug: true },
        },
        customer: {
          select: { id: true, username: true, email: true, isActive: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: licenses });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("GET /api/admin/licenses error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const validation = licenseSchema.safeParse(body);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((entry) => {
        errors[entry.path.join(".")] = entry.message;
      });
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const data = validation.data;
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { id: true, name: true, slug: true, defaultLoaderUrl: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const inputKeys = Array.from(new Set((data.keys?.length ? data.keys : [data.key!]).map((item) => item.trim()).filter(Boolean)));
    const expiresAt = data.plan === "DAILY"
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : null;
    const duplicates = await prisma.license.findMany({
      where: { key: { in: inputKeys } },
      select: { key: true },
    });

    if (duplicates.length > 0) {
      return NextResponse.json({
        error: `These license keys are already in use: ${duplicates.map((item) => item.key).join(", ")}`,
      }, { status: 409 });
    }

    const created = await prisma.$transaction(
      inputKeys.map((licenseKey) => prisma.license.create({
        data: {
          customerId: null,
          productId: data.productId,
          plan: data.plan.toUpperCase(),
          key: licenseKey,
          status: data.status,
          downloadUrl: data.status === "ACTIVE" ? (product.defaultLoaderUrl || null) : null,
          note: data.note || null,
          expiresAt,
        },
        include: {
          product: { select: { id: true, name: true, slug: true } },
          customer: { select: { id: true, username: true, email: true, isActive: true } },
        },
      }))
    );

    for (const license of created) {
      await createAuditLog({
        userId: (session.user as any).id,
        action: "CREATE",
        entity: "License",
        entityId: license.id,
        after: {
          licenseKey: license.key,
          product: license.product.name,
          customer: license.customer?.username || null,
          status: license.status,
        },
      });
    }

    return NextResponse.json({ success: true, data: created, createdCount: created.length }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("POST /api/admin/licenses error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
