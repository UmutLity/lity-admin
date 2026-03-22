import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

function safeJsonParse(input: string | null) {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function matchesQuery(ticket: any, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [
    ticket.subject,
    ticket.message,
    ticket.email,
    ticket.discordUsername,
    ticket.product?.name,
  ].some((value) => typeof value === "string" && value.toLowerCase().includes(needle));
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const q = (url.searchParams.get("q") || "").trim();

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (q) {
      where.OR = [
        { subject: { contains: q, mode: "insensitive" } },
        { message: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { discordUsername: { contains: q, mode: "insensitive" } },
      ];
    }

    let dbTickets: any[] = [];
    try {
      dbTickets = await prisma.supportTicket.findMany({
        where,
        include: {
          product: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (ticketError: any) {
      const code = ticketError?.code || "";
      const messageText = String(ticketError?.message || "").toLowerCase();
      const isMissingSupportTable =
        code === "P2021" ||
        code === "P2022" ||
        messageText.includes("supportticket");
      if (!isMissingSupportTable) throw ticketError;
    }

    const notifications = await prisma.adminNotification.findMany({
      where: { type: "SYSTEM" },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const fallbackTickets = notifications
      .map((notification) => {
        const meta = safeJsonParse(notification.meta);
        const isFallback = !!meta?.fallback || /support request/i.test(notification.title);
        if (!isFallback) return null;

        const ticketNumberFromTitle = (() => {
          const match = notification.title.match(/#(\d+)/);
          return match ? Number(match[1]) : undefined;
        })();

        return {
          id: `fallback-${notification.id}`,
          isFallback: true,
          ticketNumber: Number(meta?.ticketNumber || ticketNumberFromTitle || Date.parse(notification.createdAt.toString())),
          productId: null,
          product: meta?.productName ? { name: meta.productName, slug: meta.productSlug || null } : null,
          contactType: meta?.contactType || (meta?.email ? "EMAIL" : "DISCORD"),
          email: meta?.email || null,
          discordUsername: meta?.discordUsername || null,
          subject: meta?.subject || notification.title,
          message: meta?.message || notification.message || "Support request received via fallback mode.",
          status: "OPEN",
          priority: "NORMAL",
          source: "FALLBACK_NOTIFICATION",
          adminNotes: "Read-only record generated from notification fallback.",
          createdAt: notification.createdAt,
          updatedAt: notification.createdAt,
        };
      })
      .filter((ticket): ticket is any => !!ticket);

    const fallbackFiltered = fallbackTickets.filter((ticket) => {
      if (status && status !== "ALL" && status !== "OPEN") return false;
      return matchesQuery(ticket, q);
    });

    const dbTicketNumbers = new Set(dbTickets.map((ticket) => ticket.ticketNumber));
    const merged = [
      ...dbTickets,
      ...fallbackFiltered.filter((ticket) => !dbTicketNumbers.has(ticket.ticketNumber)),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return NextResponse.json({ success: true, data: merged });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
