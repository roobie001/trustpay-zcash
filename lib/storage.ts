// Client-side storage and metadata resilience utilities for TrustPay

export type ZcashNetwork = "testnet" | "mainnet";

export interface SellerProfile {
  store_name: string;
  phone: string; // WhatsApp Phone Number
  social_handle?: string;
  payout_address: string;
  seller_secret_token?: string;
}

export interface BuyerProfile {
  name: string;
  dialCode: string;
  phone: string;
  doorstep_address?: string;
  landmark?: string;
}

export interface DealRecord {
  id: string;
  item_title: string;
  amount: number;
  delivery_fee?: number;
  role: "seller" | "buyer";
  status: string;
  created_at: string;
  sellerKey?: string;
  vendor_address?: string;
  release_txid?: string;
}

export interface DisputeMessage {
  id: string;
  sender: "buyer" | "seller" | "mediator";
  text: string;
  photoUrl?: string;
  createdAt: string;
}

export type PayoutStatus = "PROCESSING" | "SETTLED" | "FAILED";

export interface OrderMetadata {
  notes?: string;
  item_condition?: string;
  item_description?: string;
  doorstep_address?: string;
  landmark?: string;
  rider_phone?: string;
  waybill_notes?: string;
  dispute_category?: string;
  dispute_thread?: DisputeMessage[];
  payout_status?: PayoutStatus;
  settled_at?: string;
  payout_error?: string;
  dispatched_at?: string;
}

const SELLER_PROFILE_KEY = "trustpay:seller-profile";
const SELLER_TOKEN_KEY = "trustpay:seller-token";
const BUYER_PROFILE_KEY = "trustpay:buyer-profile";
const NETWORK_KEY = "trustpay:zcash-network";
const RECENT_DEALS_KEY = "trustpay:recent-deals";
const ORDER_META_PREFIX = "trustpay:order-meta:";

/* ==========================================================================
   Seller Profile
   ========================================================================== */

export function getSavedSellerProfile(): SellerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SELLER_PROFILE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as SellerProfile;
    const token = window.localStorage.getItem(SELLER_TOKEN_KEY);
    if (token && !profile.seller_secret_token) {
      profile.seller_secret_token = token;
    }
    return profile;
  } catch {
    return null;
  }
}

export function saveSellerProfile(profile: SellerProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SELLER_PROFILE_KEY, JSON.stringify(profile));
  if (profile.seller_secret_token) {
    window.localStorage.setItem(SELLER_TOKEN_KEY, profile.seller_secret_token);
  }
}

export function clearSellerProfile(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SELLER_PROFILE_KEY);
  window.localStorage.removeItem(SELLER_TOKEN_KEY);
}

/* ==========================================================================
   Buyer Profile
   ========================================================================== */

export function getSavedBuyerProfile(): BuyerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BUYER_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BuyerProfile;
  } catch {
    return null;
  }
}

export function saveBuyerProfile(profile: BuyerProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BUYER_PROFILE_KEY, JSON.stringify(profile));
}

/* ==========================================================================
   Network Environment (Testnet TAZ vs Mainnet ZEC)
   ========================================================================== */

export function getZcashNetwork(): ZcashNetwork {
  if (typeof window === "undefined") return "testnet";
  try {
    const val = window.localStorage.getItem(NETWORK_KEY);
    return val === "mainnet" ? "mainnet" : "testnet";
  } catch {
    return "testnet";
  }
}

export function setZcashNetwork(network: ZcashNetwork): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NETWORK_KEY, network);
}

/* ==========================================================================
   Recent Deals
   ========================================================================== */

export function getRecentDeals(): DealRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_DEALS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DealRecord[];
  } catch {
    return [];
  }
}

export function saveRecentDeal(deal: DealRecord): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecentDeals();
    const existingIndex = current.findIndex((d) => d.id === deal.id);
    let updated: DealRecord[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...current[existingIndex], ...deal };
    } else {
      updated = [deal, ...current].slice(0, 50); // keep up to 50 recent deals
    }
    window.localStorage.setItem(RECENT_DEALS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeRecentDeals(newDeals: DealRecord[]): void {
  if (typeof window === "undefined" || !newDeals.length) return;
  try {
    const current = getRecentDeals();
    const map = new Map<string, DealRecord>();
    for (const d of current) map.set(d.id, d);
    for (const d of newDeals) {
      const existing = map.get(d.id);
      map.set(d.id, existing ? { ...existing, ...d } : d);
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    window.localStorage.setItem(RECENT_DEALS_KEY, JSON.stringify(merged.slice(0, 50)));
  } catch {
    // Ignore storage quota errors
  }
}

export function updateDealStatus(id: string, status: string, releaseTxid?: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecentDeals();
    const match = current.find((d) => d.id === id);
    if (match) {
      match.status = status;
      if (releaseTxid) match.release_txid = releaseTxid;
      window.localStorage.setItem(RECENT_DEALS_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore
  }
}

/* ==========================================================================
   Order Metadata Schema Resilience Helpers
   ========================================================================== */

/**
 * Parses delivery_notes which may be plain text or a serialized OrderMetadata JSON.
 * Returns both the user-facing notes and the full metadata object.
 */
export function parseOrderMetadata(notesText: string | null | undefined): {
  userNotes: string;
  metadata: OrderMetadata;
} {
  if (!notesText || typeof notesText !== "string") {
    return { userNotes: "", metadata: {} };
  }
  const trimmed = notesText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed) as OrderMetadata;
      if (parsed && typeof parsed === "object") {
        return {
          userNotes: parsed.notes || "",
          metadata: parsed,
        };
      }
    } catch {
      // Fallback to plain string
    }
  }
  return { userNotes: trimmed, metadata: { notes: trimmed } };
}

/**
 * Encodes user notes + metadata dictionary into a single robust JSON string
 * that safely stores in the existing delivery_notes column.
 */
export function encodeOrderMetadata(userNotes: string, metadata: OrderMetadata): string {
  const merged: OrderMetadata = {
    ...metadata,
    notes: userNotes || metadata.notes || "",
  };
  return JSON.stringify(merged);
}

/**
 * Applies a partial update to an existing delivery_notes string without losing existing metadata.
 */
export function mergeOrderMetadata(
  existingNotes: string | null | undefined,
  patch: Partial<OrderMetadata>
): string {
  const { userNotes, metadata } = parseOrderMetadata(existingNotes);
  const updatedMeta: OrderMetadata = {
    ...metadata,
    ...patch,
  };
  if (patch.notes !== undefined) {
    updatedMeta.notes = patch.notes;
  }
  return encodeOrderMetadata(updatedMeta.notes || userNotes, updatedMeta);
}

/* Local storage metadata fallback / cache */
export function getLocalOrderMetadata(orderId: string): OrderMetadata {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`${ORDER_META_PREFIX}${orderId}`);
    return raw ? (JSON.parse(raw) as OrderMetadata) : {};
  } catch {
    return {};
  }
}

export function setLocalOrderMetadata(orderId: string, meta: OrderMetadata): void {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalOrderMetadata(orderId);
    window.localStorage.setItem(
      `${ORDER_META_PREFIX}${orderId}`,
      JSON.stringify({ ...current, ...meta })
    );
  } catch {
    // Ignore
  }
}

/* ==========================================================================
   WhatsApp One-Tap Share Link Helper
   ========================================================================== */

export function buildWhatsAppShareUrl({
  itemTitle,
  zecAmount,
  orderUrl,
  usdNgnText,
}: {
  itemTitle: string;
  zecAmount: number;
  orderUrl: string;
  usdNgnText?: string;
}): string {
  const priceInfo = usdNgnText ? ` (${usdNgnText})` : "";
  const message =
    `Hi! Complete your private purchase for "${itemTitle}" (${zecAmount} ZEC${priceInfo}) via TrustPay Shielded Escrow:\n\n` +
    `🔗 Order Link: ${orderUrl}\n\n` +
    `🛡️ Escrow Guarantee: Your funds remain securely locked in the TrustPay Shielded Vault and will NOT be released to the vendor until you receive and inspect your package.`;

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
