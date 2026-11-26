import { ZEC_DECIMALS } from "@/lib/zcash";

export function formatZec(amount: number): string {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: ZEC_DECIMALS,
  })} ZEC`;
}

/** True for a positive-or-zero decimal string with at most Zcash's 8 decimals. */
export function isValidZecInput(value: string): boolean {
  return new RegExp(`^\\d+(\\.\\d{1,${ZEC_DECIMALS}})?$`).test(value.trim());
}

// Live and reference ZEC rates
export interface ZecRates {
  usd: number;
  ngn: number;
  lastUpdated: number;
}

// Realistic baseline reference rates (approx live ZEC market: ~$758 USD / ~₦1,030,880 NGN):
let cachedRates: ZecRates = {
  usd: 758.0,
  ngn: 1030880,
  lastUpdated: 0,
};

export async function getZecRates(): Promise<ZecRates> {
  const now = Date.now();
  // Return in-memory cache if under 60 seconds
  if (cachedRates.lastUpdated > 0 && now - cachedRates.lastUpdated < 60_000) {
    return cachedRates;
  }

  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("trustpay:zec-rates");
      if (stored) {
        const parsed = JSON.parse(stored) as ZecRates;
        if (parsed.usd > 0 && parsed.ngn > 0 && now - parsed.lastUpdated < 90_000) {
          cachedRates = parsed;
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }

  // 1. Try our internal server route first (cached server-side, no CORS or rate-limit blocks)
  try {
    const res = await fetch("/api/rates", { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = (await res.json()) as ZecRates;
      if (data?.usd > 0 && data?.ngn > 0) {
        cachedRates = {
          usd: data.usd,
          ngn: data.ngn,
          lastUpdated: now,
        };
        if (typeof window !== "undefined") {
          window.localStorage.setItem("trustpay:zec-rates", JSON.stringify(cachedRates));
        }
        return cachedRates;
      }
    }
  } catch {
    // Continue to external fallback
  }

  // 2. Direct CoinGecko fallback
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd,ngn", {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as { zcash?: { usd?: number; ngn?: number } };
      if (data?.zcash?.usd && data?.zcash?.ngn && data.zcash.usd > 0) {
        cachedRates = {
          usd: data.zcash.usd,
          ngn: data.zcash.ngn,
          lastUpdated: now,
        };
        if (typeof window !== "undefined") {
          window.localStorage.setItem("trustpay:zec-rates", JSON.stringify(cachedRates));
        }
        return cachedRates;
      }
    }
  } catch {
    // Return existing cached or baseline rates
  }

  return cachedRates;
}

export function formatZecEquivalents(zecAmount: number, rates?: { usd: number; ngn: number } | null): {
  usd: string;
  ngn: string;
  summary: string;
} {
  if (!Number.isFinite(zecAmount) || zecAmount <= 0) {
    return {
      usd: "$0.00",
      ngn: "₦0",
      summary: "≈ $0.00 USD / ₦0 NGN",
    };
  }

  const currentRates = rates ?? cachedRates;
  const usdVal = zecAmount * currentRates.usd;
  const ngnVal = zecAmount * currentRates.ngn;

  // Format USD accurately for tiny amounts
  let usd: string;
  if (usdVal < 0.01) {
    usd = "< $0.01";
  } else {
    usd = `$${usdVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Format NGN accurately from real rates for tiny and standard amounts
  let ngn: string;
  if (ngnVal < 1) {
    ngn = "< ₦1";
  } else if (ngnVal < 100) {
    ngn = `₦${ngnVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    ngn = `₦${Math.round(ngnVal).toLocaleString("en-US")}`;
  }

  const summary = `≈ ${usd} USD / ${ngn} NGN`;

  return { usd, ngn, summary };
}
