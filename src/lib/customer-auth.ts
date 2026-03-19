import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || "lity-software-secret-key-2024";

export interface CustomerTokenPayload {
  id: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}

export function createCustomerToken(payload: { id: string; email: string; username: string }): string {
  const data = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyCustomerToken(token: string): CustomerTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;
    const expected = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
    if (signature !== expected) return null;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as CustomerTokenPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

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
