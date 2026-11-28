"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { supabase, type EscrowOrder } from "@/lib/supabase";
import { formatZec } from "@/lib/zcash";
import { formatZecEquivalents, getZecRates, type ZecRates } from "@/lib/format";
import {
  getRecentDeals,
  getSavedSellerProfile,
  parseOrderMetadata,
  type PayoutStatus,
} from "@/lib/storage";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

interface SellerDashboardProps {
  open: boolean;
  onClose: () => void;
  initialLookup?: string;
}

export function SellerDashboard({ open, onClose, initialLookup }: SellerDashboardProps) {
  const [profile] = useState(() => getSavedSellerProfile());
  const [lookupValue, setLookupValue] = useState(
    initialLookup || profile?.phone || profile?.payout_address || ""
  );
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<ZecRates | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    void getZecRates().then(setRates);
  }, []);

  useEffect(() => {
    if (!open) return;

    void fetchSellerOrders(lookupValue);

    // Subscribe to live escrow_orders table changes so the seller ledger and summary cards update in real time
    const channel = supabase
      .channel("seller_dashboard_orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "escrow_orders" },
        () => {
          void fetchSellerOrders(lookupValue);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lookupValue]);

  async function fetchSellerOrders(searchVal: string) {
    const term = searchVal.trim();
    if (!term && !profile) return;
    setLoading(true);

    try {
      let query = supabase.from("escrow_orders").select("*");

      if (profile?.seller_secret_token) {
        if (term) {
          query = query.or(
            `seller_phone.ilike.%${term}%,vendor_address.ilike.%${term}%,seller_name.ilike.%${term}%`
          );
        } else if (profile.payout_address) {
          query = query.or(
            `vendor_address.eq.${profile.payout_address},seller_phone.eq.${profile.phone}`
          );
        }
      } else if (term) {
        query = query.or(
          `seller_phone.ilike.%${term}%,vendor_address.ilike.%${term}%,seller_name.ilike.%${term}%`
        );
      }

      const { data, error: fetchError } = await query.order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setOrders(data || []);
    } catch (err) {
      console.warn("Failed to load seller orders:", err);
    } finally {
      setLoading(false);
    }
  }

  // Summary Card Totals
  const { heldInEscrowZec, pendingSettlementZec, totalSettledZec } = useMemo(() => {
    let held = 0;
    let pending = 0;
    let settled = 0;

    for (const order of orders) {
      const total = Number(order.amount) + Number(order.delivery_fee);
      const { metadata } = parseOrderMetadata(order.delivery_notes);
      const payoutStatus: PayoutStatus = metadata.payout_status ?? "PROCESSING";

      if (order.status === "HELD_IN_ESCROW" || order.status === "DISPATCHED") {
        held += total;
      } else if (order.status === "FUNDS_RELEASED") {
        if (payoutStatus === "SETTLED") {
          settled += total;
        } else {
          pending += total;
        }
      }
    }

    return {
      heldInEscrowZec: held,
      pendingSettlementZec: pending,
      totalSettledZec: settled,
    };
  }, [orders]);

  async function confirmWalletReceipt(orderId: string) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/meta`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payout_status: "SETTLED",
          settled_at: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((ord) => {
            if (ord.id !== orderId) return ord;
            const { metadata } = parseOrderMetadata(ord.delivery_notes);
            metadata.payout_status = "SETTLED";
            metadata.settled_at = new Date().toISOString();
            return {
              ...ord,
              delivery_notes: JSON.stringify(metadata),
            };
          })
        );
      }
    } catch (err) {
      console.error("Failed to mark receipt:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-dash-title"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-t-2xl border border-slate-800/80 bg-[#0F172A] shadow-2xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-amber-400">
              <LayoutDashboard className="h-5 w-5" />
            </span>
            <div>
              <h2 id="seller-dash-title" className="text-base sm:text-lg font-semibold tracking-tight text-white">
                Seller Payout Dashboard &amp; Ledger
              </h2>
              <p className="text-xs text-slate-400">
                {profile?.store_name ? `Vendor: ${profile.store_name}` : "Track escrow holdings and shielded payouts"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Lookup Bar */}
        <div className="border-b border-slate-800 bg-[#030712]/60 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void fetchSellerOrders(lookupValue);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-slate-400" />
              <input
                value={lookupValue}
                onChange={(e) => setLookupValue(e.target.value)}
                placeholder="Phone or Zcash address"
                className={`${inputClass} font-mono text-xs sm:text-sm pl-10 h-11 rounded-xl`}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`${primaryButtonClass} shrink-0 px-4 text-xs font-semibold`}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
            </button>
            <button
              type="button"
              onClick={() => void fetchSellerOrders(lookupValue)}
              title="Refresh"
              className={`${secondaryButtonClass} shrink-0 px-3`}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </form>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* 3 Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Card 1: Held in Escrow */}
            <div className="rounded-2xl border border-slate-800 bg-[#030712] p-4 sm:p-5">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Held in Escrow</span>
                <ShieldCheck className="h-4 w-4 text-amber-500" />
              </div>
              <strong className="mt-2 block font-mono text-2xl font-bold tabular-nums text-white">
                {formatZec(heldInEscrowZec)}
              </strong>
              <p className="mt-1 text-xs text-slate-400 tabular-nums">
                {formatZecEquivalents(heldInEscrowZec, rates).summary}
              </p>
            </div>

            {/* Card 2: Pending Chain Settlement */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
              <div className="flex items-center justify-between text-amber-300">
                <span className="text-xs font-semibold uppercase tracking-wider">Pending Settlement</span>
                <Clock className="h-4 w-4" />
              </div>
              <strong className="mt-2 block font-mono text-2xl font-bold tabular-nums text-amber-400">
                {formatZec(pendingSettlementZec)}
              </strong>
              <p className="mt-1 text-xs text-amber-200/80 tabular-nums">
                {formatZecEquivalents(pendingSettlementZec, rates).summary}
              </p>
            </div>

            {/* Card 3: Total Settled Payouts */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5">
              <div className="flex items-center justify-between text-emerald-300">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Settled</span>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <strong className="mt-2 block font-mono text-2xl font-bold tabular-nums text-emerald-400">
                {formatZec(totalSettledZec)}
              </strong>
              <p className="mt-1 text-xs text-emerald-200/80 tabular-nums">
                {formatZecEquivalents(totalSettledZec, rates).summary}
              </p>
            </div>
          </div>

          {/* Chronological Payout Ledger */}
          <div className="rounded-2xl border border-slate-800/80 bg-[#030712] p-5 overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Chronological Payout Ledger ({orders.length})
              </h3>
              <span className="text-xs text-slate-400">Sorted by newest</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              </div>
            ) : orders.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No orders found for this seller identifier. Create a link or lookup another phone/address.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {orders.map((ord) => {
                  const total = Number(ord.amount) + Number(ord.delivery_fee);
                  const { metadata } = parseOrderMetadata(ord.delivery_notes);
                  const payoutStatus: PayoutStatus = metadata.payout_status ?? "PROCESSING";
                  const isReleased = ord.status === "FUNDS_RELEASED";
                  const matchingDeal = getRecentDeals().find((d) => d.id === ord.id);
                  const sellerKey = matchingDeal?.sellerKey || profile?.seller_secret_token;
                  const orderHref = sellerKey
                    ? `/order/${ord.id}?key=${encodeURIComponent(sellerKey)}`
                    : `/order/${ord.id}`;

                  return (
                    <div
                      key={ord.id}
                      className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm sm:text-base font-semibold text-white">
                            {ord.item_title}
                          </p>
                          {ord.status === "PENDING_PAYMENT" && (
                            <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                              Awaiting Deposit
                            </span>
                          )}
                          {ord.status === "HELD_IN_ESCROW" && (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400">
                              Held in Escrow
                            </span>
                          )}
                          {ord.status === "DISPATCHED" && (
                            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs text-blue-300">
                              Dispatched
                            </span>
                          )}
                          {ord.status === "DISPUTED" && (
                            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs text-red-300">
                              Disputed
                            </span>
                          )}
                          {isReleased && (
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs ${payoutStatus === "SETTLED"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                }`}
                            >
                              {payoutStatus === "SETTLED" ? "Settled" : "Processing Payout"}
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                          <span>{new Date(ord.created_at).toLocaleDateString()}</span>
                          <span>·</span>
                          <span className="font-mono font-semibold tabular-nums text-amber-400">{formatZec(total)}</span>
                          <span>·</span>
                          <span className="text-xs text-slate-400 tabular-nums">
                            {formatZecEquivalents(total, rates).summary}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {isReleased && payoutStatus === "PROCESSING" && (
                          <button
                            type="button"
                            onClick={() => void confirmWalletReceipt(ord.id)}
                            disabled={updatingId === ord.id}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            {updatingId === ord.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Confirm Receipt
                          </button>
                        )}

                        <Link
                          href={orderHref}
                          onClick={onClose}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-800 bg-[#0B1120] px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          View Order <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
