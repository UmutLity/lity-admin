import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  slug: z.string().min(1, "Slug is required").max(200).regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and hyphens"),
  shortDescription: z.string().max(500).optional().nullable(),
  description: z.string().optional().nullable(),
  longDescription: z.string().optional().nullable(),
  technicalDescription: z.string().optional().nullable(),
  featureSectionTitle: z.string().max(100).optional().nullable(),
  category: z.string().min(1, "Category is required").max(50),
  status: z.enum(["UNDETECTED", "DETECTED", "UPDATING", "MAINTENANCE", "DISCONTINUED"]),
  statusNote: z.string().max(200).optional().nullable(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  currency: z.string().min(1).max(3).default("USD"),
  buyUrl: z.string().url("Enter a valid URL").optional().nullable().or(z.literal("")),
  defaultLoaderUrl: z.string().url("Enter a valid URL").optional().nullable().or(z.literal("")).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return ["mega.nz", "www.mega.nz", "mega.co.nz", "www.mega.co.nz"].includes(url.hostname);
    } catch {
      return false;
    }
  }, "Loader link must be a valid Mega URL"),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).default("IN_STOCK"),
  deliveryType: z.enum(["MANUAL", "INSTANT", "SCHEDULED"]).default("MANUAL"),
  estimatedDelivery: z.string().max(80).optional().nullable().or(z.literal("")),
  sortOrder: z.number().int().default(0),
  displayOrder: z.number().int().default(0),
  prices: z.array(z.object({
    plan: z.string().min(1, "Plan label is required").max(50),
    price: z.number().min(0, "Price must be 0 or greater"),
  })).optional(),
  features: z.array(z.object({
    title: z.string().min(1, "Feature title is required").max(200),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(100).optional().nullable(),
    order: z.number().int().default(0),
  })).optional(),
});

export const productStatusSchema = z.object({
  status: z.enum(["UNDETECTED", "DETECTED", "UPDATING", "MAINTENANCE", "DISCONTINUED"]),
  statusNote: z.string().max(200).optional().nullable(),
});

export type ProductFormData = z.infer<typeof productSchema>;
export type ProductStatusFormData = z.infer<typeof productStatusSchema>;
