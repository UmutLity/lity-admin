import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getClientIp } from "@/lib/ip-utils";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISCORD_REGEX = /^.{2,32}$/;

function corsHeaders(req?: NextRequest) {
  const origin = req?.headers.get("origin") || "";
  const allowed = new Set([
    "https://litysoftware.com",
    "https://www.litysoftware.com",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ]);
  const allowOrigin = allowed.has(origin) ? origin : "https://litysoftware.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

function safeArray(input: any): any[] {
  return Array.isArray(input) ? input : [];
}

function parseThreadFromAdminNotes(adminNotes: string | null) {
  if (!adminNotes) return { notes: null as string | null, replies: [] as any[] };
  try {
    const parsed = JSON.parse(adminNotes);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.replies)) {
      return {
        notes: typeof parsed.notes === "string" ? parsed.notes : null,
        replies: safeArray(parsed.replies),
      };
    }
  } catch {}
  return { notes: adminNotes, replies: [] as any[] };
}

async function requireEligibleCustomer(req: NextRequest) {
  const token = getCustomerTokenFromRequest(req);
  if (!token) {
    return { error: NextResponse.json({ success: false, error: "Login required." }, { status: 401, headers: corsHeaders(req) }) };
  }
  const tokenPayload = verifyCustomerToken(token);
  if (!tokenPayload) {
    return { error: NextResponse.json({ success: false, error: "Session expired. Please login again." }, { status: 401, headers: corsHeaders(req) }) };
  }
  const customer = await prisma.customer.findUnique({
    where: { id: tokenPayload.id },
    select: { id: true, email: true, username: true, role: true, isActive: true },
  });
  if (!customer || !customer.isActive || customer.role === "BANNED") {
    return { error: NextResponse.json({ success: false, error: "Your account is not eligible to create tickets." }, { status: 403, headers: corsHeaders(req) }) };
  }
  return { customer };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireEligibleCustomer(req);
    if ("error" in auth) return auth.error;
    const customer = auth.customer;

    let rows: any[] = [];
    try {
      rows = await prisma.supportTicket.findMany({
        where: {
          OR: [
            { email: { equals: customer.email.toLowerCase(), mode: "insensitive" } },
            { discordUsername: { equals: customer.username, mode: "insensitive" } },
          ],
        },
        include: {
          product: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    } catch (listError: any) {
      const code = listError?.code || "";
      const messageText = String(listError?.message || "").toLowerCase();
      const isMissingSupportTable =
        code === "P2021" ||
        code === "P2022" ||
        messageText.includes("supportticket");
      if (!isMissingSupportTable) throw listError;
    }

    const data = rows.map((ticket) => {
      const parsed = parseThreadFromAdminNotes(ticket.adminNotes);
      const conversation = [
        {
          id: `${ticket.id}-customer`,
          sender: "CUSTOMER",
          author: ticket.email || ticket.discordUsername || "Customer",
          message: ticket.message,
          createdAt: ticket.createdAt,
        },
        ...parsed.replies,
      ];
      return {
        ...ticket,
        adminNotes: parsed.notes,
        replies: parsed.replies,
        conversation,
      };
    });

    return NextResponse.json({ success: true, data }, { headers: corsHeaders(req) });
  } catch (error) {
    console.error("GET /api/support/tickets error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: corsHeaders(req) });
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  try {
    const apiPause = await prisma.siteSetting.findUnique({ where: { key: "public_api_pause" } });
    if (apiPause?.value === "true") {
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please try again later." },
        { status: 503, headers: corsHeaders(req) }
      );
    }

    const auth = await requireEligibleCustomer(req);
    if ("error" in auth) return auth.error;
    const customer = auth.customer;

    const body = await req.json();
    const contactType = body.contactType === "discord" ? "DISCORD" : "EMAIL";
    const email = customer.email.toLowerCase();
    const discordUsernameInput = typeof body.discordUsername === "string" ? body.discordUsername.trim() : "";
    const discordUsername = discordUsernameInput || customer.username || "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const productSlug = typeof body.productSlug === "string" ? body.productSlug.trim() : "";

    if (contactType === "EMAIL" && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ success: false, error: "Valid email is required." }, { status: 400, headers: corsHeaders(req) });
    }

    if (contactType === "DISCORD" && !DISCORD_REGEX.test(discordUsername)) {
      return NextResponse.json({ success: false, error: "Discord nickname is required." }, { status: 400, headers: corsHeaders(req) });
    }

    if (subject.length < 5 || subject.length > 120) {
      return NextResponse.json({ success: false, error: "Subject must be between 5 and 120 characters." }, { status: 400, headers: corsHeaders(req) });
    }

    if (message.length < 20 || message.length > 4000) {
      return NextResponse.json({ success: false, error: "Message must be between 20 and 4000 characters." }, { status: 400, headers: corsHeaders(req) });
    }

    const product = productSlug
      ? await prisma.product.findUnique({ where: { slug: productSlug }, select: { id: true, name: true, slug: true } })
      : null;

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || null;

    let ticket: any = null;
    let usedFallback = false;
    let fallbackTicketNumber = Math.floor(Date.now() / 1000);

    try {
      ticket = await prisma.supportTicket.create({
        data: {
          productId: product?.id,
          contactType,
          email,
          discordUsername: contactType === "DISCORD" ? discordUsername : null,
          subject,
          message,
          ip,
          userAgent,
        },
        include: {
          product: { select: { name: true, slug: true } },
        },
      });
    } catch (createError: any) {
      // Fallback path: keep request from failing if ticket table is not ready yet.
      usedFallback = true;
      const code = createError?.code || "";
      const messageText = String(createError?.message || "");

      if (code !== "P2021" && code !== "P2022" && !messageText.toLowerCase().includes("supportticket")) {
        throw createError;
      }
    }

    await prisma.adminNotification.create({
      data: {
        type: "SYSTEM",
        severity: "INFO",
        title: usedFallback ? `New support request #${fallbackTicketNumber}` : `New ticket #${ticket.ticketNumber}`,
        message: `${subject} from ${customer.username}`,
        meta: JSON.stringify({
          ticketId: ticket?.id || null,
          ticketNumber: ticket?.ticketNumber || fallbackTicketNumber,
          customerId: customer.id,
          customerUsername: customer.username,
          contactType,
          fallback: usedFallback,
          subject,
          message,
          email: email || null,
          discordUsername: discordUsername || null,
          productSlug: product?.slug || null,
        }),
      },
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        data: {
          ticketNumber: ticket?.ticketNumber || fallbackTicketNumber,
          status: ticket?.status || "OPEN",
        },
        warning: usedFallback ? "Ticket system is running in fallback mode. Admin should run DB migration." : undefined,
      },
      { status: 201, headers: corsHeaders(req) }
    );
  } catch (error) {
    console.error("POST /api/support/tickets error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: corsHeaders(req) });
  }
}
