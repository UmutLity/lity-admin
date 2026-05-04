import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ━━━ In-memory rate limiting for middleware ━━━
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const ADMIN_API_RATE_LIMIT = 60;      // requests per window
const ADMIN_API_WINDOW_MS = 60_000;   // 1 minute
const LOGIN_RATE_LIMIT = 8;           // login attempts per window
const LOGIN_WINDOW_MS = 60_000;       // 1 minute
const GLOBAL_RATE_LIMIT = 120;        // all requests per IP per window
const GLOBAL_WINDOW_MS = 60_000;
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_API_ROLES = new Set(["FOUNDER", "ADMIN", "EDITOR", "MODERATOR", "SUPPORT", "ANALYST", "MEDIA"]);

function checkRate(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

async function checkRateDistributed(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return checkRate(key, limit, windowMs);
  }

  const redisKey = `rl:${key}`;
  const encodedKey = encodeURIComponent(redisKey);
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    const incrRes = await fetch(`${UPSTASH_REDIS_REST_URL}/incr/${encodedKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!incrRes.ok) {
      return checkRate(key, limit, windowMs);
    }

    const incrData = await incrRes.json() as { result?: number };
    const count = Number(incrData?.result || 0);

    if (count <= 1) {
      await fetch(`${UPSTASH_REDIS_REST_URL}/expire/${encodedKey}/${ttlSeconds}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        },
        cache: "no-store",
      }).catch(() => undefined);
    }

    return count <= limit;
  } catch {
    return checkRate(key, limit, windowMs);
  }
}

// Cleanup stale entries every 2 minutes
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now - entry.windowStart > 300_000) rateLimitMap.delete(key);
    }
  };
  try { setInterval(cleanup, 120_000); } catch {}
}

// ━━━ Extract client IP ━━━
function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || req.ip
    || "127.0.0.1";
}

// ━━━ Suspicious path patterns (path traversal, SQL injection, etc.) ━━━
const SUSPICIOUS_PATTERNS = [
  /\.\.\//,                          // path traversal
  /<script/i,                        // XSS attempt
  /union\s+select/i,                 // SQL injection
  /drop\s+table/i,                   // SQL injection
  /;\s*-{2}/,                        // SQL comment injection
  /\bexec\s*\(/i,                    // code execution
  /\beval\s*\(/i,                    // eval injection
  /javascript:/i,                    // JS protocol
  /on\w+\s*=/i,                      // event handler injection
  /%00/,                             // null byte injection
  /\0/,                              // null byte
];

function isSuspiciousRequest(req: NextRequest): boolean {
  const url = decodeURIComponent(req.nextUrl.pathname + (req.nextUrl.search || ""));
  return SUSPICIOUS_PATTERNS.some((p) => p.test(url));
}

// ━━━ Block known bad user agents ━━━
const BAD_USER_AGENTS = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i,
  /havij/i, /dirbuster/i, /gobuster/i, /wfuzz/i,
  /acunetix/i, /nessus/i, /openvas/i,
];

function isBadUserAgent(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") || "";
  return BAD_USER_AGENTS.some((p) => p.test(ua));
}

function isSameOriginRequest(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  const allowedOrigins = new Set<string>([req.nextUrl.origin]);
  if (process.env.NEXTAUTH_URL) {
    try {
      allowedOrigins.add(new URL(process.env.NEXTAUTH_URL).origin);
    } catch {}
  }

  return allowedOrigins.has(origin);
}

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const ip = getIp(req);

    if (pathname.startsWith("/api/admin/") && !isSameOriginRequest(req)) {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden origin" }),
        { status: 403, headers: { "Content-Type": "application/json", "Vary": "Origin" } }
      );
    }

    if (pathname.startsWith("/api/admin/") && req.method === "OPTIONS") {
      const origin = req.headers.get("origin") || req.nextUrl.origin;
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
          "Vary": "Origin",
        },
      });
    }

    // ── Block suspicious requests ──
    if (pathname.startsWith("/api/admin/")) {
      if (!token) {
        return new NextResponse(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!ADMIN_API_ROLES.has(String(token.role || ""))) {
        return new NextResponse(
          JSON.stringify({ success: false, error: "Forbidden" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (isSuspiciousRequest(req)) {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Block known attack tools ──
    if (isBadUserAgent(req)) {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Global rate limit (per IP) ──
    if (!(await checkRateDistributed(`global:${ip}`, GLOBAL_RATE_LIMIT, GLOBAL_WINDOW_MS))) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please slow down." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
    }

    // ── Login endpoint rate limiting ──
    if (pathname.startsWith("/api/auth")) {
      if (!(await checkRateDistributed(`login:${ip}`, LOGIN_RATE_LIMIT, LOGIN_WINDOW_MS))) {
        return new NextResponse(
          JSON.stringify({ error: "Too many login attempts. Please wait." }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
            },
          }
        );
      }
    }

    // ── Admin API rate limiting ──
    if (pathname.startsWith("/api/admin/")) {
      if (!(await checkRateDistributed(`admin-api:${ip}`, ADMIN_API_RATE_LIMIT, ADMIN_API_WINDOW_MS))) {
        return new NextResponse(
          JSON.stringify({ error: "Rate limit exceeded for admin API." }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
            },
          }
        );
      }
    }

    // ── Validate content-type for mutation requests ──
    if (
      pathname.startsWith("/api/admin/") &&
      ["POST", "PUT", "PATCH"].includes(req.method) &&
      !pathname.includes("/media") // media uses FormData
    ) {
      const contentType = req.headers.get("content-type") || "";
      if (!contentType.includes("application/json") && !contentType.includes("multipart/form-data")) {
        return new NextResponse(
          JSON.stringify({ error: "Invalid Content-Type" }),
          { status: 415, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // ── Admin-only routes ──
    const adminOnlyRoutes = [
      "/admin/settings",
      "/admin/users",
      "/admin/audit",
      "/admin/security",
      "/admin/roles",
      "/admin/analytics",
      "/admin/system",
      "/admin/executive",
      "/admin/revenue",
      "/admin/categories",
      "/admin/notifications",
      "/admin/topups",
      "/admin/insights",
      "/admin/seo",
      "/admin/performance",
      "/admin/resellers",
      "/admin/timeline",
    ];
    const isAdminOnly = adminOnlyRoutes.some((route) => pathname.startsWith(route));

    if (isAdminOnly && !["FOUNDER", "ADMIN"].includes(String(token?.role || ""))) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    // ── Add security response headers ──
    const response = NextResponse.next();
    response.headers.set("X-Request-Id", crypto.randomUUID());
    response.headers.set("X-Content-Type-Options", "nosniff");

    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow login page without auth
        if (req.nextUrl.pathname === "/admin/login") return true;
        if (req.nextUrl.pathname.startsWith("/api/admin/") && req.method === "OPTIONS") return true;
        // Allow public API routes without auth
        if (
          req.nextUrl.pathname.startsWith("/api/products") ||
          req.nextUrl.pathname.startsWith("/api/changelog") ||
          req.nextUrl.pathname.startsWith("/api/settings") ||
          req.nextUrl.pathname.startsWith("/api/auth") ||
          req.nextUrl.pathname.startsWith("/api/status") ||
          req.nextUrl.pathname.startsWith("/api/track") ||
          req.nextUrl.pathname.startsWith("/api/categories") ||
          req.nextUrl.pathname.startsWith("/api/performance")
        ) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/auth/:path*"],
};
