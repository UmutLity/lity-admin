import crypto from "crypto";
import { encrypt, decrypt } from "@/lib/encryption";

// ─── TOTP Implementation (RFC 6238) ────────────────────

const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "sha1";

/**
 * Generate a base32 secret for TOTP
 */
export function generateTOTPSecret(): string {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Generate an encrypted TOTP secret
 */
export function generateEncryptedTOTPSecret(): { plain: string; encrypted: string } {
  const plain = generateTOTPSecret();
  const encrypted = encrypt(plain);
  return { plain, encrypted };
}

/**
 * Decrypt a TOTP secret
 */
export function decryptTOTPSecret(encrypted: string): string {
  return decrypt(encrypted);
}

/**
 * Generate a TOTP URI for QR code
 */
export function generateTOTPUri(secret: string, email: string, issuer: string = "Lity Admin"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/**
 * Generate current TOTP code
 */
export function generateTOTP(encryptedSecret: string): string {
  const secret = decrypt(encryptedSecret);
  const secretBuffer = base32Decode(secret);
  const time = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
  return hotpGenerate(secretBuffer, time);
}

/**
 * Verify a TOTP code (with ±1 window tolerance)
 */
export function verifyTOTP(encryptedSecret: string, code: string, window: number = 1): boolean {
  const secret = decrypt(encryptedSecret);
  const secretBuffer = base32Decode(secret);
  const time = Math.floor(Date.now() / 1000 / TOTP_PERIOD);

  for (let i = -window; i <= window; i++) {
    const expected = hotpGenerate(secretBuffer, time + i);
    if (timingSafeEqual(code, expected)) {
      return true;
    }
  }
  return false;
}

// ─── HOTP Generation (RFC 4226) ─────────────────────────

function hotpGenerate(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = counter & 0xff;
    counter = counter >> 8;
  }

  const hmac = crypto.createHmac(TOTP_ALGORITHM, secret);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

// ─── Timing-safe comparison ─────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

// ─── Base32 Encoding/Decoding ───────────────────────────

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(str: string): Buffer {
  const cleaned = str.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_CHARS.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

// ─── Recovery Codes ─────────────────────────────────────

export function generateRecoveryCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    // Format: XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}
