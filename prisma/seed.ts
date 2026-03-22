import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const { hash } = bcrypt;

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ─── System Roles ──────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {
      permissions: JSON.stringify([
        "product.view","product.create","product.update","product.delete","product.status.change",
        "changelog.view","changelog.create","changelog.update","changelog.delete","changelog.publish",
        "category.view","category.create","category.update","category.delete",
        "settings.view","settings.update",
        "media.view","media.upload","media.delete",
        "user.view","user.manage",
        "customer.view","customer.manage",
        "ticket.view","ticket.manage",
        "role.view","role.manage",
        "audit.view",
        "security.view","security.manage",
        "webhook.test","webhook.manage",
        "analytics.view","system.view","notification.view",
      ]),
    },
    create: {
      name: "ADMIN",
      label: "Administrator",
      isSystem: true,
      permissions: JSON.stringify([
        "product.view","product.create","product.update","product.delete","product.status.change",
        "changelog.view","changelog.create","changelog.update","changelog.delete","changelog.publish",
        "category.view","category.create","category.update","category.delete",
        "settings.view","settings.update",
        "media.view","media.upload","media.delete",
        "user.view","user.manage",
        "customer.view","customer.manage",
        "ticket.view","ticket.manage",
        "role.view","role.manage",
        "audit.view",
        "security.view","security.manage",
        "webhook.test","webhook.manage",
        "analytics.view","system.view","notification.view",
      ]),
    },
  });
  console.log(`✅ Role: ${adminRole.name}`);

  const editorRole = await prisma.role.upsert({
    where: { name: "EDITOR" },
    update: {
      permissions: JSON.stringify([
        "product.view","product.create","product.update","product.status.change",
        "changelog.view","changelog.create","changelog.update","changelog.publish",
        "category.view",
        "media.view","media.upload",
        "webhook.test",
        "analytics.view","notification.view","customer.view",
        "ticket.view","ticket.manage",
      ]),
    },
    create: {
      name: "EDITOR",
      label: "Editor",
      isSystem: true,
      permissions: JSON.stringify([
        "product.view","product.create","product.update","product.status.change",
        "changelog.view","changelog.create","changelog.update","changelog.publish",
        "category.view",
        "media.view","media.upload",
        "webhook.test",
        "analytics.view","notification.view","customer.view",
        "ticket.view","ticket.manage",
      ]),
    },
  });
  console.log(`✅ Role: ${editorRole.name}`);

  const viewerRole = await prisma.role.upsert({
    where: { name: "VIEWER" },
    update: {
      permissions: JSON.stringify([
        "product.view","changelog.view","category.view","media.view","notification.view","ticket.view",
      ]),
    },
    create: {
      name: "VIEWER",
      label: "Viewer",
      isSystem: true,
      permissions: JSON.stringify([
        "product.view","changelog.view","category.view","media.view","notification.view","ticket.view",
      ]),
    },
  });
  console.log(`✅ Role: ${viewerRole.name}`);

  // ─── Admin User ──────────────────────────────────
  const adminPassword = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@litysoftware.com" },
    update: { roleId: adminRole.id },
    create: {
      email: "admin@litysoftware.com",
      name: "Admin",
      password: adminPassword,
      role: "ADMIN",
      roleId: adminRole.id,
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ─── Editor User ─────────────────────────────────
  const editorPassword = await hash("editor123", 12);
  const editor = await prisma.user.upsert({
    where: { email: "editor@litysoftware.com" },
    update: { roleId: editorRole.id },
    create: {
      email: "editor@litysoftware.com",
      name: "Editor",
      password: editorPassword,
      role: "EDITOR",
      roleId: editorRole.id,
    },
  });
  console.log(`✅ Editor user: ${editor.email}`);

  // ─── Categories ─────────────────────────────────
  const categories = [
    { name: "VALORANT", slug: "VALORANT", icon: "🎯", color: "#ef4444", sortOrder: 1 },
    { name: "CS2", slug: "CS2", icon: "🔫", color: "#f59e0b", sortOrder: 2 },
    { name: "BYPASS", slug: "BYPASS", icon: "🛡️", color: "#3b82f6", sortOrder: 3 },
    { name: "SPOOFER", slug: "SPOOFER", icon: "🔧", color: "#8b5cf6", sortOrder: 4 },
    { name: "OTHER", slug: "OTHER", icon: "📦", color: "#6b7280", sortOrder: 99 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { icon: cat.icon, color: cat.color, sortOrder: cat.sortOrder },
      create: cat,
    });
  }
  console.log(`✅ Categories seeded (${categories.length})`);

  // ─── Products ────────────────────────────────────
  const products = [
    { name: "Valorant Full", slug: "valorant-full", shortDescription: "Comprehensive external package for Valorant.", description: "# Valorant Full\n\nUnlock full **ESP**, **Aimbot**, and a wide range of misc features.", category: "VALORANT", status: "UNDETECTED", isFeatured: true, isActive: true, currency: "USD", buyUrl: "https://discord.gg/litysoftware", sortOrder: 1 },
    { name: "Valorant External", slug: "valorant-external", shortDescription: "Advanced undetectable external gaming software.", description: "# Valorant External\n\nAdvanced undetectable external gaming software.", category: "VALORANT", status: "UNDETECTED", isFeatured: true, isActive: true, currency: "USD", buyUrl: "https://discord.gg/litysoftware", sortOrder: 2 },
    { name: "Valorant Internal", slug: "valorant-internal", shortDescription: "Internal Valorant solution for seamless integration.", description: "# Valorant Internal\n\nInternal Valorant solution.", category: "VALORANT", status: "UPDATING", statusNote: "New features being added", isActive: true, currency: "USD", buyUrl: "https://discord.gg/litysoftware", sortOrder: 3 },
    { name: "Valorant VIP", slug: "valorant-vip", shortDescription: "Premium VIP internal solution for Valorant.", description: "# Ceyra.One - Valorant VIP\n\nPremium VIP internal solution.", category: "VALORANT", status: "UNDETECTED", isFeatured: true, isActive: true, currency: "USD", buyUrl: "https://discord.gg/litysoftware", sortOrder: 4 },
    { name: "CS2 Internal", slug: "cs2-internal", shortDescription: "Advanced CS2 internal with Aimbot, ESP, and stream-proof misc.", description: "# CS2 Internal\n\nAdvanced Aimbot, powerful ESP.", category: "CS2", status: "UNDETECTED", isFeatured: true, isActive: true, currency: "USD", buyUrl: "https://discord.gg/litysoftware", sortOrder: 5 },
    { name: "Vanguard Bypass", slug: "vanguard-bypass", shortDescription: "Reliable system-level bypass for Vanguard.", description: "# Vanguard Bypass\n\nReliable bypass.", category: "BYPASS", status: "UNDETECTED", isActive: true, currency: "USD", buyUrl: "https://discord.gg/litysoftware", sortOrder: 6 },
    { name: "Private Woofer", slug: "private-woofer", shortDescription: "Custom method HWID spoofer.", description: "# Private Woofer\n\nCustom method HWID spoofer.", category: "SPOOFER", status: "UNDETECTED", isActive: true, currency: "USD", buyUrl: "https://discord.gg/litysoftware", sortOrder: 7 },
    { name: "Perm Woofer", slug: "perm-woofer", shortDescription: "Permanent HWID spoofer solution.", description: "# Perm Woofer\n\nPermanent HWID spoofer.", category: "SPOOFER", status: "UPDATING", statusNote: "Enhanced features coming soon", isActive: true, currency: "USD", buyUrl: "https://discord.gg/litysoftware", sortOrder: 8 },
  ];

  for (const p of products) {
    await prisma.product.upsert({ where: { slug: p.slug }, update: p, create: p });
    console.log(`  ✅ Product: ${p.name}`);
  }

  // ─── Product Prices ──────────────────────────────
  const priceData = [
    { slug: "valorant-full", prices: [{ plan: "DAILY", price: 2 }, { plan: "WEEKLY", price: 6 }, { plan: "MONTHLY", price: 18 }] },
    { slug: "valorant-external", prices: [{ plan: "DAILY", price: 3 }, { plan: "WEEKLY", price: 7 }, { plan: "MONTHLY", price: 20 }] },
    { slug: "valorant-internal", prices: [{ plan: "DAILY", price: 2 }, { plan: "WEEKLY", price: 5 }, { plan: "MONTHLY", price: 15 }] },
    { slug: "valorant-vip", prices: [{ plan: "DAILY", price: 2 }, { plan: "WEEKLY", price: 5 }, { plan: "MONTHLY", price: 15 }] },
    { slug: "cs2-internal", prices: [{ plan: "DAILY", price: 1 }, { plan: "WEEKLY", price: 3 }, { plan: "MONTHLY", price: 10 }] },
    { slug: "vanguard-bypass", prices: [{ plan: "MONTHLY", price: 25 }, { plan: "LIFETIME", price: 60 }] },
    { slug: "private-woofer", prices: [{ plan: "LIFETIME", price: 40 }] },
  ];

  for (const pd of priceData) {
    const product = await prisma.product.findUnique({ where: { slug: pd.slug } });
    if (!product) continue;
    for (const price of pd.prices) {
      await prisma.productPrice.upsert({
        where: { productId_plan: { productId: product.id, plan: price.plan } },
        update: { price: price.price },
        create: { productId: product.id, plan: price.plan, price: price.price },
      });
    }
  }
  console.log(`  💰 All prices set`);

  // ─── Changelogs ──────────────────────────────────
  const valorantFull = await prisma.product.findUnique({ where: { slug: "valorant-full" } });
  const cs2Internal = await prisma.product.findUnique({ where: { slug: "cs2-internal" } });

  const cl1 = await prisma.changelog.create({
    data: {
      title: "Valorant Full v2.4.0 - New Features",
      body: "## Changes\n- Added new **Skeleton ESP** option\n- Improved aimbot smoothing algorithm\n- Fixed radar display on Abyss map\n- Performance improvements",
      type: "UPDATE", isDraft: false, publishedAt: new Date(),
      products: valorantFull ? { create: { productId: valorantFull.id } } : undefined,
    },
  });

  // Update product's lastUpdate
  if (valorantFull) {
    await prisma.product.update({
      where: { id: valorantFull.id },
      data: { lastUpdateAt: cl1.publishedAt, lastUpdateChangelogId: cl1.id },
    });
  }

  await prisma.changelog.create({
    data: {
      title: "CS2 Internal - Hotfix",
      body: "## Fixes\n- Fixed crash on map change\n- Resolved ESP flickering\n- Updated offsets for latest CS2 patch",
      type: "FIX", isDraft: false, publishedAt: new Date(Date.now() - 86400000),
      products: cs2Internal ? { create: { productId: cs2Internal.id } } : undefined,
    },
  });

  if (cs2Internal) {
    await prisma.product.update({
      where: { id: cs2Internal.id },
      data: { lastUpdateAt: new Date(Date.now() - 86400000) },
    });
  }

  await prisma.changelog.create({
    data: {
      title: "System Maintenance - Feb 2026",
      body: "## Notice\nScheduled maintenance window for infrastructure upgrades.",
      type: "INFO", isDraft: false, publishedAt: new Date(Date.now() - 172800000),
    },
  });
  console.log(`✅ Changelogs seeded`);

  // ─── Site Settings ───────────────────────────────
  const settings = [
    { key: "site_name", value: "Lity Software", type: "string", group: "general", label: "Site Name" },
    { key: "site_description", value: "Precision Cheats, Premium Protection", type: "string", group: "general", label: "Site Description" },
    { key: "hero_title", value: "Push your gameplay beyond limits with Lity Software.", type: "string", group: "hero", label: "Hero Title" },
    { key: "hero_subtitle", value: "A single Lity Software suite covers your play from awareness to action.", type: "string", group: "hero", label: "Hero Subtitle" },
    { key: "discord_url", value: "https://discord.gg/litysoftware", type: "string", group: "social", label: "Discord URL" },
    { key: "youtube_url", value: "", type: "string", group: "social", label: "YouTube URL" },
    { key: "instagram_url", value: "", type: "string", group: "social", label: "Instagram URL" },
    { key: "twitter_url", value: "", type: "string", group: "social", label: "X (Twitter) URL" },
    { key: "sellhub_url", value: "https://litysoftware.sellhub.cx/", type: "string", group: "social", label: "SellHub Store URL" },
    { key: "primary_color", value: "#7c3aed", type: "color", group: "theme", label: "Primary Color" },
    { key: "logo_url", value: "", type: "image", group: "general", label: "Logo" },
    { key: "favicon_url", value: "", type: "image", group: "general", label: "Favicon" },
    // Discord webhook
    { key: "discord_webhook_url", value: "", type: "string", group: "discord", label: "Discord Webhook URL" },
    { key: "discord_webhook_enabled", value: "false", type: "boolean", group: "discord", label: "Discord Webhook Enabled" },
    { key: "discord_webhook_username", value: "Lity Software", type: "string", group: "discord", label: "Webhook Bot Name" },
    { key: "discord_webhook_avatar_url", value: "", type: "string", group: "discord", label: "Webhook Avatar URL" },
    // Emergency
    { key: "maintenance_mode", value: "false", type: "boolean", group: "emergency", label: "Maintenance Mode" },
    { key: "disable_purchases", value: "false", type: "boolean", group: "emergency", label: "Disable Purchases" },
    { key: "public_api_pause", value: "false", type: "boolean", group: "emergency", label: "Public API Pause" },
    // Security
    { key: "whitelist_enabled", value: "false", type: "boolean", group: "security", label: "IP Whitelist Enabled" },
    { key: "global_allowed_cidrs", value: "[]", type: "json", group: "security", label: "Global Allowed CIDRs" },
    // Features
    { key: "status_changes_affect_last_update", value: "false", type: "boolean", group: "features", label: "Status Changes Affect Last Update" },
    { key: "payments_enabled", value: "false", type: "boolean", group: "features", label: "Payments Enabled" },
    { key: "portal_enabled", value: "false", type: "boolean", group: "features", label: "Client Portal Enabled" },
    { key: "public_env_switch_enabled", value: "false", type: "boolean", group: "features", label: "Public Environment Switch" },
    // Session
    { key: "admin_session_max_age_minutes", value: "4320", type: "number", group: "security", label: "Admin Session Max Age (minutes)" },
    { key: "admin_idle_timeout_minutes", value: "60", type: "number", group: "security", label: "Admin Idle Timeout (minutes)" },
    // Transparency
    { key: "transparency_enabled", value: "true", type: "boolean", group: "features", label: "Transparency Report Enabled" },
  ];

  for (const s of settings) {
    await prisma.siteSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log(`✅ Site settings seeded (${settings.length} keys)`);

  // ─── Welcome Notification ────────────────────────
  await prisma.adminNotification.create({
    data: {
      type: "SYSTEM",
      severity: "INFO",
      title: "Welcome to Lity Admin Panel",
      message: "Your admin panel has been set up successfully. Explore the dashboard to manage your products, analytics, and more.",
    },
  });
  console.log(`✅ Welcome notification created`);

  console.log("\n🎉 Seed completed!");
  console.log("──────────────────────────────────────");
  console.log("Admin:  admin@litysoftware.com / admin123");
  console.log("Editor: editor@litysoftware.com / editor123");
  console.log("──────────────────────────────────────");
}

main()
  .catch((e) => { console.error("❌ Seed error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
