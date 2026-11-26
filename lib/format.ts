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

// Default fallback reference rates if offline or rate-limited:
// 1 ZEC ≈ $42.50 USD; 1 USD ≈ 1,450 NGN -> 1 ZEC ≈ ₦61,625 NGN
let cachedRates: ZecRates = {
  usd: 42.5,
  ngn: 61625,
  lastUpdated: 0,
};

export async function getZecRates(): Promise<ZecRates> {
  const now = Date.now();
  // Cache for 60 seconds
  if (cachedRates.lastUpdated > 0 && now - cachedRates.lastUpdated < 60_000) {
    return cachedRates;
  }

  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("trustpay:zec-rates");
      if (stored) {
        const parsed = JSON.parse(stored) as ZecRates;
        if (parsed.usd && parsed.ngn && now - parsed.lastUpdated < 120_000) {
          cachedRates = parsed;
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }

  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd,ngn", {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as { zcash?: { usd?: number; ngn?: number } };
      if (data?.zcash?.usd && data?.zcash?.ngn) {
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
    // Return existing cached or fallback rates
  }

  return cachedRates;
}

export function formatZecEquivalents(zecAmount: number, rates?: { usd: number; ngn: number } | null): {
  usd: string;
  ngn: string;
  summary: string;
} {
  const currentRates = rates ?? cachedRates;
  const usdVal = zecAmount * currentRates.usd;
  const ngnVal = zecAmount * currentRates.ngn;

  const usd = `$${usdVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const ngn = `₦${Math.round(ngnVal).toLocaleString("en-US")}`;
  const summary = `≈ ${usd} USD / ${ngn} NGN`;

  return { usd, ngn, summary };
}
