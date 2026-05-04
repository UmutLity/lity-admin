import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEFAULT_PUBLIC_SITE_ORIGIN = "https://www.litysoftware.com";

function configuredOrigins() {
  const values = [
    DEFAULT_PUBLIC_SITE_ORIGIN,
    "https://litysoftware.com",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.PUBLIC_SITE_ORIGIN,
    ...(process.env.PUBLIC_SITE_ORIGINS || "").split(","),
  ];

  return new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]);
}

export function getAllowedCorsOrigin(origin: string | null) {
  const allowedOrigins = configuredOrigins();
  if (origin && allowedOrigins.has(origin)) return origin;
  return origin ? null : DEFAULT_PUBLIC_SITE_ORIGIN;
}

export function publicCorsHeaders(req: NextRequest) {
  const origin = getAllowedCorsOrigin(req.headers.get("origin"));
  if (!origin) return null;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

export function corsPreflight(req: NextRequest) {
  const headers = publicCorsHeaders(req);

  if (!headers) {
    return NextResponse.json({ success: false, error: "Forbidden origin" }, { status: 403 });
  }

  return new NextResponse(null, { status: 204, headers });
}

export function attachPublicCors(req: NextRequest, response: NextResponse) {
  const headers = publicCorsHeaders(req);
  if (!headers) return response;

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
