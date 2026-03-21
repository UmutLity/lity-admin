import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

const licenseSchema = z.object({
  customerId: z.string().cuid().optional().nullable(),
  productId: z.string().cuid(),
  plan: z.string().min(1).max(40),
  key: z.string().min(3).max(120).regex(/^[a-zA-Z0-9_.-]+$/, "License key can only contain letters, numbers, dot, underscore and dash"),
  status: z.enum(["ACTIVE", "EXPIRED", "REVOKED"]).default("ACTIVE"),
  downloadUrl: z.string().url().refine((value) => {
    try {
      const url = new URL(value);
      return ["mega.nz", "www.mega.nz", "mega.co.nz", "www.mega.co.nz"].includes(url.hostname);
    } catch {
      return false;
    }
  }, "Download URL must be a valid Mega link"),
  expiresAt: z.string().datetime().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
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
    const licenseKey = data.key.trim();

    const existing = await prisma.license.findUnique({
      where: { key: licenseKey },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "This license key is already in use" }, { status: 409 });
    }

    const license = await prisma.license.create({
      data: {
        customerId: data.customerId || null,
        productId: data.productId,
        plan: data.plan.toUpperCase(),
        key: licenseKey,
        status: data.status,
        downloadUrl: data.downloadUrl,
        note: data.note || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, username: true, email: true, isActive: true } },
      },
    });

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

    return NextResponse.json({ success: true, data: license }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("POST /api/admin/licenses error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
