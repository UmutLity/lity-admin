import { z } from "zod";

export const guideSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  body: z.string().min(1, "Body is required"),
  productId: z.string().min(1, "Product is required"),
  isDraft: z.boolean().default(true),
  publishedAt: z.string().optional().nullable(),
});

export type GuideFormData = z.infer<typeof guideSchema>;
