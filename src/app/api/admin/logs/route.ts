import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

type LogType = "audit" | "payment" | "role";

function parseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractRoleTransition(entry: any) {
  const before = parseJson(entry.before);
  const after = parseJson(entry.after);

  if (after?.role?.from !== undefined || after?.role?.to !== undefined) {
    return {
      from: after?.role?.from ?? null,
      to: after?.role?.to ?? null,
    };
  }

  if (typeof before?.role === "string" || typeof after?.role === "string") {
    return {
      from: typeof before?.role === "string" ? before.role : null,
      to: typeof after?.role === "string" ? after.role : null,
    };
  }

  return { from: null, to: null };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const hasPerm = await hasPermission(userId, "audit.view");
    if (!hasPerm) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") || "audit") as LogType;
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "30", 10), 1), 100);
    const search = (searchParams.get("search") || "").trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const action = (searchParams.get("action") || "").trim();
    const entity = (searchParams.get("entity") || "").trim();
    const txType = (searchParams.get("txType") || "").trim();

    const createdAtFilter: any = {};
    if (dateFrom) createdAtFilter.gte = new Date(dateFrom);
    if (dateTo) createdAtFilter.lte = new Date(dateTo);
    const hasDateFilter = Object.keys(createdAtFilter).length > 0;

    if (type === "payment") {
      const where: any = {};
      if (hasDateFilter) where.createdAt = createdAtFilter;
      if (txType) where.type = txType;
      if (search) {
        where.OR = [
          { reason: { contains: search, mode: "insensitive" } },
          { orderId: { contains: search, mode: "insensitive" } },
          { customer: { username: { contains: search, mode: "insensitive" } } },
          { customer: { email: { contains: search, mode: "insensitive" } } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.balanceTransaction.findMany({
          where,
          include: {
            customer: {
              select: { id: true, username: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.balanceTransaction.count({ where }),
      ]);

      const adminIds = Array.from(new Set(rows.map((x) => x.adminUserId).filter((x): x is string => !!x)));
      const admins = adminIds.length
        ? await prisma.user.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const adminMap = new Map(admins.map((u) => [u.id, u]));

      const data = rows.map((x) => ({
        id: x.id,
        createdAt: x.createdAt,
        type: x.type,
        amount: x.amount,
        balanceBefore: x.balanceBefore,
        balanceAfter: x.balanceAfter,
        reason: x.reason,
        orderId: x.orderId,
        customer: x.customer,
        admin: x.adminUserId ? adminMap.get(x.adminUserId) || null : null,
      }));

      return NextResponse.json({ success: true, data, meta: { total, page, pageSize } });
    }

    if (type === "role") {
      const roleFilter: any = {
        OR: [
          { action: "ROLE_CHANGE" },
          { entity: "Role" },
          {
            entity: "Customer",
            OR: [
              { before: { contains: "\"role\"", mode: "insensitive" } },
              { after: { contains: "\"role\"", mode: "insensitive" } },
              { diff: { contains: "role", mode: "insensitive" } },
            ],
          },
        ],
      };

      const where: any = { AND: [roleFilter] };
      if (hasDateFilter) where.AND.push({ createdAt: createdAtFilter });
      if (search) {
        where.AND.push({
          OR: [
            { action: { contains: search, mode: "insensitive" } },
            { entity: { contains: search, mode: "insensitive" } },
            { before: { contains: search, mode: "insensitive" } },
            { after: { contains: search, mode: "insensitive" } },
            { diff: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        });
      }

      const [rows, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.auditLog.count({ where }),
      ]);

      const data = rows.map((x) => ({
        id: x.id,
        createdAt: x.createdAt,
        action: x.action,
        entity: x.entity,
        entityId: x.entityId,
        role: extractRoleTransition(x),
        before: x.before,
        after: x.after,
        diff: x.diff,
        user: x.user,
      }));

      return NextResponse.json({ success: true, data, meta: { total, page, pageSize } });
    }

    const where: any = {};
    if (hasDateFilter) where.createdAt = createdAtFilter;
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
        { before: { contains: search, mode: "insensitive" } },
        { after: { contains: search, mode: "insensitive" } },
        { diff: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: rows, meta: { total, page, pageSize } });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
