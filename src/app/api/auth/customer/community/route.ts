import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

const MAX_MESSAGE_LENGTH = 1000;

async function requireActiveCustomer(req: NextRequest) {
  const token = getCustomerTokenFromRequest(req);
  if (!token) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const payload = verifyCustomerToken(token);
  if (!payload) return { error: NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 }) };
  const customer = await prisma.customer.findUnique({
    where: { id: payload.id },
    select: { id: true, username: true, role: true, isActive: true },
  });
  if (!customer || !customer.isActive || customer.role === "BANNED") {
    return { error: NextResponse.json({ success: false, error: "Your account is not eligible." }, { status: 403 }) };
  }
  return { customer };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireActiveCustomer(req);
    if ("error" in auth) return auth.error;

    const [messages, rawAnnouncements, onlineRecent] = await Promise.all([
      prisma.communityMessage.findMany({
        include: {
          customer: { select: { id: true, username: true, role: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.adminNotification.findMany({
        where: { type: "SYSTEM", severity: { in: ["INFO", "WARNING"] } },
        orderBy: { createdAt: "desc" },
        take: 24,
        select: { id: true, title: true, message: true, createdAt: true, meta: true },
      }),
      prisma.communityMessage.findMany({
        where: { createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
        select: { customerId: true },
      }),
    ]);

    const online = new Set(onlineRecent.map((item) => item.customerId)).size;
    const announcements = rawAnnouncements
      .filter((item) => {
        try {
          const meta = item.meta ? JSON.parse(item.meta) : {};
          const hasTicketPayload = !!(meta?.ticketId || meta?.ticketNumber || meta?.fallback || meta?.channel === "tickets");
          if (hasTicketPayload) return false;
        } catch {}
        return true;
      })
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        createdAt: item.createdAt,
      }));

    return NextResponse.json({
      success: true,
      data: {
        online,
        announcements,
        messages: messages.reverse(),
      },
    });
  } catch (error) {
    console.error("GET /api/auth/customer/community error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireActiveCustomer(req);
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ success: false, error: "Message is required." }, { status: 400 });
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ success: false, error: `Message max length is ${MAX_MESSAGE_LENGTH}.` }, { status: 400 });
    }

    const created = await prisma.communityMessage.create({
      data: {
        customerId: auth.customer.id,
        message,
      },
      include: {
        customer: { select: { id: true, username: true, role: true, avatar: true } },
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/auth/customer/community error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
