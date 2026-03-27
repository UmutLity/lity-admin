import { z } from "zod";

export const blogSchema = z.object({
  title: z.string().min(3, "Title is required").max(300),
  slug: z.string().min(3, "Slug is required").max(320),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().min(20, "Content is required"),
  coverImageUrl: z.string().max(1000).optional().nullable(),
  authorName: z.string().min(2, "Author name is required").max(120),
  isDraft: z.boolean().default(true),
});

export type BlogFormData = z.infer<typeof blogSchema>;

