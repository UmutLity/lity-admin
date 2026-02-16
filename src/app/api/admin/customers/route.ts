import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";

// GET /api/admin/customers - List all customers
export async function GET() {
  try {
    await requireAdmin();
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        createdByAdminId: true,
        mustChangePassword: true,
        _count: { select: { cartItems: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: customers });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/customers - Admin creates a new customer account
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const { email, username, password, role, isActive, mustChangePassword } = body;

    // Validation
    if (!email || !username || !password) {
      return NextResponse.json({ error: "Email, username and password are required" }, { status: 400 });
    }

    if (username.length < 3 || username.length > 30) {
      return NextResponse.json({ error: "Username must be 3-30 characters" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return NextResponse.json({ error: "Username can only contain letters, numbers, _ . -" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Check uniqueness
    const existingEmail = await prisma.customer.findUnique({ where: { email: email.toLowerCase() } });
    if (existingEmail) {
      return NextResponse.json({ error: "This email is already in use" }, { status: 409 });
    }

    const existingUsername = await prisma.customer.findUnique({ where: { username: username.toLowerCase() } });
    if (existingUsername) {
      return NextResponse.json({ error: "This username is already taken" }, { status: 409 });
    }

    // Hash password (12 rounds)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create customer
    const adminId = (session.user as any).id;
    const customer = await prisma.customer.create({
      data: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password: hashedPassword,
        role: role || "MEMBER",
        isActive: isActive !== undefined ? isActive : true,
        mustChangePassword: mustChangePassword || false,
        createdByAdminId: adminId,
      },
    });

    // Audit log
    await createAuditLog({
      userId: adminId,
      action: "CREATE",
      entity: "Customer",
      entityId: customer.id,
      after: {
        email: customer.email,
        username: customer.username,
        role: customer.role,
        isActive: customer.isActive,
        mustChangePassword: customer.mustChangePassword,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: customer.id,
        email: customer.email,
        username: customer.username,
        role: customer.role,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("POST /api/admin/customers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
