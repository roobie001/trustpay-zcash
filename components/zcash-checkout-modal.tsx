"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Loader2, QrCode, Shield, ShieldCheck, Wallet, X } from "lucide-react";
import type { EscrowOrder } from "@/lib/supabase";
import {
  buildZcashPaymentUri,
  encodeMemoBase64Url,
  formatZec,
  hasInjectedZcashWallet,
  isTestnetZcashAddress,
  orderMemoPayload,
} from "@/lib/zcash";
import { describeTxError, useZcashWallet } from "@/lib/use-escrow";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

type CheckoutTab = "scan" | "manual";

export function ZcashCheckoutModal({
  open,
  order,
  amount,
  onClose,
  onPaymentSubmitted,
}: {
  open: boolean;
  order: EscrowOrder;
  amount: number;
  onClose: () => void;
  onPaymentSubmitted: (txid: string, buyerAddress?: string) => void;
}) {
  const [tab, setTab] = useState<CheckoutTab>("scan");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual Paste Txid Verification State
  const [pasteTxid, setPasteTxid] = useState("");
  const [verifyingTxid, setVerifyingTxid] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const isTestnet = isTestnetZcashAddress(order.escrow_vault_address);
  const wallet = useZcashWallet();
  const providerAvailable = useSyncExternalStore(
    () => () => undefined,
    hasInjectedZcashWallet,
    () => false
  );

  const memo = orderMemoPayload(order.id);
  const encodedMemo = useMemo(() => encodeMemoBase64Url(memo), [memo]);

  const uri = useMemo(() => {
    try {
      return buildZcashPaymentUri({
        address: order.escrow_vault_address,
        amountZec: amount,
        orderId: order.id,
        label: "TrustPay Escrow",
      });
    } catch {
      return null;
    }
  }, [amount, order.escrow_vault_address, order.id]);

  // Handle ESC key to close
  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  // Live On-Chain Polling: poll /api/orders/[id]/verify-payment every 4 seconds while open
  useEffect(() => {
    if (!open) return;
    let active = true;

    async function pollVerification() {
      try {
        const res = await fetch(`/api/orders/${order.id}/verify-payment`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          verified?: boolean;
          txid?: string;
          status?: string;
        };
        if (active && data.verified && data.txid) {
          onPaymentSubmitted(data.txid);
        }
      } catch {
        // Continue polling
      }
    }

    const interval = window.setInterval(() => {
      void pollVerification();
    }, 4000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [open, order.id, onPaymentSubmitted]);

  async function copy(value: string, name: string) {
    await navigator.clipboard.writeText(value);
    setCopied(name);
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function connectProvider() {
    setError(null);
    try {
      await wallet.connect();
    } catch (reason) {
      setError(describeTxError(reason));
    }
  }

  async function payWithProvider() {
    setError(null);
    try {
      const address = wallet.address ?? (await wallet.connect());
      const result = await wallet.sendShieldedPayment({
        recipient: order.escrow_vault_address,
        amount,
        memo,
      });
      onPaymentSubmitted(result.txid, address);
    } catch (reason) {
      setError(describeTxError(reason));
    }
  }

  // Real On-Chain Transaction Hash Verification via POST /api/orders/[id]/verify-payment
  async function handleVerifyTxid() {
    setVerifyError(null);
    const cleanTxid = pasteTxid.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(cleanTxid)) {
      setVerifyError("Enter a valid 64-character hexadecimal transaction ID.");
      return;
    }

    setVerifyingTxid(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txid: cleanTxid }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        verified?: boolean;
        txid?: string;
        error?: string;
      };

      if (!response.ok || !data.success || !data.txid) {
        throw new Error(data.error || "Unable to verify transaction on-chain.");
      }

      onPaymentSubmitted(data.txid);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifyingTxid(false);
    }
  }

  if (!open) return null;

  const fields = [
    ["Escrow Unified Address", order.escrow_vault_address, "address"],
    ["Exact Amount", amount.toFixed(8), "amount"],
    ["Required Order Memo (Base64URL)", encodedMemo, "memo"],
    ["Plain Memo Reference", memo, "plainMemo"],
  ] as const;

  const tabs: { id: CheckoutTab; label: string; icon: typeof QrCode }[] = [
    { id: "scan", label: "Scan / Open", icon: QrCode },
    { id: "manual", label: "Manual transfer", icon: Copy },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zcash-checkout-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-800/80 bg-[#0F172A] p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                Private Shielded Checkout
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                {isTestnet ? "TAZ Testnet" : "ZEC Mainnet"}
              </span>
            </div>
            <h2 id="zcash-checkout-title" className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-white">
              Pay <span className="tabular-nums text-amber-500">{formatZec(amount)}</span> with Zcash
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-[#030712] p-1.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setError(null);
                setVerifyError(null);
              }}
              className={`flex min-h-[42px] items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition-colors ${
                tab === id
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Scan / Open QR */}
        {tab === "scan" && (
          <div className="mt-5 text-center">
            {uri ? (
              <>
                <div className="mx-auto w-fit rounded-2xl bg-white p-4 shadow-lg flex items-center justify-center">
                  <QRCodeSVG value={uri} size={210} includeMargin />
                </div>
                <p className="mt-3.5 text-xs sm:text-sm font-medium text-slate-300">
                  Scan with your mobile wallet (Zingo, Zashi, YWallet) or open directly:
                </p>
                <a href={uri} className={`${primaryButtonClass} mt-3.5 w-full py-3.5 text-sm`}>
                  <Wallet className="h-4 w-4" />
                  Open in Zcash Wallet
                </a>
              </>
            ) : (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
                The escrow vault address is not a valid Zcash address.
              </p>
            )}

            {/* Live Listening Indicator */}
            <div className="mt-4 flex items-center justify-center gap-2.5 rounded-xl border border-slate-800 bg-[#030712] py-2.5 px-3.5 text-xs text-slate-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
              <span>Listening for on-chain deposit on {isTestnet ? "TAZ Testnet" : "ZEC Mainnet"}…</span>
            </div>

            {/* Paste TxID Verification Section */}
            <div className="mt-4 rounded-xl border border-slate-800 bg-[#030712] p-4 text-left shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Already paid in Zingo / Zashi?
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Paste your 64-character Transaction ID (<code className="text-amber-400">txid</code>) to verify and lock funds immediately:
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={pasteTxid}
                  onChange={(e) => setPasteTxid(e.target.value)}
                  placeholder="64-character hex txid"
                  className={`${inputClass} font-mono text-xs flex-1`}
                />
                <button
                  type="button"
                  onClick={handleVerifyTxid}
                  disabled={verifyingTxid || !pasteTxid.trim()}
                  className={`${primaryButtonClass} text-xs font-semibold px-4 py-2.5 shrink-0`}
                >
                  {verifyingTxid ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify On-Chain"}
                </button>
              </div>
              {verifyError && (
                <p className="mt-2 text-xs text-red-400 leading-relaxed">{verifyError}</p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Manual Transfer */}
        {tab === "manual" && (
          <div className="mt-5 space-y-3.5">
            {fields.map(([label, value, name]) => (
              <div key={name}>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</label>
                  <button
                    type="button"
                    onClick={() => void copy(value, name)}
                    className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                  >
                    {copied === name ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === name ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="break-all select-all rounded-xl border border-slate-800 bg-[#030712] p-2.5 font-mono text-xs text-slate-200">
                  {value}
                </div>
              </div>
            ))}

            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
              The encrypted memo binds this payment to your order ID. Paste your transaction ID below after sending:
            </p>

            {/* Paste TxID Verification in Manual Tab */}
            <div className="space-y-2">
              <input
                value={pasteTxid}
                onChange={(e) => setPasteTxid(e.target.value)}
                placeholder="Paste 64-character txid (hex)"
                className={`${inputClass} font-mono text-xs`}
              />
              <button
                type="button"
                onClick={handleVerifyTxid}
                disabled={verifyingTxid || !pasteTxid.trim()}
                className={`${primaryButtonClass} w-full`}
              >
                {verifyingTxid ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verify On-Chain Deposit
              </button>
              {verifyError && (
                <p className="text-xs text-red-400">{verifyError}</p>
              )}
            </div>

            {/* Connected Browser Wallet Option */}
            {wallet.isConnected ? (
              <button
                type="button"
                onClick={() => void payWithProvider()}
                disabled={wallet.pending}
                className={`${primaryButtonClass} w-full`}
              >
                {wallet.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Pay with Connected Zcash Wallet
              </button>
            ) : providerAvailable ? (
              <button
                type="button"
                onClick={() => void connectProvider()}
                disabled={wallet.pending}
                className={`${secondaryButtonClass} w-full`}
              >
                <Wallet className="h-4 w-4" />
                Quick-connect Injected Zcash Wallet
              </button>
            ) : null}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
