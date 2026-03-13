import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/categories - Public endpoint
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ success: true, data: categories });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}
