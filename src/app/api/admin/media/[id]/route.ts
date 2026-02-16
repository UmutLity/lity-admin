import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { deleteFile } from "@/lib/upload";
import { createAuditLog } from "@/lib/audit";

// DELETE /api/admin/media/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "EDITOR"]);

    const media = await prisma.media.findUnique({ where: { id: params.id } });
    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    // Check if media is used by any product
    const usedBy = await prisma.productImage.count({ where: { mediaId: params.id } });
    if (usedBy > 0) {
      return NextResponse.json({ error: "Bu görsel bir ürün tarafından kullanılıyor. Önce üründen kaldırın." }, { status: 400 });
    }

    await deleteFile(media.url);
    await prisma.media.delete({ where: { id: params.id } });

    await createAuditLog({
      userId: (session.user as any).id,
      action: "DELETE",
      entity: "Media",
      entityId: params.id,
      before: { filename: media.filename, url: media.url },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("DELETE /api/admin/media/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
