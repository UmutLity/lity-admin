import { Product, ProductPrice, Changelog, ChangelogProduct, Media, ProductImage, AuditLog, User, SiteSetting, Role, WebhookDelivery, SecurityAlert, LoginAttempt, AccountLock } from "@prisma/client";

export type ProductWithRelations = Product & {
  prices: ProductPrice[];
  images: (ProductImage & { media: Media })[];
  changelogs?: (ChangelogProduct & { changelog: Changelog })[];
};

export type ChangelogWithRelations = Changelog & {
  products: (ChangelogProduct & { product: Product })[];
  webhookDeliveries?: WebhookDelivery[];
};

export type AuditLogWithUser = AuditLog & {
  user: Pick<User, "id" | "name" | "email">;
};

export type RoleWithUsers = Role & {
  users: Pick<User, "id" | "name" | "email">[];
  _count?: { users: number };
};

export type SiteSettings = Record<string, string>;

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
  };
}
