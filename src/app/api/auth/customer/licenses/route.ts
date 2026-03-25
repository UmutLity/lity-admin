import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { verifyCustomerToken, getCustomerTokenFromRequest } from "@/lib/customer-auth";

const claimSchema = z.object({
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function getDisplayStatus(status: string, expiresAt: Date | null) {
  if (status === "REVOKED") return "REVOKED";
  if (expiresAt && expiresAt.getTime() < Date.now()) return "EXPIRED";
  return status;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(req.headers.get("origin")),
  });
}

export async function GET(req: NextRequest) {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401, headers: corsHeaders });

    const licenses = await prisma.license.findMany({
      where: { customerId: payload.id },
      include: {
        product: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = licenses.map((item) => ({
      id: item.id,
      key: item.key,
      plan: item.plan,
      status: getDisplayStatus(item.status, item.expiresAt),
      rawStatus: item.status,
      note: item.note,
      downloadUrl: item.downloadUrl,
      downloadCount: item.downloadCount,
      lastDownloadedAt: item.lastDownloadedAt,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
      product: item.product,
    }));

    return NextResponse.json({ success: true, data }, { headers: corsHeaders });
  } catch (error) {
    console.error("GET /api/auth/customer/licenses error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req: NextRequest) {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  try {
    const token = getCustomerTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    const payload = verifyCustomerToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401, headers: corsHeaders });

    const body = await req.json();
    const validation = claimSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: "License key is required" }, { status: 400, headers: corsHeaders });
    }

    const key = validation.data.key.trim();
    const license = await prisma.license.findUnique({
      where: { key },
      include: {
        product: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
    });

    if (!license) {
      return NextResponse.json({ success: false, error: "License not found" }, { status: 404, headers: corsHeaders });
    }

    if (license.customerId && license.customerId !== payload.id) {
      return NextResponse.json({ success: false, error: "This license is already assigned to another account" }, { status: 409, headers: corsHeaders });
    }

    if (license.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "This license is not active" }, { status: 403, headers: corsHeaders });
    }

    if (license.expiresAt && license.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: "This license has expired" }, { status: 403, headers: corsHeaders });
    }

    if (!license.product.isActive) {
      return NextResponse.json({ success: false, error: "This product is not currently available" }, { status: 403, headers: corsHeaders });
    }

    const updated = license.customerId === payload.id
      ? license
      : await prisma.license.update({
          where: { id: license.id },
          data: { customerId: payload.id },
          include: {
            product: {
              select: { id: true, name: true, slug: true, isActive: true },
            },
          },
        });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        key: updated.key,
        plan: updated.plan,
        status: getDisplayStatus(updated.status, updated.expiresAt),
        product: updated.product,
      },
      message: license.customerId === payload.id ? "License already linked to your account" : "License linked to your account",
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("POST /api/auth/customer/licenses error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500, headers: corsHeaders });
  }
}
