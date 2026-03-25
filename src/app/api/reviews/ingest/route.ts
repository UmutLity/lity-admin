import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type NormalizedReview = {
  source: string;
  sourceMessageId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  rating: number | null;
  createdAt: Date;
  meta: string | null;
};

function safeTimingEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifySignature(rawBody: string, secret: string, headerValue: string): boolean {
  const provided = headerValue.trim();
  const expectedHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBase64 = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");

  const parsed = provided.startsWith("sha256=") ? provided.slice(7) : provided;
  return safeTimingEqual(parsed, expectedHex) || safeTimingEqual(parsed, expectedBase64);
}

function parseRating(payload: any, content: string): number | null {
  const direct = Number(payload?.rating);
  if (Number.isInteger(direct) && direct >= 1 && direct <= 5) return direct;

  const stars = (content.match(/⭐/g) || []).length;
  if (stars >= 1 && stars <= 5) return stars;
  return null;
}

function normalizePayload(payload: any, sourceDefault: string): NormalizedReview | null {
  const source = String(payload?.source || sourceDefault || "DISCORD_BRIDGE").trim() || "DISCORD_BRIDGE";
  const sourceMessageId = String(
    payload?.sourceMessageId ||
      payload?.messageId ||
      payload?.id ||
      payload?.message?.id ||
      ""
  ).trim();
  const content = String(payload?.content || payload?.message?.content || payload?.text || "").trim();

  if (!sourceMessageId || !content) return null;

  const authorName = String(
    payload?.authorName ||
      payload?.author?.username ||
      payload?.message?.author?.username ||
      payload?.user?.username ||
      "Unknown"
  ).trim() || "Unknown";

  const authorAvatarUrl =
    payload?.authorAvatarUrl ||
    payload?.author?.avatarUrl ||
    payload?.author?.avatar_url ||
    payload?.message?.author?.avatarUrl ||
    payload?.message?.author?.avatar_url ||
    null;

  const dateRaw = payload?.createdAt || payload?.timestamp || payload?.message?.timestamp || payload?.message?.created_at;
  const createdAt = dateRaw ? new Date(dateRaw) : new Date();
  const safeCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
  const rating = parseRating(payload, content);

  const metaPayload = {
    channelId: payload?.channelId || payload?.channel_id || payload?.message?.channel_id || null,
    guildId: payload?.guildId || payload?.guild_id || payload?.message?.guild_id || null,
    rawType: payload?.type || payload?.event || null,
  };

  return {
    source,
    sourceMessageId,
    authorName,
    authorAvatarUrl: authorAvatarUrl ? String(authorAvatarUrl) : null,
    content,
    rating,
    createdAt: safeCreatedAt,
    meta: JSON.stringify(metaPayload),
  };
}

// POST /api/reviews/ingest - webhook bridge ingestion
export async function POST(req: NextRequest) {
  try {
    const [enabledSetting, secretSetting, sourceSetting] = await Promise.all([
      prisma.siteSetting.findUnique({ where: { key: "reviews_webhook_enabled" } }),
      prisma.siteSetting.findUnique({ where: { key: "reviews_webhook_secret" } }),
      prisma.siteSetting.findUnique({ where: { key: "reviews_webhook_source" } }),
    ]);

    if (enabledSetting?.value !== "true") {
      return NextResponse.json({ success: false, error: "Reviews webhook is disabled" }, { status: 503 });
    }

    const secret = secretSetting?.value || "";
    if (!secret) {
      return NextResponse.json({ success: false, error: "Missing reviews webhook secret" }, { status: 500 });
    }

    const signature = req.headers.get("x-review-signature");
    if (!signature) {
      return NextResponse.json({ success: false, error: "Missing signature" }, { status: 401 });
    }

    const rawBody = await req.text();
    if (!verifySignature(rawBody, secret, signature)) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 403 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }

    const normalized = normalizePayload(payload, sourceSetting?.value || "DISCORD_BRIDGE");
    if (!normalized) {
      return NextResponse.json({ success: false, error: "Missing required review fields" }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Review"
      ("id","source","sourceMessageId","authorName","authorAvatarUrl","content","rating","isVisible","meta","createdAt","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,NOW())
      ON CONFLICT ("source","sourceMessageId")
      DO UPDATE SET
        "authorName" = EXCLUDED."authorName",
        "authorAvatarUrl" = EXCLUDED."authorAvatarUrl",
        "content" = EXCLUDED."content",
        "rating" = EXCLUDED."rating",
        "meta" = EXCLUDED."meta",
        "isVisible" = true,
        "updatedAt" = NOW()`,
      crypto.randomUUID(),
      normalized.source,
      normalized.sourceMessageId,
      normalized.authorName,
      normalized.authorAvatarUrl,
      normalized.content,
      normalized.rating,
      normalized.meta,
      normalized.createdAt
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/reviews/ingest error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

