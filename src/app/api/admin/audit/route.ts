import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

// GET /api/admin/audit - List audit logs with filters
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "audit.view");
    if (!hasPerm) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50"), 100);
    const action = searchParams.get("action");
    const entity = searchParams.get("entity");
    const userFilter = searchParams.get("userId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const format = searchParams.get("format"); // "csv" for export

    const where: any = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (userFilter) where.userId = userFilter;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // CSV export
    if (format === "csv") {
      const logs = await prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 10000, // Max export
      });

      const csvHeader = "Date,User,Email,Action,Entity,EntityID,IP,UserAgent,Diff\n";
      const csvRows = logs.map((log) => {
        const date = log.createdAt.toISOString();
        const userName = log.user.name.replace(/,/g, ";");
        const email = log.user.email;
        const diff = (log.diff || "").replace(/,/g, ";").replace(/\n/g, " | ");
        const ip = log.ip || "";
        const ua = (log.userAgent || "").replace(/,/g, ";");
        return `${date},${userName},${email},${log.action},${log.entity},${log.entityId || ""},${ip},${ua},${diff}`;
      });

      const csv = csvHeader + csvRows.join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
        },
      });
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      meta: { total, page, pageSize },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
