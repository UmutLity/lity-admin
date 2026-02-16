import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { buildChangelogEmbed, buildWebhookPayload } from "@/lib/discord";

// POST /api/admin/discord/embed - Generate Discord embed JSON for a changelog
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { changelogId } = await req.json();

    if (!changelogId) {
      return NextResponse.json({ success: false, error: "changelogId required" }, { status: 400 });
    }

    const changelog = await prisma.changelog.findUnique({
      where: { id: changelogId },
      include: {
        products: {
          include: { product: { select: { name: true, status: true } } },
        },
      },
    });

    if (!changelog) {
      return NextResponse.json({ success: false, error: "Changelog not found" }, { status: 404 });
    }

    const usernameSetting = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_username" } });
    const avatarSetting = await prisma.siteSetting.findUnique({ where: { key: "discord_webhook_avatar_url" } });

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

    const fullPayload = buildWebhookPayload(
      embed,
      usernameSetting?.value || undefined,
      avatarSetting?.value || undefined
    );

    return NextResponse.json({
      success: true,
      data: {
        embed,
        fullPayload,
        json: JSON.stringify(fullPayload, null, 2),
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
