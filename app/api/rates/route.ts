import { NextResponse } from "next/server";

interface RateResponse {
  usd: number;
  ngn: number;
  lastUpdated: number;
}

// In-memory server cache (TTL: 60s)
let serverRateCache: RateResponse = {
  usd: 758.0,
  ngn: 1030880,
  lastUpdated: 0,
};

export async function GET() {
  const now = Date.now();
  // Return cached rates if fresh (< 60s)
  if (serverRateCache.lastUpdated > 0 && now - serverRateCache.lastUpdated < 60_000) {
    return NextResponse.json(serverRateCache, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  }

  // 1. Primary: CoinGecko Zcash simple price
  try {
    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd,ngn",
      {
        signal: AbortSignal.timeout(3500),
        headers: { Accept: "application/json" },
      }
    );
    if (cgRes.ok) {
      const data = (await cgRes.json()) as { zcash?: { usd?: number; ngn?: number } };
      if (data?.zcash?.usd && data?.zcash?.ngn && data.zcash.usd > 0) {
        serverRateCache = {
          usd: Number(data.zcash.usd),
          ngn: Number(data.zcash.ngn),
          lastUpdated: now,
        };
        return NextResponse.json(serverRateCache, {
          headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
        });
      }
    }
  } catch {
    // Continue to fallback provider
  }

  // 2. Secondary fallback: Binance ZECUSDT ticker + USD/NGN FX reference
  try {
    const bRes = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=ZECUSDT", {
      signal: AbortSignal.timeout(3000),
    });
    if (bRes.ok) {
      const bData = (await bRes.json()) as { price?: string };
      const usdPrice = Number.parseFloat(bData.price ?? "0");
      if (usdPrice > 0) {
        // Compute realistic NGN value (current FX ~1,360 NGN per USD)
        const ngnPrice = Math.round(usdPrice * 1360);
        serverRateCache = {
          usd: usdPrice,
          ngn: ngnPrice,
          lastUpdated: now,
        };
        return NextResponse.json(serverRateCache, {
          headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
        });
      }
    }
  } catch {
    // Fall back to server cache or baseline
  }

  if (serverRateCache.lastUpdated === 0) {
    serverRateCache.lastUpdated = now;
  }

  return NextResponse.json(serverRateCache, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
