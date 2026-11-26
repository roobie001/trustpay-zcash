"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  History,
  Loader2,
  RefreshCw,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatZec } from "@/lib/zcash";
import {
  getRecentDeals,
  mergeRecentDeals,
  type DealRecord,
} from "@/lib/storage";
import {
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

interface RecentDealsProps {
  onOpenSellerDashboard?: () => void;
}

export function RecentDeals({ onOpenSellerDashboard }: RecentDealsProps) {
  const [deals, setDeals] = useState<DealRecord[]>(() => getRecentDeals());
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncQuery, setSyncQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleSync(e: React.FormEvent) {
    e.preventDefault();
    const query = syncQuery.trim();
    if (!query) return;

    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);

    try {
      // Query Supabase escrow_orders safely matching buyer_phone, seller_phone, vendor_address, or buyer_address
      const { data, error } = await supabase
        .from("escrow_orders")
        .select("id, item_title, amount, delivery_fee, status, created_at, seller_phone, buyer_phone, vendor_address, buyer_address")
        .or(
          `buyer_phone.ilike.%${query}%,seller_phone.ilike.%${query}%,vendor_address.ilike.%${query}%,buyer_address.ilike.%${query}%`
        )
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        setSyncResult("No orders found matching that identifier.");
        return;
      }

      const importedDeals: DealRecord[] = (data as Array<{
        id: string;
        item_title: string;
        amount: number;
        delivery_fee?: number;
        status: string;
        created_at: string;
        seller_phone?: string;
        buyer_phone?: string;
        vendor_address?: string;
        buyer_address?: string;
      }>).map((ord) => {
        const isSellerMatch = Boolean(
          (ord.seller_phone && ord.seller_phone.includes(query)) ||
          (ord.vendor_address && ord.vendor_address.toLowerCase() === query.toLowerCase())
        );

        return {
          id: ord.id,
          item_title: ord.item_title,
          amount: Number(ord.amount),
          delivery_fee: Number(ord.delivery_fee || 0),
          role: isSellerMatch ? "seller" : "buyer",
          status: ord.status,
          created_at: ord.created_at,
          vendor_address: ord.vendor_address,
        };
      });

      mergeRecentDeals(importedDeals);
      setDeals(getRecentDeals());
      setSyncResult(`Successfully synced ${importedDeals.length} orders to this device!`);
      setSyncQuery("");
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync lookup failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section aria-labelledby="recent-deals-heading" className="mt-14 w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-amber-500" />
          <h2 id="recent-deals-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Recent Escrow Deals ({deals.length})
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {onOpenSellerDashboard && (
            <button
              type="button"
              onClick={onOpenSellerDashboard}
              className="inline-flex flex-1 sm:flex-initial min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Wallet className="h-3.5 w-3.5 text-amber-500" />
              Seller Dashboard
            </button>
          )}

          <button
            type="button"
            onClick={() => setSyncModalOpen(true)}
            className="inline-flex flex-1 sm:flex-initial min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Sync from Another Device
          </button>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className={`${cardClass} rounded-2xl border-slate-800/80 bg-[#0F172A]/90 p-8 text-center shadow-xl`}>
          <Clock className="mx-auto mb-2 h-7 w-7 text-slate-500" />
          <p className="text-base font-semibold text-white">No local escrow orders yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Create an escrow link or sync orders previously created on your mobile phone or another device.
          </p>
          <button
            type="button"
            onClick={() => setSyncModalOpen(true)}
            className={`${secondaryButtonClass} mx-auto mt-4 text-xs font-semibold`}
          >
            <Smartphone className="h-4 w-4" />
            Lookup &amp; Sync My Orders
          </button>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {deals.slice(0, 6).map((deal) => {
            const isReleased = deal.status === "FUNDS_RELEASED";
            const isDisputed = deal.status === "DISPUTED";
            const isHeld = deal.status === "HELD_IN_ESCROW";
            const isDispatched = deal.status === "DISPATCHED";

            return (
              <div
                key={deal.id}
                className={`${cardClass} flex flex-col justify-between rounded-2xl border-slate-800/80 bg-[#0F172A]/90 p-5 shadow-lg transition-all hover:border-amber-500/40`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                        deal.role === "seller"
                          ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                          : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                      }`}
                    >
                      {deal.role === "seller" ? "Seller" : "Buyer"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(deal.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="mt-2.5 truncate font-semibold text-white text-sm sm:text-base">
                    {deal.item_title}
                  </h3>
                  <p className="mt-1 font-mono text-base font-bold tabular-nums text-amber-400">
                    {formatZec(deal.amount + (deal.delivery_fee || 0))}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isReleased
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : isDisputed
                        ? "border border-red-500/30 bg-red-500/10 text-red-300"
                        : isDispatched
                        ? "border border-blue-500/30 bg-blue-500/10 text-blue-300"
                        : isHeld
                        ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border border-slate-700 bg-slate-800 text-slate-300"
                    }`}
                  >
                    {isReleased ? "Released" : isDisputed ? "Disputed" : isDispatched ? "Dispatched" : isHeld ? "In Escrow" : "Awaiting Deposit"}
                  </span>

                  <Link
                    href={`/order/${deal.id}${deal.sellerKey ? `?key=${encodeURIComponent(deal.sellerKey)}` : ""}`}
                    className="inline-flex min-h-[32px] items-center gap-1 text-xs font-semibold text-amber-400 transition-colors hover:text-amber-300 hover:underline"
                  >
                    Track <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sync from Another Device Modal */}
      {syncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-800/80 bg-[#0F172A] p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  <Smartphone className="h-5 w-5" />
                </span>
                <h3 className="text-base sm:text-lg font-semibold tracking-tight text-white">
                  Sync Orders from Another Device
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSyncModalOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Enter your WhatsApp Phone Number or Zcash Address used on your other device to pull all
              active and past escrow orders into this browser.
            </p>

            <form onSubmit={handleSync} className="mt-4 space-y-3.5">
              <input
                value={syncQuery}
                onChange={(e) => setSyncQuery(e.target.value)}
                placeholder="Phone or Zcash address (e.g. +234...)"
                className={`${inputClass} font-mono text-xs sm:text-sm`}
              />

              {syncResult && (
                <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  {syncResult}
                </p>
              )}

              {syncError && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {syncError}
                </p>
              )}

              <button
                type="submit"
                disabled={syncing || !syncQuery.trim()}
                className={`${primaryButtonClass} w-full`}
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Find &amp; Restore Orders
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
