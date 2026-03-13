import { z } from "zod";

export const changelogSchema = z.object({
  title: z.string().min(1, "Başlık zorunlu").max(300),
  body: z.string().min(1, "İçerik zorunlu"),
  type: z.enum(["UPDATE", "FIX", "INFO", "WARNING"]),
  isDraft: z.boolean().default(true),
  publishedAt: z.string().optional().nullable(),
  productIds: z.array(z.string()).optional(),
});

export type ChangelogFormData = z.infer<typeof changelogSchema>;
