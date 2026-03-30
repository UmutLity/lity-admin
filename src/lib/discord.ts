import prisma from "@/lib/prisma";

const TYPE_COLORS: Record<string, number> = {
  UPDATE: 0x8470ff,
  FIX: 0x22c55e,
  INFO: 0x3b82f6,
  WARNING: 0xf59e0b,
};

const TYPE_EMOJIS: Record<string, string> = {
  UPDATE: "🚀",
  FIX: "🔧",
  INFO: "ℹ️",
  WARNING: "⚠️",
};

const STATUS_EMOJIS: Record<string, string> = {
  UNDETECTED: "✅",
  DETECTED: "❌",
  UPDATING: "🔄",
  MAINTENANCE: "🛠️",
  DISCONTINUED: "🚫",
};

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 15)).trimEnd() + "\n*...continued*";
}

function markdownToDiscord(md: string): string {
  let result = md.replace(/\r\n/g, "\n");

  result = result.replace(/^#{1,6}\s+(.+)$/gm, "**$1**");
  result = result.replace(/^[-*]\s+(.+)$/gm, "• $1");
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  if (result.length > 4000) {
    result = result.slice(0, 3990) + "\n\n*...truncated*";
  }

  return result;
}

export interface ChangelogEmbed {
  title: string;
  body: string;
  type: string;
  publishedAt: string;
  products?: { name: string; status: string }[];
}

export function buildChangelogEmbed(changelog: ChangelogEmbed): object {
  const typeEmoji = TYPE_EMOJIS[changelog.type] || "📝";
  const color = TYPE_COLORS[changelog.type] || 0x7c3aed;
  const pubDate = changelog.publishedAt ? new Date(changelog.publishedAt) : new Date();
  const dateStr = pubDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const convertedBody = markdownToDiscord(changelog.body);
  const productNames = changelog.products?.map((product) => product.name).join(", ") || "General";

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    {
      name: "Release Type",
      value: `${typeEmoji} ${changelog.type}`,
      inline: true,
    },
    {
      name: "Published",
      value: `📅 ${dateStr}`,
      inline: true,
    },
    {
      name: "Scope",
      value: truncate(productNames, 1024),
      inline: false,
    },
  ];

  if (changelog.products && changelog.products.length > 0 && changelog.products.length <= 10) {
    const productList = changelog.products
      .map((product) => `${STATUS_EMOJIS[product.status] || "❔"} **${product.name}** - \`${product.status}\``)
      .join("\n");

    fields.push({
      name: "Related Products",
      value: truncate(productList, 1024),
      inline: false,
    });
  }

  return {
    embeds: [
      {
        title: `${typeEmoji} ${changelog.title}`,
        description: truncate(convertedBody, 3500),
        color,
        fields,
        footer: {
          text: "Lity Software • Official Update",
        },
        timestamp: changelog.publishedAt || new Date().toISOString(),
      },
    ],
  };
}

export function buildWebhookPayload(
  embed: object,
  username?: string,
  avatarUrl?: string,
  mentionEveryone: boolean = false
): object {
  const payload: any = {
    ...(embed as any),
  };

  if (username && username.trim() !== "") {
    payload.username = username;
  }

  if (avatarUrl && avatarUrl.trim() !== "") {
    payload.avatar_url = avatarUrl;
  }

  if (mentionEveryone) {
    payload.content = "@everyone";
    payload.allowed_mentions = { parse: ["everyone"] };
  }

  return payload;
}

interface WebhookResult {
  success: boolean;
  responseCode?: number;
  responseBody?: string;
  attempts: number;
}

type OrderDiscordPayload = {
  orderId: string;
  productName: string;
  productSlug: string;
  plan: string;
  amount: number;
  subtotalAmount?: number;
  discountAmount?: number;
  couponCode?: string | null;
  customerEmail?: string | null;
  customerUsername?: string | null;
  customerNote?: string | null;
  manualDelivery?: boolean;
};

type TopUpDiscordPayload = {
  amount: number;
  senderName: string;
  senderBankName: string;
  note?: string | null;
  proofImageUrl?: string | null;
  customerEmail?: string | null;
  customerUsername?: string | null;
};

type TicketDiscordPayload = {
  ticketNumber: number | string;
  subject: string;
  message: string;
  contactType: string;
  productName?: string | null;
  customerEmail?: string | null;
  customerUsername?: string | null;
};

export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: object,
  maxRetries: number = 3
): Promise<WebhookResult> {
  let lastError = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const bodyText = await response.text().catch(() => "");

      if (response.ok || response.status === 204) {
        return {
          success: true,
          responseCode: response.status,
          responseBody: bodyText.slice(0, 500),
          attempts: attempt,
        };
      }

      lastError = `HTTP ${response.status}: ${bodyText.slice(0, 200)}`;

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("retry-after") || "2", 10);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (response.status >= 400 && response.status < 500) {
        return {
          success: false,
          responseCode: response.status,
          responseBody: lastError,
          attempts: attempt,
        };
      }
    } catch (err: any) {
      lastError = err.message || "Network error";
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }

  return {
    success: false,
    responseCode: 0,
    responseBody: lastError,
    attempts: maxRetries,
  };
}

export async function sendOrderNotificationToDiscord(order: OrderDiscordPayload): Promise<WebhookResult | null> {
  const webhookEnabledSetting = await prisma.siteSetting.findUnique({
    where: { key: "discord_webhook_enabled" },
  });
  if (!webhookEnabledSetting || webhookEnabledSetting.value !== "true") return null;

  const webhookUrlSetting = await prisma.siteSetting.findUnique({
    where: { key: "discord_webhook_url" },
  });
  if (!webhookUrlSetting || !webhookUrlSetting.value) return null;

  const [usernameSetting, avatarSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: "discord_webhook_username" } }),
    prisma.siteSetting.findUnique({ where: { key: "discord_webhook_avatar_url" } }),
  ]);

  const fields = [
    { name: "Product", value: `**${order.productName}**\n\`/${order.productSlug}\``, inline: true },
    { name: "Plan", value: String(order.plan || "-").split("_").join(" "), inline: true },
    { name: "Total", value: `$${Number(order.amount || 0).toFixed(2)}`, inline: true },
    { name: "Customer", value: `${order.customerUsername || "Unknown"}\n${order.customerEmail || "-"}`, inline: false },
    { name: "Delivery", value: order.manualDelivery ? "Manual delivery pending" : "Automatic delivery", inline: true },
  ] as Array<{ name: string; value: string; inline?: boolean }>;

  if ((order.discountAmount || 0) > 0) {
    fields.push({
      name: "Discount",
      value: `-$${Number(order.discountAmount || 0).toFixed(2)}${order.couponCode ? ` via ${order.couponCode}` : ""}`,
      inline: true,
    });
  }

  if (order.customerNote) {
    fields.push({
      name: "Customer Note",
      value: truncate(order.customerNote, 500),
      inline: false,
    });
  }

  const payload = buildWebhookPayload(
    {
      embeds: [
        {
          title: `New Order - #${order.orderId.slice(-8).toUpperCase()}`,
          description: order.manualDelivery
            ? "A new manual-delivery order is waiting for review."
            : "A new order has been created.",
          color: 0x8470ff,
          fields,
          footer: { text: "Lity Software - Order Notification" },
          timestamp: new Date().toISOString(),
        },
      ],
    },
    usernameSetting?.value || undefined,
    avatarSetting?.value || undefined,
    false
  );

  return sendDiscordWebhook(webhookUrlSetting.value, payload);
}

async function getDiscordWebhookIdentity() {
  const webhookEnabledSetting = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_enabled" } });
  if (!webhookEnabledSetting || webhookEnabledSetting.value !== "true") return null;

  const webhookUrlSetting = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_url" } });
  if (!webhookUrlSetting?.value) return null;

  const [usernameSetting, avatarSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: "discord_webhook_username" } }),
    prisma.siteSetting.findUnique({ where: { key: "discord_webhook_avatar_url" } }),
  ]);

  return {
    webhookUrl: webhookUrlSetting.value,
    username: usernameSetting?.value || undefined,
    avatarUrl: avatarSetting?.value || undefined,
  };
}

export async function sendTopUpNotificationToDiscord(input: TopUpDiscordPayload): Promise<WebhookResult | null> {
  const webhook = await getDiscordWebhookIdentity();
  if (!webhook) return null;

  const payload = buildWebhookPayload(
    {
      embeds: [
        {
          title: "New Top-up Request",
          description: "A customer submitted a manual balance request.",
          color: 0x3b82f6,
          fields: [
            { name: "Customer", value: `${input.customerUsername || "Unknown"}\n${input.customerEmail || "-"}`, inline: false },
            { name: "Amount", value: `$${Number(input.amount || 0).toFixed(2)}`, inline: true },
            { name: "Sender", value: `${input.senderName}\n${input.senderBankName}`, inline: true },
            { name: "Note", value: truncate(input.note || "No note left.", 500), inline: false },
          ],
          ...(input.proofImageUrl ? { image: { url: input.proofImageUrl } } : {}),
          footer: { text: "Lity Software - Top-up Request" },
          timestamp: new Date().toISOString(),
        },
      ],
    },
    webhook.username,
    webhook.avatarUrl,
    false
  );

  return sendDiscordWebhook(webhook.webhookUrl, payload);
}

export async function sendSupportTicketNotificationToDiscord(input: TicketDiscordPayload): Promise<WebhookResult | null> {
  const webhook = await getDiscordWebhookIdentity();
  if (!webhook) return null;

  const payload = buildWebhookPayload(
    {
      embeds: [
        {
          title: `New Support Ticket #${input.ticketNumber}`,
          description: truncate(input.message, 1200),
          color: 0xf59e0b,
          fields: [
            { name: "Subject", value: input.subject, inline: false },
            { name: "Customer", value: `${input.customerUsername || "Unknown"}\n${input.customerEmail || "-"}`, inline: false },
            { name: "Contact", value: input.contactType, inline: true },
            { name: "Product", value: input.productName || "General Support", inline: true },
          ],
          footer: { text: "Lity Software - Support Ticket" },
          timestamp: new Date().toISOString(),
        },
      ],
    },
    webhook.username,
    webhook.avatarUrl,
    false
  );

  return sendDiscordWebhook(webhook.webhookUrl, payload);
}

export async function sendChangelogToDiscord(changelogId: string): Promise<WebhookResult | null> {
  const webhookEnabledSetting = await prisma.siteSetting.findUnique({
    where: { key: "discord_webhook_enabled" },
  });
  if (!webhookEnabledSetting || webhookEnabledSetting.value !== "true") return null;

  const webhookUrlSetting = await prisma.siteSetting.findUnique({
    where: { key: "discord_webhook_url" },
  });
  if (!webhookUrlSetting || !webhookUrlSetting.value) return null;

  const usernameSetting = await prisma.siteSetting.findUnique({
    where: { key: "discord_webhook_username" },
  });
  const avatarSetting = await prisma.siteSetting.findUnique({
    where: { key: "discord_webhook_avatar_url" },
  });

  const changelog = await prisma.changelog.findUnique({
    where: { id: changelogId },
    include: {
      products: {
        include: { product: { select: { name: true, status: true } } },
      },
    },
  });

  if (!changelog) return null;

  const embed = buildChangelogEmbed({
    title: changelog.title,
    body: changelog.body,
    type: changelog.type,
    publishedAt: (changelog.publishedAt || changelog.createdAt).toISOString(),
    products: changelog.products.map((cp) => ({
      name: cp.product.name,
      status: cp.product.status,
    })),
  });

  const payload = buildWebhookPayload(
    embed,
    usernameSetting?.value || undefined,
    avatarSetting?.value || undefined,
    true
  );

  const result = await sendDiscordWebhook(webhookUrlSetting.value, payload);

  await prisma.webhookDelivery.create({
    data: {
      provider: "DISCORD",
      event: "CHANGELOG_PUBLISHED",
      entityId: changelogId,
      success: result.success,
      responseCode: result.responseCode,
      responseBody: result.responseBody?.slice(0, 500),
      attempts: result.attempts,
    },
  });

  return result;
}
