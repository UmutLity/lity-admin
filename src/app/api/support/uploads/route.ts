import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/upload";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";
import prisma from "@/lib/prisma";

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

function corsHeaders(req?: NextRequest) {
  const origin = req?.headers.get("origin") || "";
  const allowed = new Set([
    "https://litysoftware.com",
    "https://www.litysoftware.com",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ]);
  const allowOrigin = allowed.has(origin) ? origin : "https://litysoftware.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

async function requireEligibleCustomer(req: NextRequest) {
  const token = getCustomerTokenFromRequest(req);
  if (!token) {
    return {
      error: NextResponse.json({ success: false, error: "Login required." }, { status: 401, headers: corsHeaders(req) }),
    };
  }

  const tokenPayload = verifyCustomerToken(token);
  if (!tokenPayload) {
    return {
      error: NextResponse.json({ success: false, error: "Session expired. Please login again." }, { status: 401, headers: corsHeaders(req) }),
    };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: tokenPayload.id },
    select: { id: true, isActive: true, role: true },
  });

  if (!customer || !customer.isActive || customer.role === "BANNED") {
    return {
      error: NextResponse.json({ success: false, error: "Your account is not eligible to upload files." }, { status: 403, headers: corsHeaders(req) }),
    };
  }

  return { customer };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireEligibleCustomer(req);
    if ("error" in auth) return auth.error;

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Attachment file is required." }, { status: 400, headers: corsHeaders(req) });
    }

    if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
      return NextResponse.json({
        success: false,
        error: "Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, PDF, TXT, ZIP.",
      }, { status: 400, headers: corsHeaders(req) });
    }

    const uploaded = await uploadFile(file);

    return NextResponse.json({
      success: true,
      data: {
        filename: file.name,
        storedFilename: uploaded.filename,
        url: uploaded.url,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
      },
    }, { status: 201, headers: corsHeaders(req) });
  } catch (error: any) {
    console.error("POST /api/support/uploads error:", error);
    return NextResponse.json({ success: false, error: error?.message || "Upload failed" }, { status: 500, headers: corsHeaders(req) });
  }
}
