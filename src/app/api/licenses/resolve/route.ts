import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const resolveSchema = z.object({
  key: z.string().min(3).max(120),
});

function buildCorsHeaders(origin: string | null) {
  const allowedOrigins = new Set([
    "https://litysoftware.com",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ]);

  const value = origin && allowedOrigins.has(origin) ? origin : "https://litysoftware.com";
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  try {
    const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
    const body = await req.json();
    const validation = resolveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ success: false, error: "License key is required" }, { status: 400, headers: corsHeaders });
    }

    const key = validation.data.key.trim();
    const license = await prisma.license.findUnique({
      where: { key },
      include: {
        customer: {
          select: { username: true, isActive: true, role: true },
        },
        product: {
          select: { name: true, slug: true, isActive: true },
        },
      },
    });

    if (!license) {
      return NextResponse.json({ success: false, error: "License not found" }, { status: 404, headers: corsHeaders });
    }

    if (license.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "This license is not active" }, { status: 403, headers: corsHeaders });
    }

    if (!license.downloadUrl) {
      return NextResponse.json({ success: false, error: "No download link assigned to this license yet" }, { status: 404, headers: corsHeaders });
    }

    if (license.expiresAt && license.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: "This license has expired" }, { status: 403, headers: corsHeaders });
    }

    if (license.customer && (!license.customer.isActive || license.customer.role === "BANNED")) {
      return NextResponse.json({ success: false, error: "This license owner is not allowed to download" }, { status: 403, headers: corsHeaders });
    }

    if (!license.product.isActive) {
      return NextResponse.json({ success: false, error: "This product is not currently available" }, { status: 403, headers: corsHeaders });
    }

    await prisma.license.update({
      where: { id: license.id },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        redirectUrl: license.downloadUrl,
        licenseKey: license.key,
        productName: license.product.name,
        customerName: license.customer?.username || null,
      },
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("POST /api/licenses/resolve error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500, headers: buildCorsHeaders(req.headers.get("origin")) });
  }
}
