import crypto from "crypto";

const EXPECTED_ISSUER = "litysoftware";

function getSecret(strict = false): string | null {
  const fromEnv = process.env.CUSTOMER_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "production" || strict) {
    if (strict) throw new Error("Customer token secret is not configured");
    return null;
  }

  return "lity-dev-only-secret-change-me";
}

export interface CustomerTokenPayload {
  id: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
  iss?: string;
}

export function createCustomerToken(payload: { id: string; email: string; username: string }): string {
  const secret = getSecret(true)!;
  const data = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
    iss: EXPECTED_ISSUER,
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyCustomerToken(token: string): CustomerTokenPayload | null {
  try {
    const secret = getSecret(false);
    if (!secret) return null;
    if (!token || token.length > 2048) return null;

    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;
    const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as CustomerTokenPayload;
    if (!payload || typeof payload !== "object") return null;
    if (!payload.id || !payload.email || !payload.username) return null;
    if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) return null;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.iss && payload.iss !== EXPECTED_ISSUER) return null;

    return payload;
  } catch {
    return null;
  }
}

export function getCustomerTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}
