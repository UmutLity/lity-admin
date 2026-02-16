import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { uploadFile } from "@/lib/upload";
import { createAuditLog } from "@/lib/audit";

// GET /api/admin/media
export async function GET() {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
    const media = await prisma.media.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, data: media });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/media - Upload file
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "EDITOR"]);
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    const result = await uploadFile(file);

    const media = await prisma.media.create({
      data: {
        filename: result.filename,
        url: result.url,
        mimeType: result.mimeType,
        size: result.size,
      },
    });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "Media",
      entityId: media.id,
      after: { filename: media.filename, url: media.url },
    });

    return NextResponse.json({ success: true, data: media }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("POST /api/admin/media error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
