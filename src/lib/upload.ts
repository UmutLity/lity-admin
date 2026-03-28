import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";
const MAX_SIZE = (parseInt(process.env.UPLOAD_MAX_SIZE_MB || "5") || 5) * 1024 * 1024;
const IS_VERCEL = process.env.VERCEL === "1";

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || "";
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "litysoftware";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
];

export interface UploadResult {
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

function hasCloudinaryConfig() {
  return !!CLOUDINARY_CLOUD_NAME && ((!!CLOUDINARY_UPLOAD_PRESET) || (!!CLOUDINARY_API_KEY && !!CLOUDINARY_API_SECRET));
}

function isCloudinaryUrl(url: string) {
  return !!CLOUDINARY_CLOUD_NAME && url.includes(`res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/`);
}

function parseCloudinaryPublicId(url: string): string | null {
  try {
    const u = new URL(url);
    const pathParts = u.pathname.split("/").filter(Boolean);
    const uploadIndex = pathParts.findIndex((x) => x === "upload");
    if (uploadIndex === -1) return null;
    const afterUpload = pathParts.slice(uploadIndex + 1);
    const filtered = afterUpload.filter((p) => !/^v\d+$/.test(p) && !p.includes(","));
    if (!filtered.length) return null;
    const joined = filtered.join("/");
    return joined.replace(/\.[^.]+$/, "");
  } catch {
    return null;
  }
}

async function uploadToCloudinary(file: File): Promise<UploadResult> {
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", CLOUDINARY_FOLDER);

  if (CLOUDINARY_UPLOAD_PRESET) {
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  } else {
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureBase = `folder=${CLOUDINARY_FOLDER}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash("sha1").update(signatureBase).digest("hex");
    formData.append("api_key", CLOUDINARY_API_KEY);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
  }

  const res = await fetch(endpoint, { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok || !data?.secure_url) {
    throw new Error(data?.error?.message || "Cloudinary upload failed");
  }

  return {
    filename: data.public_id || file.name,
    url: data.secure_url,
    mimeType: file.type,
    size: file.size,
  };
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

  if (hasCloudinaryConfig()) {
    return uploadToCloudinary(file);
  }

  if (IS_VERCEL) {
    throw new Error("Upload storage is not configured. Set Cloudinary environment variables.");
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
    if (isCloudinaryUrl(url) && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
      const publicId = parseCloudinaryPublicId(url);
      if (!publicId) return;
      const timestamp = Math.floor(Date.now() / 1000);
      const signatureBase = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
      const signature = crypto.createHash("sha1").update(signatureBase).digest("hex");
      const destroyEndpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`;
      const body = new URLSearchParams({
        public_id: publicId,
        timestamp: String(timestamp),
        api_key: CLOUDINARY_API_KEY,
        signature,
      });
      await fetch(destroyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      return;
    }

    const normalized = url.replace(/^\/+/, "");
    const filepath = path.join(process.cwd(), "public", normalized);
    if (existsSync(filepath)) {
      await unlink(filepath);
    }
  } catch (error) {
    console.error("Failed to delete file:", error);
  }
}
