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

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const ip = getIp(req);

    // ── Block suspicious requests ──
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
    if (!checkRate(`global:${ip}`, GLOBAL_RATE_LIMIT, GLOBAL_WINDOW_MS)) {
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
      if (!checkRate(`login:${ip}`, LOGIN_RATE_LIMIT, LOGIN_WINDOW_MS)) {
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
      if (!checkRate(`admin-api:${ip}`, ADMIN_API_RATE_LIMIT, ADMIN_API_WINDOW_MS)) {
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
      "/admin/insights",
      "/admin/seo",
      "/admin/performance",
      "/admin/resellers",
      "/admin/timeline",
    ];
    const isAdminOnly = adminOnlyRoutes.some((route) => pathname.startsWith(route));

    if (isAdminOnly && token?.role !== "ADMIN") {
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
        // Allow public API routes without auth
        if (
          req.nextUrl.pathname.startsWith("/api/products") ||
          req.nextUrl.pathname.startsWith("/api/changelog") ||
          req.nextUrl.pathname.startsWith("/api/settings") ||
          req.nextUrl.pathname.startsWith("/api/auth") ||
          req.nextUrl.pathname.startsWith("/api/status") ||
          req.nextUrl.pathname.startsWith("/api/track") ||
          req.nextUrl.pathname.startsWith("/api/categories") ||
          req.nextUrl.pathname.startsWith("/api/performance") ||
          req.nextUrl.pathname.startsWith("/api/admin/weekly-report")
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
