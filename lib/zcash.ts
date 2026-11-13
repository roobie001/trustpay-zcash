export const ZEC_DECIMALS = 8;
export const ZCASH_MEMO_BYTES = 512;

export type ZcashAddress = string;

export interface ShieldedPaymentRequest {
  recipient: ZcashAddress;
  amount: number;
  memo: string;
}

export interface ZcashWallet {
  connect(): Promise<{ address: ZcashAddress }>;
  disconnect?(): Promise<void>;
  getAddress?(): Promise<ZcashAddress>;
  sendShieldedPayment(
    request: ShieldedPaymentRequest,
  ): Promise<{ txid: string }>;
}

export interface ZcashPaymentUriInput {
  address: ZcashAddress;
  amountZec: number;
  orderId: string;
  label?: string;
  message?: string;
}

export interface EphemeralZcashWallet {
  address: ZcashAddress;
  network: "testnet";
  balanceZec: number;
  createdAt: string;
}

declare global {
  interface Window {
    zcash?: ZcashWallet;
  }
}

export function isZcashAddress(value: string): boolean {
  if (typeof value !== "string") return false;
  const address = value.trim();
  return /^(?:u1|utest1|zs1|ztestsapling1)[a-z0-9]{20,}$/i.test(address);
}

export function isTestnetZcashAddress(value: string): boolean {
  if (typeof value !== "string") return false;
  const address = value.trim();
  return /^(?:utest1|ztestsapling1)[a-z0-9]{20,}$/i.test(address);
}

export function isValidZecInput(value: string): boolean {
  return /^\d+(\.\d{1,8})?$/.test(value.trim());
}

export function formatZec(value: number): string {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: ZEC_DECIMALS,
  })} ZEC`;
}

export function shortZcashAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function hasInjectedZcashWallet(): boolean {
  return typeof window !== "undefined" && Boolean(window.zcash);
}

export function explorerTxUrl(txid: string): string {
  const base =
    process.env.NEXT_PUBLIC_ZCASH_EXPLORER_URL ??
    "https://zcashblockexplorer.com/tx";
  return `${base.replace(/\/$/, "")}/${encodeURIComponent(txid)}`;
}

export function createOrderMemo(
  orderId: string,
  payload: Record<string, string>,
): string {
  const memo = `TRUSTPAY:${orderId}:${JSON.stringify(payload)}`;
  const bytes = new TextEncoder().encode(memo);
  if (bytes.length > ZCASH_MEMO_BYTES) {
    throw new Error(
      "Order metadata exceeds Zcash's 512-byte encrypted memo limit.",
    );
  }
  return memo;
}

export function encodeMemoBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Builds a ZIP-321-compatible payment URI with a base64url encrypted-memo payload. */
export function buildZcashPaymentUri({
  address,
  amountZec,
  orderId,
  label,
  message,
}: ZcashPaymentUriInput): string {
  if (!isZcashAddress(address))
    throw new Error("A valid Zcash Unified Address is required.");
  if (!Number.isFinite(amountZec) || amountZec <= 0)
    throw new Error("Payment amount must be positive.");
  if (Number(amountZec.toFixed(ZEC_DECIMALS)) !== amountZec)
    throw new Error("Payment amount cannot have more than 8 decimal places.");
  const memoPayload = `TRUSTPAY:${orderId}${message ? `:${message}` : ""}`;
  const memoBytes = new TextEncoder().encode(memoPayload);
  if (memoBytes.length > ZCASH_MEMO_BYTES) {
    throw new Error(
      "Order memo exceeds Zcash's 512-byte encrypted memo limit.",
    );
  }
  const params = new URLSearchParams({
    amount: amountZec.toFixed(ZEC_DECIMALS),
    memo: encodeMemoBase64Url(memoPayload),
  });
  if (label?.trim()) params.set("label", label.trim());
  return `zcash:${address}?${params.toString()}`;
}

export function orderMemoPayload(orderId: string, message?: string): string {
  return `TRUSTPAY:${orderId}${message ? `:${message}` : ""}`;
}

export function loadEphemeralZcashWallet(): EphemeralZcashWallet | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("trustpay:ephemeral-zcash-wallet");
  if (!raw) return null;
  try {
    const wallet = JSON.parse(raw) as EphemeralZcashWallet;
    return wallet.network === "testnet" && isTestnetZcashAddress(wallet.address)
      ? wallet
      : null;
  } catch {
    return null;
  }
}

export function createEphemeralZcashWallet(): EphemeralZcashWallet {
  const wallet: EphemeralZcashWallet = {
    address: `ztestsapling1${crypto.randomUUID().replace(/-/g, "")}`,
    network: "testnet",
    balanceZec: 0,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    "trustpay:ephemeral-zcash-wallet",
    JSON.stringify(wallet),
  );
  return wallet;
}
