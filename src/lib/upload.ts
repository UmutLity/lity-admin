import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";
const MAX_SIZE = (parseInt(process.env.UPLOAD_MAX_SIZE_MB || "5") || 5) * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
];

export interface UploadResult {
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}`);
  }

  // Validate size
  if (file.size > MAX_SIZE) {
    throw new Error(`File too large. Maximum: ${MAX_SIZE / 1024 / 1024}MB`);
  }

  // Create upload directory if needed
  const uploadPath = path.join(process.cwd(), UPLOAD_DIR);
  if (!existsSync(uploadPath)) {
    await mkdir(uploadPath, { recursive: true });
  }

  // Generate unique filename
  const ext = path.extname(file.name);
  const hash = crypto.randomBytes(8).toString("hex");
  const filename = `${Date.now()}-${hash}${ext}`;
  const filepath = path.join(uploadPath, filename);

  // Write file
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(filepath, buffer);

  // Return result
  const url = `/uploads/${filename}`;
  return {
    filename,
    url,
    mimeType: file.type,
    size: file.size,
  };
}

export async function deleteFile(url: string): Promise<void> {
  try {
    const filepath = path.join(process.cwd(), "public", url);
    if (existsSync(filepath)) {
      await unlink(filepath);
    }
  } catch (error) {
    console.error("Failed to delete file:", error);
  }
}
