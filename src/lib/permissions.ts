import prisma from "@/lib/prisma";

// ─── All Available Permissions ─────────────────────────

export const ALL_PERMISSIONS = [
  // Products
  "product.view",
  "product.create",
  "product.update",
  "product.delete",
  "product.status.change",
  // Changelog
  "changelog.view",
  "changelog.create",
  "changelog.update",
  "changelog.delete",
  "changelog.publish",
  // Categories
  "category.view",
  "category.create",
  "category.update",
  "category.delete",
  // Settings
  "settings.view",
  "settings.update",
  // Media
  "media.view",
  "media.upload",
  "media.delete",
  // Users
  "user.view",
  "user.manage",
  // Roles
  "role.view",
  "role.manage",
  // Audit
  "audit.view",
  // Security
  "security.view",
  "security.manage",
  // Webhook
  "webhook.test",
  "webhook.manage",
  // Analytics
  "analytics.view",
  // System
  "system.view",
  // Notifications
  "notification.view",
  // Customers
  "customer.view",
  "customer.manage",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

// ─── Permission Groups (for UI display) ────────────────

export const PERMISSION_GROUPS: Record<string, { label: string; permissions: Permission[] }> = {
  product: {
    label: "Products",
    permissions: ["product.view", "product.create", "product.update", "product.delete", "product.status.change"],
  },
  changelog: {
    label: "Changelog",
    permissions: ["changelog.view", "changelog.create", "changelog.update", "changelog.delete", "changelog.publish"],
  },
  category: {
    label: "Categories",
    permissions: ["category.view", "category.create", "category.update", "category.delete"],
  },
  settings: {
    label: "Settings",
    permissions: ["settings.view", "settings.update"],
  },
  media: {
    label: "Media",
    permissions: ["media.view", "media.upload", "media.delete"],
  },
  user: {
    label: "Users",
    permissions: ["user.view", "user.manage"],
  },
  customer: {
    label: "Customers",
    permissions: ["customer.view", "customer.manage"],
  },
  role: {
    label: "Roles",
    permissions: ["role.view", "role.manage"],
  },
  audit: {
    label: "Audit Log",
    permissions: ["audit.view"],
  },
  security: {
    label: "Security",
    permissions: ["security.view", "security.manage"],
  },
  webhook: {
    label: "Discord Webhook",
    permissions: ["webhook.test", "webhook.manage"],
  },
  analytics: {
    label: "Analytics",
    permissions: ["analytics.view"],
  },
  system: {
    label: "System",
    permissions: ["system.view"],
  },
  notification: {
    label: "Notifications",
    permissions: ["notification.view"],
  },
};

// ─── Default Role Permissions ──────────────────────────

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [...ALL_PERMISSIONS],
  EDITOR: [
    "product.view", "product.create", "product.update", "product.status.change",
    "changelog.view", "changelog.create", "changelog.update", "changelog.publish",
    "category.view",
    "media.view", "media.upload",
    "webhook.test",
    "analytics.view",
    "notification.view",
    "customer.view",
  ],
  VIEWER: [
    "product.view",
    "changelog.view",
    "category.view",
    "media.view",
    "notification.view",
  ],
};

// ─── Permission Check Functions ────────────────────────

export async function getUserPermissions(userId: string, fallbackRole?: string): Promise<Permission[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roleRef: true },
  });

  if (!user) {
    // User not found in DB (stale session after reset) - use fallback role from JWT
    if (fallbackRole && DEFAULT_ROLE_PERMISSIONS[fallbackRole]) {
      return DEFAULT_ROLE_PERMISSIONS[fallbackRole];
    }
    return [];
  }

  // If user has a roleRef, use its permissions
  if (user.roleRef) {
    try {
      return JSON.parse(user.roleRef.permissions) as Permission[];
    } catch {
      return [];
    }
  }

  // Fallback to legacy role field
  return DEFAULT_ROLE_PERMISSIONS[user.role] || [];
}

export async function hasPermission(userId: string, permission: Permission, fallbackRole?: string): Promise<boolean> {
  const perms = await getUserPermissions(userId, fallbackRole);
  return perms.includes(permission);
}

export async function hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return permissions.some((p) => perms.includes(p));
}

export function parsePermissions(permissionsJson: string): Permission[] {
  try {
    return JSON.parse(permissionsJson) as Permission[];
  } catch {
    return [];
  }
}
