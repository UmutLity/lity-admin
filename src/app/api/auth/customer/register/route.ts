import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createCustomerToken } from "@/lib/customer-auth";
import { checkRateLimit, recordStrike, isIpBanned } from "@/lib/rate-limit";
import { appendReferrerToNotes, decodeReferralCode } from "@/lib/referrals";
import { corsPreflight, publicCorsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;

function json(req: NextRequest, body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...(publicCorsHeaders(req) || {}),
      ...(init.headers || {}),
    },
  });
}

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip") || "127.0.0.1";

    if (isIpBanned(ip)) {
      return json(req,
        { success: false, error: "Too many failed attempts. Please try again later." },
        { status: 429 }
      );
    }

    const rl = checkRateLimit(ip, "login");
    if (!rl.success) {
      recordStrike(ip);
      return json(req,
        { success: false, error: "Too many registration attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter || 60) } }
      );
    }

    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const email = String(body?.email || "").trim().toLowerCase();
    const username = String(body?.username || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const rawInviteCode = String(
      body?.inviteCode ||
      body?.invite ||
      body?.ref ||
      searchParams.get("invite") ||
      searchParams.get("ref") ||
      ""
    ).trim();

    if (!email || !username || !password) {
      return json(req, { success: false, error: "Email, username and password are required." }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return json(req, { success: false, error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!USERNAME_REGEX.test(username)) {
      return json(req, { success: false, error: "Username must be 3-30 chars and only contain letters, numbers, _ . -" }, { status: 400 });
    }

    if (password.length < 6) {
      return json(req, { success: false, error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const [existingEmail, existingUsername] = await Promise.all([
      prisma.customer.findUnique({ where: { email }, select: { id: true } }),
      prisma.customer.findUnique({ where: { username }, select: { id: true } }),
    ]);

    if (existingEmail) {
      return json(req, { success: false, error: "This email is already registered." }, { status: 409 });
    }

    if (existingUsername) {
      return json(req, { success: false, error: "This username is already taken." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const invitedById = rawInviteCode ? decodeReferralCode(rawInviteCode) : null;
    const referralEnabledSetting = await prisma.siteSetting.findUnique({ where: { key: "referral_enabled" } }).catch(() => null);
    const referralEnabled = referralEnabledSetting?.value !== "false";

    const customer = await prisma.customer.create({
      data: {
        email,
        username,
        password: passwordHash,
        role: "MEMBER",
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    if (referralEnabled && invitedById) {
      prisma.customer
        .update({
          where: { id: customer.id },
          data: { adminNotes: appendReferrerToNotes(null, invitedById) },
        })
        .catch((notesError) => {
          console.warn("Referral note update failed on customer registration:", notesError);
        });
    }

    if (referralEnabled && invitedById && invitedById !== customer.id) {
      try {
        const referrer = await prisma.customer.findUnique({
          where: { id: invitedById },
          select: { id: true, isActive: true, role: true, balance: true },
        });

        if (referrer && referrer.isActive && referrer.role !== "BANNED") {
          const existingReward = await prisma.balanceTransaction.findFirst({
            where: {
              customerId: referrer.id,
              reason: `REFERRAL_BONUS:${customer.id}`,
            },
            select: { id: true },
          });

          if (!existingReward) {
            const rewardSetting = await prisma.siteSetting.findUnique({ where: { key: "referral_reward_referrer" } }).catch(() => null);
            const rewardAmount = Math.max(0, Number(rewardSetting?.value || 5));

            if (rewardAmount > 0) {
              const before = Number(referrer.balance || 0);
              const after = before + rewardAmount;
              await prisma.$transaction([
                prisma.customer.update({
                  where: { id: referrer.id },
                  data: { balance: after },
                }),
                prisma.balanceTransaction.create({
                  data: {
                    customerId: referrer.id,
                    type: "CREDIT",
                    amount: rewardAmount,
                    balanceBefore: before,
                    balanceAfter: after,
                    reason: `REFERRAL_BONUS:${customer.id}`,
                  },
                }),
              ]);
            }
          }
        }
      } catch (referralError) {
        console.error("Referral bonus processing failed:", referralError);
      }
    }

    try {
      await prisma.adminNotification.create({
        data: {
          userId: null,
          type: "SYSTEM",
          severity: "INFO",
          title: "New customer registration",
          message: `${customer.username} registered with ${customer.email}.`,
          meta: JSON.stringify({
            customerId: customer.id,
            username: customer.username,
            email: customer.email,
            createdAt: customer.createdAt,
          }),
        },
      });
    } catch (notificationError) {
      console.error("Admin notification create failed on customer registration:", notificationError);
    }

    const token = createCustomerToken({
      id: customer.id,
      email: customer.email,
      username: customer.username,
    });

    return json(req, {
      success: true,
      data: {
        token,
        mustChangePassword: false,
        user: {
          ...customer,
          balance: 0,
          totalSpent: 0,
        },
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Customer register error:", error);
    return json(req, { success: false, error: "Server error" }, { status: 500 });
  }
}
