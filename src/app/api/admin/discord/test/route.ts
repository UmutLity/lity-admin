import { NextResponse } from "next/server";
import { sendDiscordWebhook, buildWebhookPayload } from "@/lib/discord";

export async function POST(req: Request) {
  try {
    // 415 hatasını önlemek için gelen veriyi güvenli alalım
    const body = await req.json();
    const { webhookUrl, embed, username, avatarUrl } = body;

    if (!webhookUrl) {
      return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 });
    }

    const payload = buildWebhookPayload(embed, username, avatarUrl);
    const result = await sendDiscordWebhook(webhookUrl, payload);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Discord test error:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}