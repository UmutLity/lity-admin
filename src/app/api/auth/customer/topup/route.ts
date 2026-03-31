import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";
import { sendTopUpNotificationToDiscord } from "@/lib/discord";
import { uploadFile } from "@/lib/upload";

function isSchemaMismatch(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("P2021") || message.includes("P2022");
}

function normalizeInstructionMap(rows: Array<{ key: string; value: string }>) {
  const map = new Map(rows.map((x) => [x.key, x.value]));
  return {
    ibanHolder: map.get("manual_topup_iban_holder") || "-",
    ibanNumber: map.get("manual_topup_iban_number") || "-",
    ibanBankName: map.get("manual_topup_iban_bank_name") || "-",
    cryptoNetwork: map.get("manual_topup_crypto_network") || "-",
    cryptoAddress: map.get("manual_topup_crypto_address") || "-",
    note: map.get("manual_topup_note") || "Transfer sonrası formu doldurup talep oluşturun.",
  };
}

async function getAuthedCustomer(req: NextRequest) {
  const token = getCustomerTokenFromRequest(req);
  if (!token) return { error: "Token required", status: 401 as const };
  const payload = verifyCustomerToken(token);
  if (!payload) return { error: "Invalid or expired token", status: 401 as const };

  const customer = await prisma.customer.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, username: true, role: true, isActive: true },
  });
  if (!customer) return { error: "Account not found", status: 404 as const };
  if (!customer.isActive || customer.role === "BANNED") return { error: "Your account is not eligible.", status: 403 as const };
  return { customer };
}

function corsHeaders(req?: NextRequest) {
  const origin = req?.headers.get("origin") || "";
  const allowed = new Set([
    "https://litysoftware.com",
    "https://www.litysoftware.com",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ]);
  const allowOrigin = allowed.has(origin) ? origin : "https://litysoftware.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthedCustomer(req);
    if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status, headers: corsHeaders(req) });

    const rowsPromise = prisma.siteSetting.findMany({
      where: {
        key: {
          in: [
            "manual_topup_iban_holder",
            "manual_topup_iban_number",
            "manual_topup_iban_bank_name",
            "manual_topup_crypto_network",
            "manual_topup_crypto_address",
            "manual_topup_note",
          ],
        },
      },
      select: { key: true, value: true },
    });

    const [rows, requests] = await Promise.all([
      rowsPromise,
      prisma.topUpRequest.findMany({
        where: { customerId: auth.customer.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          senderName: true,
          senderBankName: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      }).then((legacyRows) =>
        legacyRows.map((row) => ({
          ...row,
          reviewNote: null,
          proofImageUrl: null,
          approvedAt: null,
          rejectedAt: null,
        }))
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        instructions: normalizeInstructionMap(rows),
        requests,
      },
    }, { headers: corsHeaders(req) });
  } catch (error) {
    console.error("GET /api/auth/customer/topup error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500, headers: corsHeaders(req) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthedCustomer(req);
    if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status, headers: corsHeaders(req) });

    const contentType = req.headers.get("content-type") || "";
    let senderName = "";
    let senderBankName = "";
    let amount = Number.NaN;
    let note = "";
    let proofImageUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      senderName = String(form.get("senderName") || "").trim();
      senderBankName = String(form.get("senderBankName") || "").trim();
      amount = Number(form.get("amount"));
      note = String(form.get("note") || "").trim();
      const screenshot = form.get("screenshot");
      if (screenshot instanceof File && screenshot.size > 0) {
        try {
          const uploaded = await uploadFile(screenshot);
          proofImageUrl = uploaded.url;
        } catch (uploadError) {
          console.error("Top-up screenshot upload failed, continuing without proof image:", uploadError);
          proofImageUrl = null;
        }
      }
    } else {
      const body = await req.json().catch(() => ({}));
      senderName = String(body.senderName || "").trim();
      senderBankName = String(body.senderBankName || "").trim();
      amount = Number(body.amount);
      note = typeof body.note === "string" ? body.note.trim() : "";
      proofImageUrl = typeof body.proofImageUrl === "string" && body.proofImageUrl.trim() ? body.proofImageUrl.trim() : null;
    }

    if (senderName.length < 2 || senderName.length > 120) {
      return NextResponse.json({ success: false, error: "Sender account name must be 2-120 characters." }, { status: 400, headers: corsHeaders(req) });
    }
    if (senderBankName.length < 2 || senderBankName.length > 120) {
      return NextResponse.json({ success: false, error: "Bank name must be 2-120 characters." }, { status: 400, headers: corsHeaders(req) });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json({ success: false, error: "Amount must be between 0.01 and 1000000." }, { status: 400, headers: corsHeaders(req) });
    }

    const created = await prisma.topUpRequest.create({
      data: {
        customerId: auth.customer.id,
        senderName,
        senderBankName,
        amount,
        note: note || null,
      },
      select: {
        id: true,
        senderName: true,
        senderBankName: true,
        amount: true,
        status: true,
        note: true,
        createdAt: true,
      },
    });

    if (proofImageUrl) {
      try {
        await prisma.topUpRequest.update({
          where: { id: created.id },
          data: { proofImageUrl },
        });
      } catch (error) {
        if (!isSchemaMismatch(error)) {
          console.error("Failed to attach top-up proof image:", error);
        }
      }
    }

    sendTopUpNotificationToDiscord({
      amount,
      senderName,
      senderBankName,
      note: note || null,
      proofImageUrl,
      customerEmail: auth.customer.email,
      customerUsername: auth.customer.username,
    }).catch((error) => {
      console.error("Top-up Discord webhook error:", error);
    });

    return NextResponse.json({
      success: true,
      data: {
        ...created,
        proofImageUrl,
      },
    }, { status: 201, headers: corsHeaders(req) });
  } catch (error) {
    console.error("POST /api/auth/customer/topup error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500, headers: corsHeaders(req) });
  }
}
