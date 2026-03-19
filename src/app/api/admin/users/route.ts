import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { hash } from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email("Geçerli bir email girin"),
  name: z.string().min(1, "İsim zorunlu"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  role: z.enum(["ADMIN", "EDITOR"]),
});

// GET /api/admin/users
export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ success: true, data: users });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/users
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();

    const validation = createUserSchema.safeParse(body);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((e) => { errors[e.path.join(".")] = e.message; });
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: validation.data.email } });
    if (existing) {
      return NextResponse.json({ error: "Bu email zaten kayıtlı" }, { status: 400 });
    }

    const hashedPassword = await hash(validation.data.password, 12);
    const user = await prisma.user.create({
      data: {
        ...validation.data,
        password: hashedPassword,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      after: { email: user.email, name: user.name, role: user.role },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
