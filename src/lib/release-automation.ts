import prisma from "@/lib/prisma";
import { sendChangelogToDiscord } from "@/lib/discord";

type ReleaseAutomationSummary = {
  discord: "sent" | "skipped" | "failed";
  notifications: { created: number; enabled: boolean };
  releaseWebhook: "sent" | "skipped" | "failed";
  emailHook: "sent" | "skipped" | "failed";
};

function toBool(value: string | null | undefined, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

async function getSettingMap(keys: string[]) {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
  return new Map(rows.map((row) => [row.key, row.value]));
}

async function sendJsonHook(url: string, payload: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function createReleaseNotifications(message: string, type: string) {
  const customers = await prisma.customer.findMany({
    where: { isActive: true, role: { not: "BANNED" } },
    select: { id: true },
  });
  if (!customers.length) return 0;

  const batchSize = 400;
  let created = 0;
  for (let i = 0; i < customers.length; i += batchSize) {
    const chunk = customers.slice(i, i + batchSize);
    const result = await prisma.notification.createMany({
      data: chunk.map((customer) => ({
        userId: customer.id,
        type,
        message,
      })),
    });
    created += Number(result.count || 0);
  }
  return created;
}

export async function dispatchChangelogReleaseAutomation(changelogId: string): Promise<ReleaseAutomationSummary> {
  let changelog: any = null;
  try {
    changelog = await prisma.changelog.findUnique({
      where: { id: changelogId },
      include: {
        products: {
          include: { product: { select: { id: true, name: true, category: true } } },
        },
      },
    });
  } catch {
    changelog = await prisma.changelog.findUnique({
      where: { id: changelogId },
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        isDraft: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  if (!changelog) {
    return {
      discord: "skipped",
      notifications: { created: 0, enabled: false },
      releaseWebhook: "skipped",
      emailHook: "skipped",
    };
  }

  const settings = await getSettingMap([
    "release_automation_enabled",
    "release_notifications_enabled",
    "release_webhook_enabled",
    "release_webhook_url",
    "release_email_hook_enabled",
    "release_email_hook_url",
    "release_discord_enabled",
  ]);

  const automationEnabled = toBool(settings.get("release_automation_enabled"), true);
  if (!automationEnabled) {
    return {
      discord: "skipped",
      notifications: { created: 0, enabled: false },
      releaseWebhook: "skipped",
      emailHook: "skipped",
    };
  }

  const relatedProducts = Array.isArray(changelog.products)
    ? (changelog.products
        .map((entry: any) => entry.product?.name)
        .filter(Boolean) as string[])
    : [];

  const releasePayload = {
    event: "CHANGELOG_PUBLISHED",
    changelog: {
      id: changelog.id,
      title: changelog.title,
      body: changelog.body,
      type: changelog.type,
      isDraft: changelog.isDraft,
      publishedAt: changelog.publishedAt?.toISOString() || null,
      createdAt: changelog.createdAt.toISOString(),
      updatedAt: changelog.updatedAt.toISOString(),
      relatedProducts,
    },
  };

  const message = relatedProducts.length
    ? `${changelog.title} published for: ${relatedProducts.join(", ")}`
    : `${changelog.title} published.`;

  let discord: ReleaseAutomationSummary["discord"] = "skipped";
  if (toBool(settings.get("release_discord_enabled"), true)) {
    try {
      const result = await sendChangelogToDiscord(changelog.id, { force: true });
      discord = result?.success ? "sent" : "failed";
    } catch {
      discord = "failed";
    }
  }

  let notificationsCreated = 0;
  const notificationEnabled = toBool(settings.get("release_notifications_enabled"), true);
  if (notificationEnabled) {
    try {
      notificationsCreated = await createReleaseNotifications(message, "CHANGELOG");
    } catch {
      notificationsCreated = 0;
    }
  }

  let releaseWebhook: ReleaseAutomationSummary["releaseWebhook"] = "skipped";
  if (toBool(settings.get("release_webhook_enabled"), false) && settings.get("release_webhook_url")) {
    const ok = await sendJsonHook(String(settings.get("release_webhook_url")), releasePayload);
    releaseWebhook = ok ? "sent" : "failed";
  }

  let emailHook: ReleaseAutomationSummary["emailHook"] = "skipped";
  if (toBool(settings.get("release_email_hook_enabled"), false) && settings.get("release_email_hook_url")) {
    const ok = await sendJsonHook(String(settings.get("release_email_hook_url")), {
      ...releasePayload,
      channel: "email",
    });
    emailHook = ok ? "sent" : "failed";
  }

  return {
    discord,
    notifications: {
      created: notificationsCreated,
      enabled: notificationEnabled,
    },
    releaseWebhook,
    emailHook,
  };
}
