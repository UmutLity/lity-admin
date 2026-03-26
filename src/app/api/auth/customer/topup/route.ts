import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCustomerTokenFromRequest, verifyCustomerToken } from "@/lib/customer-auth";

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

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthedCustomer(req);
    if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const [rows, requests] = await Promise.all([
      prisma.siteSetting.findMany({
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
      }),
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
          reviewNote: true,
          createdAt: true,
          approvedAt: true,
          rejectedAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        instructions: normalizeInstructionMap(rows),
        requests,
      },
    });
  } catch (error) {
    console.error("GET /api/auth/customer/topup error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthedCustomer(req);
    if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const senderName = String(body.senderName || "").trim();
    const senderBankName = String(body.senderBankName || "").trim();
    const amount = Number(body.amount);
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (senderName.length < 2 || senderName.length > 120) {
      return NextResponse.json({ success: false, error: "Sender account name must be 2-120 characters." }, { status: 400 });
    }
    if (senderBankName.length < 2 || senderBankName.length > 120) {
      return NextResponse.json({ success: false, error: "Bank name must be 2-120 characters." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json({ success: false, error: "Amount must be between 0.01 and 1000000." }, { status: 400 });
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

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/auth/customer/topup error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
