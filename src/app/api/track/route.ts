import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

// Bot user-agent patterns to filter
const BOT_PATTERNS = /bot|crawler|spider|crawling|googlebot|bingbot|yandex|baidu|duckduck|facebook|twitter|linkedin|slack|discord|telegram|whatsapp|postman|curl|wget|python|java|php|ruby|node-fetch|axios/i;

function hashIp(ip: string): string {
  const salt = new Date().toISOString().slice(0, 10); // Daily rotation
  return crypto.createHash("sha256").update(ip + salt).digest("hex").slice(0, 16);
}

function detectDevice(ua: string): string {
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
    if (/ipad|tablet/i.test(ua)) return "tablet";
    return "mobile";
  }
  return "desktop";
}

// POST /api/track
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";

    // Filter bots
    if (BOT_PATTERNS.test(ua)) {
      return NextResponse.json({ success: true });
    }

    const body = await req.json();
    const { path, referrer, title, eventName, meta, utmSource, utmMedium, utmCampaign } = body;

    if (!path) {
      return NextResponse.json({ success: false, error: "Path required" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") || "127.0.0.1";
    const ipHash = hashIp(ip);
    const deviceType = detectDevice(ua);

    // Check maintenance / API pause
    const apiPause = await prisma.siteSetting.findUnique({ where: { key: "public_api_pause" } });
    if (apiPause?.value === "true") {
      return NextResponse.json({ success: true }); // silently accept but don't store
    }

    // Session management via cookie
    let sessionId = "";
    const sidCookie = req.cookies.get("_sid");
    if (sidCookie?.value) {
      sessionId = sidCookie.value;
    } else {
      sessionId = crypto.randomUUID();
    }

    // Upsert analytics session
    let analyticsSession = await prisma.analyticsSession.findUnique({ where: { sessionId } });
    if (!analyticsSession) {
      analyticsSession = await prisma.analyticsSession.create({
        data: {
          sessionId,
          entryPath: path,
          exitPath: path,
          referrer: referrer || null,
          utmSource: utmSource || null,
          utmMedium: utmMedium || null,
          utmCampaign: utmCampaign || null,
          deviceType,
        },
      });
    } else {
      await prisma.analyticsSession.update({
        where: { id: analyticsSession.id },
        data: {
          lastSeenAt: new Date(),
          exitPath: path,
        },
      });
    }

    // Create page view
    await prisma.pageView.create({
      data: {
        path,
        ipHash,
        userAgent: ua.slice(0, 512),
        referrer: referrer || null,
        title: title || null,
        sessionId: analyticsSession.id,
      },
    });

    // Track event if provided
    if (eventName) {
      await prisma.analyticsEvent.create({
        data: {
          sessionId: analyticsSession.id,
          name: eventName,
          meta: meta ? JSON.stringify(meta) : null,
        },
      });
    }

    // Set session cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set("_sid", sessionId, {
      maxAge: 30 * 60, // 30 minutes
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("Track error:", error);
    return NextResponse.json({ success: true }); // Never fail tracking
  }
}
