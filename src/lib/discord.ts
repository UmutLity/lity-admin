import prisma from "@/lib/prisma";

// ─── Discord Embed Colors ───────────────────────────────

const TYPE_COLORS: Record<string, number> = {
  UPDATE: 0x7c3aed,  // Purple
  FIX: 0x22c55e,     // Green
  INFO: 0x3b82f6,    // Blue
  WARNING: 0xf59e0b, // Yellow
};

const TYPE_EMOJIS: Record<string, string> = {
  UPDATE: "🚀",
  FIX: "🔧",
  INFO: "ℹ️",
  WARNING: "⚠️",
};

const TYPE_LABELS: Record<string, string> = {
  UPDATE: "🛠 **Update**",
  FIX: "🔧 **Fix**",
  INFO: "ℹ️ **Info**",
  WARNING: "⚠️ **Warning**",
};

const STATUS_EMOJIS: Record<string, string> = {
  UNDETECTED: "✅",
  DETECTED: "❌",
  UPDATING: "🔄",
  MAINTENANCE: "🔧",
  DISCONTINUED: "🚫",
};

// ─── Markdown Conversion for Discord ────────────────────

function markdownToDiscord(md: string): string {
  let result = md;
  // Convert headings (## Title → **Title**)
  result = result.replace(/^#{1,6}\s+(.+)$/gm, "**$1**");
  // Convert list items to emoji bullet style
  result = result.replace(/^[-*]\s+(.+)$/gm, (_, content) => {
    // Auto-assign emojis based on keywords
    const lower = content.toLowerCase();
    let emoji = "•";
    if (lower.includes("fix") || lower.includes("bug")) emoji = "🐛";
    else if (lower.includes("new") || lower.includes("add")) emoji = "✨";
    else if (lower.includes("improv") || lower.includes("optimi")) emoji = "🎯";
    else if (lower.includes("updat")) emoji = "🔄";
    else if (lower.includes("remov") || lower.includes("delet")) emoji = "🗑";
    else if (lower.includes("secur") || lower.includes("protect")) emoji = "🛡";
    else if (lower.includes("menu") || lower.includes("ui")) emoji = "🎨";
    else if (lower.includes("driver") || lower.includes("recode")) emoji = "🔧";
    else if (lower.includes("aim") || lower.includes("target")) emoji = "🎯";
    else if (lower.includes("unlock") || lower.includes("chams")) emoji = "🧩";
    else if (lower.includes("known") || lower.includes("issue")) emoji = "🩹";
    else if (lower.includes("download") || lower.includes("loader")) emoji = "📥";
    else if (lower.includes("auto")) emoji = "⚡";
    else emoji = "🔹";
    return `${emoji} ${content}`;
  });
  // Keep **bold**, *italic*, `code` as-is (Discord supports them)
  // Truncate to Discord embed limit (4096 chars)
  if (result.length > 4000) {
    result = result.slice(0, 3990) + "\n\n*...truncated*";
  }
  return result;
}

// ─── Build Discord Embed ────────────────────────────────

export interface ChangelogEmbed {
  title: string;
  body: string;
  type: string;
  publishedAt: string;
  products?: { name: string; status: string }[];
}

export function buildChangelogEmbed(changelog: ChangelogEmbed): object {
  const typeEmoji = TYPE_EMOJIS[changelog.type] || "📝";
  const typeLabel = TYPE_LABELS[changelog.type] || `📝 **${changelog.type}**`;
  const color = TYPE_COLORS[changelog.type] || 0x7c3aed;

  // Format date
  const pubDate = changelog.publishedAt ? new Date(changelog.publishedAt) : new Date();
  const dateStr = pubDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Build product name for header
  const productNames = changelog.products?.map(p => `🎮 ${p.name}`).join(" • ") || "";

  // Build header line
  const headerLine = `🗓 **${dateStr}** • ${typeLabel}${productNames ? ` • ${productNames}` : ""}\n\n`;

  // Build description with header + converted body
  const convertedBody = markdownToDiscord(changelog.body);
  const description = headerLine + "✨ Updates have been made to the product:\n\n" + convertedBody;

  // Note about auto-update
  const autoUpdateNote = "\n\n⚠ You do **NOT** need to download a new loader.\n🔄 The current one will update automatically.";

  const fields: object[] = [
    {
      name: "📋 Type",
      value: `${typeEmoji} ${changelog.type}`,
      inline: true,
    },
  ];

  if (changelog.products && changelog.products.length > 0) {
    const productList = changelog.products
      .map((p) => `${STATUS_EMOJIS[p.status] || "❓"} **${p.name}** — \`${p.status}\``)
      .join("\n");
    fields.push({
      name: "📦 Related Products",
      value: productList,
      inline: false,
    });
  }

  // Truncate safely
  let finalDesc = description + autoUpdateNote;
  if (finalDesc.length > 4000) {
    finalDesc = finalDesc.slice(0, 3990) + "\n\n*...truncated*";
  }

  return {
    embeds: [
      {
        title: `${typeEmoji} ${changelog.title}`,
        description: finalDesc,
        color,
        fields,
        footer: {
          text: "Lity Software • Official Update",
          icon_url: "", // will be overridden by avatar setting
        },
        timestamp: changelog.publishedAt || new Date().toISOString(),
      },
    ],
  };
}

// ─── Build Full Webhook Payload ─────────────────────────

export function buildWebhookPayload(
  embed: object,
  username?: string,
  avatarUrl?: string
): object {
  const payload: any = {
    username: username || "Lity Software",
    ...(embed as any),
  };

  // Sadece avatarUrl gerçekten varsa ve boş değilse ekle
  if (avatarUrl && avatarUrl.trim() !== "") {
    payload.avatar_url = avatarUrl;
  }

  return payload;
}

// ─── Send Discord Webhook ───────────────────────────────

interface WebhookResult {
  success: boolean;
  responseCode?: number;
  responseBody?: string;
  attempts: number;
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: object,
  maxRetries: number = 3
): Promise<WebhookResult> {
  let lastError: string = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
      method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json" 
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

      // Rate limit: wait and retry
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("retry-after") || "2", 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      // Don't retry for client errors (except rate limit)
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

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
  }

  return {
    success: false,
    responseCode: 0,
    responseBody: lastError,
    attempts: maxRetries,
  };
}

// ─── Auto-send changelog to Discord ─────────────────────

export async function sendChangelogToDiscord(changelogId: string): Promise<WebhookResult | null> {
  // Check if webhook is enabled
  const webhookEnabledSetting = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_enabled" } });
  if (!webhookEnabledSetting || webhookEnabledSetting.value !== "true") return null;

  const webhookUrlSetting = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_url" } });
  if (!webhookUrlSetting || !webhookUrlSetting.value) return null;

  const usernameSetting = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_username" } });
  const avatarSetting = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_avatar_url" } });

  // Load changelog with products
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
    avatarSetting?.value || undefined
  );

  const result = await sendDiscordWebhook(webhookUrlSetting.value, payload);

  // Record delivery
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
