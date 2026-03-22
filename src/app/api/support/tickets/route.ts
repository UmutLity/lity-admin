import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getClientIp } from "@/lib/ip-utils";
import { sendDiscordWebhook } from "@/lib/discord";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISCORD_REGEX = /^.{2,32}$/;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://litysoftware.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  try {
    const apiPause = await prisma.siteSetting.findUnique({ where: { key: "public_api_pause" } });
    if (apiPause?.value === "true") {
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please try again later." },
        { status: 503, headers: corsHeaders() }
      );
    }

    const body = await req.json();
    const contactType = body.contactType === "discord" ? "DISCORD" : "EMAIL";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const discordUsername = typeof body.discordUsername === "string" ? body.discordUsername.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const productSlug = typeof body.productSlug === "string" ? body.productSlug.trim() : "";

    if (contactType === "EMAIL" && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ success: false, error: "Valid email is required." }, { status: 400, headers: corsHeaders() });
    }

    if (contactType === "DISCORD" && !DISCORD_REGEX.test(discordUsername)) {
      return NextResponse.json({ success: false, error: "Discord nickname is required." }, { status: 400, headers: corsHeaders() });
    }

    if (subject.length < 5 || subject.length > 120) {
      return NextResponse.json({ success: false, error: "Subject must be between 5 and 120 characters." }, { status: 400, headers: corsHeaders() });
    }

    if (message.length < 20 || message.length > 4000) {
      return NextResponse.json({ success: false, error: "Message must be between 20 and 4000 characters." }, { status: 400, headers: corsHeaders() });
    }

    const product = productSlug
      ? await prisma.product.findUnique({ where: { slug: productSlug }, select: { id: true, name: true, slug: true } })
      : null;

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || null;

    const ticket = await prisma.supportTicket.create({
      data: {
        productId: product?.id,
        contactType,
        email: contactType === "EMAIL" ? email : null,
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

    await prisma.adminNotification.create({
      data: {
        type: "SYSTEM",
        severity: "INFO",
        title: `New ticket #${ticket.ticketNumber}`,
        message: `${ticket.subject} from ${ticket.email || ticket.discordUsername || "unknown contact"}`,
        meta: JSON.stringify({
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          contactType: ticket.contactType,
        }),
      },
    }).catch(() => {});

    const webhookEnabled = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_enabled" } });
    const webhookUrl = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_url" } });
    const webhookUsername = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_username" } });
    const webhookAvatar = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_avatar_url" } });

    if (webhookEnabled?.value === "true" && webhookUrl?.value) {
      await sendDiscordWebhook(
        webhookUrl.value,
        {
          username: webhookUsername?.value || "Lity Support",
          avatar_url: webhookAvatar?.value || undefined,
          embeds: [
            {
              title: `New Support Ticket #${ticket.ticketNumber}`,
              color: 0x7c3aed,
              fields: [
                { name: "Subject", value: ticket.subject.slice(0, 1024), inline: false },
                { name: "Contact", value: ticket.email || ticket.discordUsername || "Unknown", inline: true },
                { name: "Type", value: ticket.contactType, inline: true },
                { name: "Product", value: ticket.product?.name || "General", inline: true },
                { name: "Message", value: ticket.message.slice(0, 1024), inline: false },
              ],
              timestamp: ticket.createdAt.toISOString(),
            },
          ],
        },
        1
      ).catch(() => null);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
        },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("POST /api/support/tickets error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: corsHeaders() });
  }
}
