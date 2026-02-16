import { z } from "zod";

export const siteSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const siteSettingsUpdateSchema = z.object({
  settings: z.array(siteSettingSchema),
});

export type SiteSettingFormData = z.infer<typeof siteSettingSchema>;
