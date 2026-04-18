import crypto from "crypto";
import prisma from "@/lib/prisma";

const DEFAULT_SITE_URL = "https://litysoftware.com";

function getReferralSecret() {
  return process.env.REFERRAL_SECRET || process.env.NEXTAUTH_SECRET || "lity-referral-secret";
}

function normalizeInviteCode(raw: string) {
  return String(raw || "").trim().replace(/\s+/g, "");
}

function signCustomerId(customerId: string) {
  return crypto
    .createHmac("sha256", getReferralSecret())
    .update(customerId)
    .digest("base64url")
    .slice(0, 16);
}

export function encodeReferralCode(customerId: string) {
  if (!customerId) return "";
  return `${customerId}.${signCustomerId(customerId)}`;
}

export function decodeReferralCode(rawCode: string): string | null {
  const code = normalizeInviteCode(rawCode);
  if (!code.includes(".")) return null;
  const [customerId, signature] = code.split(".");
  if (!customerId || !signature) return null;
  const expected = signCustomerId(customerId);
  return signature === expected ? customerId : null;
}

export async function getReferralSiteUrl() {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: "site_public_url" } });
    const value = String(row?.value || "").trim();
    if (value) return value.replace(/\/+$/, "");
  } catch {
    // ignore and fallback
  }
  return DEFAULT_SITE_URL;
}

export async function buildReferralLink(customerId: string) {
  const code = encodeReferralCode(customerId);
  const siteUrl = await getReferralSiteUrl();
  return `${siteUrl}/?invite=${encodeURIComponent(code)}`;
}

export function parseReferrerFromNotes(notes: string | null | undefined) {
  const text = String(notes || "");
  const match = text.match(/ref_by:([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

export function appendReferrerToNotes(notes: string | null | undefined, referrerId: string) {
  const value = String(notes || "").trim();
  if (!referrerId) return value || null;
  if (value.includes(`ref_by:${referrerId}`)) return value || null;
  if (!value) return `ref_by:${referrerId}`;
  return `${value}\nref_by:${referrerId}`;
}

