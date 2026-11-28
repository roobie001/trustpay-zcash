"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import type { EscrowOrder } from "@/lib/supabase";
import { explorerTxUrl, formatZec, shortZcashAddress } from "@/lib/zcash";
import {
  parseOrderMetadata,
  type PayoutStatus,
  getZcashNetwork,
} from "@/lib/storage";
import { cardClass, primaryButtonClass } from "@/lib/ui";

interface SellerSettlementCardProps {
  order: EscrowOrder;
  onSettlementUpdated?: (newStatus: PayoutStatus) => void;
  onRetryPayout?: () => Promise<void>;
}

export function SellerSettlementCard({
  order,
  onSettlementUpdated,
  onRetryPayout,
}: SellerSettlementCardProps) {
  const { metadata } = parseOrderMetadata(order.delivery_notes);
  const payoutStatus: PayoutStatus = metadata.payout_status ?? "PROCESSING";
  const settledAt = metadata.settled_at;
  const payoutError = metadata.payout_error;

  const [copiedTxid, setCopiedTxid] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const totalPayout = Number(order.amount) + Number(order.delivery_fee);
  const txid = order.release_txid || "mock_relayer_txid_released";
  const isTestnet =
    getZcashNetwork() === "testnet" ||
    order.escrow_vault_address.startsWith("utest1") ||
    order.escrow_vault_address.startsWith("tm");

  const [testnetSecondsLeft, setTestnetSecondsLeft] = useState<number | null>(() =>
    isTestnet && payoutStatus === "PROCESSING" ? 15 : null
  );

  // Auto-settling countdown timer for Testnet mode
  useEffect(() => {
    if (payoutStatus !== "PROCESSING" || !isTestnet) return;

    const interval = window.setInterval(() => {
      setTestnetSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          window.clearInterval(interval);
          void handleConfirmReceipt();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payoutStatus, isTestnet, order.id]);

  async function copyValue(val: string, type: "txid" | "addr") {
    await navigator.clipboard.writeText(val);
    if (type === "txid") {
      setCopiedTxid(true);
      setTimeout(() => setCopiedTxid(false), 2000);
    } else {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  }

  async function handleConfirmReceipt() {
    if (updating) return;
    setUpdating(true);
    try {
      const now = new Date().toISOString();
      const res = await fetch(`/api/orders/${order.id}/meta`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payout_status: "SETTLED",
          settled_at: now,
        }),
      });
      if (res.ok) {
        onSettlementUpdated?.("SETTLED");
      }
    } catch (err) {
      console.error("Failed to mark settled:", err);
    } finally {
      setUpdating(false);
    }
  }

  async function handleRetry() {
    if (retrying || !onRetryPayout) return;
    setRetrying(true);
    try {
      await onRetryPayout();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className={`${cardClass} overflow-hidden border-slate-800/80 p-5 sm:p-6 shadow-xl`}>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-white">Two-Stage Seller Settlement</h3>
            <p className="text-xs text-slate-400">Direct shielded payout to your registered vendor address</p>
          </div>
        </div>

        {/* Status Pill */}
        {payoutStatus === "PROCESSING" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold tracking-wider uppercase text-amber-300">
            <Clock className="h-3.5 w-3.5 animate-pulse" />
            PROCESSING
          </span>
        )}
        {payoutStatus === "SETTLED" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wider uppercase text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            SETTLED
          </span>
        )}
        {payoutStatus === "FAILED" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold tracking-wider uppercase text-red-300">
            <AlertCircle className="h-3.5 w-3.5" />
            FAILED
          </span>
        )}
      </div>

      {/* STATE 1: PROCESSING */}
      {payoutStatus === "PROCESSING" && (
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200">
            <p className="leading-relaxed text-xs">
              <span className="font-semibold text-amber-300">Zcash Block Confirmation Note:</span> Zcash
              blocks confirm in ~75 seconds. Once the incoming transaction appears in your wallet, confirm
              receipt below to settle your ledger.
            </p>
            {isTestnet && testnetSecondsLeft !== null && testnetSecondsLeft > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-500/30 bg-black/30 px-3.5 py-2 font-mono text-xs">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Auto-confirming on TAZ Testnet...
                </span>
                <span className="font-bold tabular-nums text-amber-400">{testnetSecondsLeft}s</span>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-[#030712] p-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Net ZEC Payout</span>
              <strong className="mt-1 block font-mono text-2xl font-bold tabular-nums text-amber-400">
                {formatZec(totalPayout)}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#030712] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Destination Address</span>
                <button
                  type="button"
                  onClick={() => void copyValue(order.vendor_address, "addr")}
                  className="inline-flex min-h-[28px] items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                >
                  {copiedAddress ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedAddress ? "Copied" : "Copy"}
                </button>
              </div>
              <span className="mt-1.5 block font-mono text-xs text-slate-200">
                {shortZcashAddress(order.vendor_address)}
              </span>
            </div>
          </div>

          {/* Txid block */}
          <div className="rounded-xl border border-slate-800 bg-[#030712] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Broadcast Transaction ID (txid)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyValue(txid, "txid")}
                  className="inline-flex min-h-[28px] items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                >
                  {copiedTxid ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedTxid ? "Copied" : "Copy"}
                </button>
                <a
                  href={explorerTxUrl(txid, isTestnet)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[28px] items-center gap-1 rounded-md px-2 py-0.5 text-xs text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ExternalLink className="h-3 w-3" />
                  Explorer
                </a>
              </div>
            </div>
            <p className="mt-1.5 break-all select-all font-mono text-xs text-slate-200">{txid}</p>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={() => void handleConfirmReceipt()}
            disabled={updating}
            className={`${primaryButtonClass} w-full`}
          >
            {updating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirm Wallet Receipt (Mark Settled)
          </button>
        </div>
      )}

      {/* STATE 2: SETTLED */}
      {payoutStatus === "SETTLED" && (
        <div className="space-y-4 text-xs">
          <div className="flex items-center gap-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Funds Settled &amp; Verified in Vendor Wallet</p>
              <p className="mt-0.5 text-xs text-emerald-200/80">
                Settled on{" "}
                {settledAt
                  ? new Date(settledAt).toLocaleString()
                  : new Date().toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-[#030712] p-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Net ZEC Credited</span>
              <strong className="mt-1 block font-mono text-2xl font-bold tabular-nums text-emerald-400">
                {formatZec(totalPayout)}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#030712] p-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Credited To</span>
              <span className="mt-1.5 block font-mono text-xs text-slate-200">
                {shortZcashAddress(order.vendor_address)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#030712] p-4">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Settlement Tx Hash</span>
              <span className="mt-0.5 block font-mono text-xs text-slate-200 select-all">
                {txid.slice(0, 16)}…{txid.slice(-12)}
              </span>
            </div>
            <a
              href={explorerTxUrl(txid)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-amber-400 transition-colors hover:bg-slate-700 hover:text-amber-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Verify on Chain
            </a>
          </div>
        </div>
      )}

      {/* STATE 3: FAILED */}
      {payoutStatus === "FAILED" && (
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-300">Shielded Payout Broadcast Interrupted</p>
                <p className="mt-1 text-xs text-red-200/90 leading-relaxed">
                  {payoutError || "Network timeout broadcasting shielded transaction to lightwalletd."}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={retrying}
            className={`${primaryButtonClass} w-full`}
          >
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Retry ZEC Payout
          </button>
        </div>
      )}
    </div>
  );
}
