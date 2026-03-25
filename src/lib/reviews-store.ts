import crypto from "crypto";
import prisma from "@/lib/prisma";

export type ReviewItem = {
  id: string;
  source: string;
  sourceMessageId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  rating: number | null;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

const FALLBACK_KEY = "manual_reviews_fallback_json";

function isReviewTableMissing(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "P2021" ||
    code === "P2022" ||
    message.includes("relation") && message.includes("review") && message.includes("does not exist") ||
    message.includes("no such table") && message.includes("review")
  );
}

function normalizeRating(value: any): number | null {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) return parsed;
  return null;
}

async function loadFallback(): Promise<ReviewItem[]> {
  const row = await prisma.siteSetting.findUnique({ where: { key: FALLBACK_KEY } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return [];
    return parsed as ReviewItem[];
  } catch {
    return [];
  }
}

async function saveFallback(items: ReviewItem[]) {
  await prisma.siteSetting.upsert({
    where: { key: FALLBACK_KEY },
    update: { value: JSON.stringify(items) },
    create: {
      key: FALLBACK_KEY,
      value: JSON.stringify(items),
      type: "json",
      group: "custom",
      label: "Manual Reviews Fallback Store",
    },
  });
}

export async function listAllReviews(): Promise<ReviewItem[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","source","sourceMessageId","authorName","authorAvatarUrl","content","rating","isVisible","createdAt","updatedAt"
       FROM "Review"
       ORDER BY "createdAt" DESC`
    );
    return rows.map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  } catch (error) {
    if (!isReviewTableMissing(error)) throw error;
    const rows = await loadFallback();
    return rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
}

export async function listVisibleReviews(limit: number): Promise<ReviewItem[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","source","sourceMessageId","authorName","authorAvatarUrl","content","rating","isVisible","createdAt","updatedAt"
       FROM "Review"
       WHERE "isVisible" = true
       ORDER BY "createdAt" DESC
       LIMIT $1`,
      limit
    );
    return rows.map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  } catch (error) {
    if (!isReviewTableMissing(error)) throw error;
    const rows = await loadFallback();
    return rows
      .filter((r) => r.isVisible)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, limit);
  }
}

export async function createManualReview(input: {
  authorName: string;
  authorAvatarUrl?: string | null;
  content: string;
  rating?: any;
  isVisible?: boolean;
  source?: string;
}): Promise<ReviewItem> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const created: ReviewItem = {
    id,
    source: (input.source || "MANUAL").trim() || "MANUAL",
    sourceMessageId: `manual-${id}`,
    authorName: input.authorName.trim(),
    authorAvatarUrl: input.authorAvatarUrl?.trim() || null,
    content: input.content.trim(),
    rating: normalizeRating(input.rating),
    isVisible: input.isVisible !== false,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Review"
      ("id","source","sourceMessageId","authorName","authorAvatarUrl","content","rating","isVisible","meta","createdAt","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
      created.id,
      created.source,
      created.sourceMessageId,
      created.authorName,
      created.authorAvatarUrl,
      created.content,
      created.rating,
      created.isVisible,
      JSON.stringify({ manual: true })
    );
    return (await listAllReviews()).find((r) => r.id === created.id) || created;
  } catch (error) {
    if (!isReviewTableMissing(error)) throw error;
    const rows = await loadFallback();
    rows.push(created);
    await saveFallback(rows);
    return created;
  }
}

export async function updateReview(id: string, patch: Partial<ReviewItem>): Promise<ReviewItem | null> {
  try {
    const current = (await listAllReviews()).find((r) => r.id === id);
    if (!current) return null;

    const next: ReviewItem = {
      ...current,
      source: patch.source !== undefined ? String(patch.source).trim() || current.source : current.source,
      authorName: patch.authorName !== undefined ? String(patch.authorName).trim() : current.authorName,
      authorAvatarUrl: patch.authorAvatarUrl !== undefined ? (patch.authorAvatarUrl ? String(patch.authorAvatarUrl).trim() : null) : current.authorAvatarUrl,
      content: patch.content !== undefined ? String(patch.content).trim() : current.content,
      rating: patch.rating !== undefined ? normalizeRating(patch.rating) : current.rating,
      isVisible: patch.isVisible !== undefined ? !!patch.isVisible : current.isVisible,
      updatedAt: new Date().toISOString(),
    };

    await prisma.$executeRawUnsafe(
      `UPDATE "Review"
       SET "authorName"=$2, "authorAvatarUrl"=$3, "content"=$4, "rating"=$5, "isVisible"=$6, "source"=$7, "updatedAt"=NOW()
       WHERE "id"=$1`,
      id,
      next.authorName,
      next.authorAvatarUrl,
      next.content,
      next.rating,
      next.isVisible,
      next.source
    );

    return (await listAllReviews()).find((r) => r.id === id) || next;
  } catch (error) {
    if (!isReviewTableMissing(error)) throw error;
    const rows = await loadFallback();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const curr = rows[idx];
    const updated: ReviewItem = {
      ...curr,
      source: patch.source !== undefined ? String(patch.source).trim() || curr.source : curr.source,
      authorName: patch.authorName !== undefined ? String(patch.authorName).trim() : curr.authorName,
      authorAvatarUrl: patch.authorAvatarUrl !== undefined ? (patch.authorAvatarUrl ? String(patch.authorAvatarUrl).trim() : null) : curr.authorAvatarUrl,
      content: patch.content !== undefined ? String(patch.content).trim() : curr.content,
      rating: patch.rating !== undefined ? normalizeRating(patch.rating) : curr.rating,
      isVisible: patch.isVisible !== undefined ? !!patch.isVisible : curr.isVisible,
      updatedAt: new Date().toISOString(),
    };
    rows[idx] = updated;
    await saveFallback(rows);
    return updated;
  }
}

export async function deleteReview(id: string): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "Review" WHERE "id" = $1`, id);
    return true;
  } catch (error) {
    if (!isReviewTableMissing(error)) throw error;
    const rows = await loadFallback();
    const next = rows.filter((r) => r.id !== id);
    if (next.length === rows.length) return false;
    await saveFallback(next);
    return true;
  }
}

