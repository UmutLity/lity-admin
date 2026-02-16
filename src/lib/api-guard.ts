import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// ━━━ Request Size Limit (prevent payload bombs) ━━━
const MAX_JSON_SIZE = 1 * 1024 * 1024; // 1 MB

export function checkRequestSize(req: NextRequest): NextResponse | null {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_JSON_SIZE) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 }
    );
  }
  return null;
}

// ━━━ Input Sanitizer ━━━
const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /\bexec\s*\(/i,
  /\beval\s*\(/i,
  /union\s+select/i,
  /drop\s+table/i,
  /insert\s+into/i,
  /delete\s+from/i,
  /;\s*--/,
  /\bOR\b\s+\b1\s*=\s*1/i,
  /'\s*OR\s*'1'\s*=\s*'1/i,
];

export function sanitizeInput(value: any): any {
  if (typeof value === "string") {
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        // Strip the dangerous part but don't reject — just clean it
        value = value.replace(pattern, "");
      }
    }
    // Trim very long strings (prevent abuse)
    if (value.length > 50000) {
      value = value.substring(0, 50000);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }
  if (value && typeof value === "object") {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      // Skip __proto__ and constructor keys (prototype pollution)
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      cleaned[k] = sanitizeInput(v);
    }
    return cleaned;
  }
  return value;
}

// ━━━ Parse & Sanitize JSON body ━━━
export async function safeParseJson(req: NextRequest): Promise<{ data: any; error?: string }> {
  try {
    const sizeCheck = checkRequestSize(req);
    if (sizeCheck) return { data: null, error: "Request body too large" };

    const raw = await req.json();
    const sanitized = sanitizeInput(raw);
    return { data: sanitized };
  } catch {
    return { data: null, error: "Invalid JSON body" };
  }
}

// ━━━ Get Client IP ━━━
export function getClientIpFromRequest(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.ip ||
    "127.0.0.1"
  );
}

// ━━━ Validate Admin API Request (combined guard) ━━━
export async function guardAdminRoute(
  req: NextRequest,
  options?: { rateLimit?: boolean; maxBodySize?: number }
): Promise<NextResponse | null> {
  const ip = getClientIpFromRequest(req);

  // Rate limit check
  if (options?.rateLimit !== false) {
    const rl = checkRateLimit(ip, "general");
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // Content-Type validation for mutation requests
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json") && !ct.includes("multipart/form-data")) {
      // Allow if no body expected
      const cl = req.headers.get("content-length");
      if (cl && parseInt(cl) > 0) {
        return NextResponse.json(
          { error: "Invalid Content-Type" },
          { status: 415 }
        );
      }
    }
  }

  // Request size check
  const maxSize = options?.maxBodySize || MAX_JSON_SIZE;
  const cl = req.headers.get("content-length");
  if (cl && parseInt(cl) > maxSize) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 }
    );
  }

  return null;
}

// ━━━ Validate required fields ━━━
export function validateRequired(body: any, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

// ━━━ Safe error response (don't leak internals) ━━━
export function safeError(error: unknown, fallbackMessage = "Internal server error"): NextResponse {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  // Never expose raw error to client
  console.error("API Error:", error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
