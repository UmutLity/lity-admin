import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateEncryptedTOTPSecret, generateTOTPUri, generateRecoveryCodes } from "@/lib/totp";
import { createAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/ip-utils";
import { hash } from "bcryptjs";

// POST /api/admin/users/[id]/two-factor - Enable 2FA (setup)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const sessionUserId = (session.user as any).id;

    // Users can only enable 2FA for themselves (or admin can do it for anyone)
    if (sessionUserId !== params.id && (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json({ success: false, error: "2FA already enabled" }, { status: 400 });
    }

    // Generate TOTP secret
    const { plain, encrypted } = generateEncryptedTOTPSecret();
    const uri = generateTOTPUri(plain, user.email);

    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes(10);
    const hashedCodes = await Promise.all(recoveryCodes.map((code) => hash(code, 10)));

    // Save (but don't enable yet - wait for verification)
    await prisma.user.update({
      where: { id: params.id },
      data: {
        twoFactorSecret: encrypted,
        recoveryCodes: JSON.stringify(hashedCodes),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        secret: plain,
        uri,
        recoveryCodes, // Show plain codes to user ONCE
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    console.error("POST /api/admin/users/[id]/two-factor error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/users/[id]/two-factor - Verify & activate 2FA
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const sessionUserId = (session.user as any).id;

    if (sessionUserId !== params.id && (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ success: false, error: "Verification code required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user || !user.twoFactorSecret) {
      return NextResponse.json({ success: false, error: "2FA not set up" }, { status: 400 });
    }

    // Verify code
    const { verifyTOTP } = await import("@/lib/totp");
    const isValid = verifyTOTP(user.twoFactorSecret, code);
    if (!isValid) {
      return NextResponse.json({ success: false, error: "Invalid verification code" }, { status: 400 });
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: params.id },
      data: { twoFactorEnabled: true },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      userId: sessionUserId,
      action: "2FA_ENABLE",
      entity: "User",
      entityId: params.id,
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id]/two-factor - Disable 2FA
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const sessionUserId = (session.user as any).id;

    if (sessionUserId !== params.id && (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: params.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        recoveryCodes: null,
      },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      userId: sessionUserId,
      action: "2FA_DISABLE",
      entity: "User",
      entityId: params.id,
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
