import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RATE_SOURCES = [
  "https://api.frankfurter.app/latest?from=USD&to=TRY",
  "https://open.er-api.com/v6/latest/USD",
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
  "https://api.exchangerate.host/latest?base=USD&symbols=TRY",
];

function parseUsdTryRate(payload: any): number | null {
  const rate = Number(
    payload?.rate ||
      payload?.rates?.TRY ||
      payload?.rates?.try ||
      payload?.conversion_rates?.TRY ||
      payload?.usd?.try ||
      0
  );
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export async function GET() {
  for (const source of RATE_SOURCES) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) continue;
      const data = await response.json();
      const rate = parseUsdTryRate(data);
      if (!(rate && rate > 0)) continue;

      return NextResponse.json({
        success: true,
        base: "USD",
        quote: "TRY",
        rate,
        source,
        fetchedAt: Date.now(),
      });
    } catch (error) {
      console.error("[exchange/usd-try] source failed:", source, error);
    }
  }

  return NextResponse.json(
    { success: false, error: "Could not fetch USD/TRY rate from any source." },
    { status: 503 }
  );
}

