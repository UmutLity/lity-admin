import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { deleteReview, updateReview } from "@/lib/reviews-store";

export const dynamic = "force-dynamic";

// PUT /api/admin/reviews/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);

    const body = await req.json();
    if (body?.authorName !== undefined && !String(body.authorName).trim()) {
      return NextResponse.json({ success: false, error: "authorName cannot be empty" }, { status: 400 });
    }
    if (body?.content !== undefined && !String(body.content).trim()) {
      return NextResponse.json({ success: false, error: "content cannot be empty" }, { status: 400 });
    }
    const updated = await updateReview(params.id, body || {});
    if (!updated) return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/reviews/[id]
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "EDITOR"]);
    await deleteReview(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message?.includes("Forbidden")) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
