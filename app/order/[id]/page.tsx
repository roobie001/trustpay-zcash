"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  MessageCircle,
  PackageCheck,
  PhoneCall,
  ShieldAlert,
  ShieldCheck,
  Truck,
  User,
  Wallet,
  X,
} from "lucide-react";
import { supabase, type EscrowOrder } from "@/lib/supabase";
import { formatZec, getHandoverPin, shortZcashAddress } from "@/lib/zcash";
import { formatZecEquivalents, getZecRates, type ZecRates } from "@/lib/format";
import {
  getRecentDeals,
  getSavedSellerProfile,
  parseOrderMetadata,
  updateDealStatus,
} from "@/lib/storage";
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";
import { PageMessage, PageShell } from "@/components/page-shell";
import { DisputeDrawer } from "@/components/DisputeDrawer";
import { SellerSettlementCard } from "@/components/SellerSettlementCard";
import { SellerDashboard } from "@/components/SellerDashboard";

const stages = [
  ["PENDING_PAYMENT", "Awaiting Deposit", ShieldCheck],
  ["HELD_IN_ESCROW", "Funds Held in Escrow", ShieldCheck],
  ["DISPATCHED", "Dispatched with Rider", Truck],
  ["FUNDS_RELEASED", "Delivered & Funds Released", PackageCheck],
] as const;

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const urlKey = searchParams.get("key");

  const [order, setOrder] = useState<EscrowOrder | null>(null);
  const [sellerView, setSellerView] = useState(Boolean(urlKey));
  const [sellerAuthorized, setSellerAuthorized] = useState(false);
  const [activeSellerKey, setActiveSellerKey] = useState<string | null>(urlKey);
  const [sellerDashOpen, setSellerDashOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Dispatch Modal state
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [riderPhone, setRiderPhone] = useState("");
  const [waybillNotes, setWaybillNotes] = useState("");
  const [dispatchKeyInput, setDispatchKeyInput] = useState(urlKey || "");
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Dispute Drawer state
  const [disputeDrawerOpen, setDisputeDrawerOpen] = useState(false);

  // Manual payment verification state
  const [manualTxid, setManualTxid] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  // Rates
  const [rates, setRates] = useState<ZecRates | null>(null);

  useEffect(() => {
    void getZecRates().then(setRates);
  }, []);

  // Hydrate order and verify seller credentials
  useEffect(() => {
    let active = true;

    // 1. Fetch order
    void supabase
      .from("escrow_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) {
          setOrder(data);
        }
      });

    // 2. Determine seller key / authorization
    async function checkSellerAuth() {
      let keyToTest = urlKey;
      if (!keyToTest) {
        const localDeals = getRecentDeals();
        const found = localDeals.find((d) => d.id === id);
        if (found?.sellerKey) keyToTest = found.sellerKey;
      }

      const sellerProfile = getSavedSellerProfile();

      let verifyUrl = `/api/orders/${id}/verify-seller`;
      if (keyToTest) {
        verifyUrl += `?key=${encodeURIComponent(keyToTest)}`;
      } else if (sellerProfile?.seller_secret_token) {
        verifyUrl += `?token=${encodeURIComponent(sellerProfile.seller_secret_token)}`;
      } else {
        return;
      }

      try {
        const res = await fetch(verifyUrl);
        const data = (await res.json()) as { isSeller?: boolean };
        if (active && data.isSeller) {
          setSellerAuthorized(true);
          if (keyToTest) setActiveSellerKey(keyToTest);
          if (urlKey) setSellerView(true);
        }
      } catch {
        // Ignore
      }
    }

    void checkSellerAuth();

    // 3. Subscribe to Realtime Postgres updates for instant order sync
    const channel = supabase
      .channel(`escrow_orders:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "escrow_orders", filter: `id=eq.${id}` },
        (payload) => {
          if (!active) return;
          const updated = payload.new as EscrowOrder;
          setOrder(updated);
          updateDealStatus(id, updated.status, updated.release_txid ?? undefined);
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [id, urlKey]);

  // Status polling fallback for fast synchronization
  useEffect(() => {
    let active = true;
    async function refreshStatus() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(id)}/status?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { "cache-control": "no-cache" },
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          status?: EscrowOrder["status"];
          fund_txid?: string | null;
          release_txid?: string | null;
          delivery_notes?: string | null;
        };
        if (active && data.status) {
          setOrder((current) =>
            current
              ? {
                  ...current,
                  status: data.status!,
                  fund_txid: data.fund_txid ?? current.fund_txid,
                  release_txid: data.release_txid ?? current.release_txid,
                  delivery_notes: data.delivery_notes ?? current.delivery_notes,
                }
              : current
          );
        }
      } catch {
        // Realtime handles main sync
      }
    }

    const interval = window.setInterval(() => void refreshStatus(), 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [id]);

  async function copyTrackingLink() {
    const url = `${window.location.origin}/order/${id}`;
    await navigator.clipboard.writeText(url);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  }

  async function copyBuyerAddressText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  }

  async function handleDispatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDispatchError(null);

    const key = activeSellerKey || dispatchKeyInput.trim();
    if (!key) {
      setDispatchError("Seller authorization key is required to dispatch.");
      return;
    }

    if (!riderPhone.trim()) {
      setDispatchError("Dispatch rider phone number is mandatory.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "DISPATCHED",
          key,
          rider_phone: riderPhone.trim(),
          waybill_notes: waybillNotes.trim() || undefined,
        }),
      });

      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Dispatch update rejected.");
      }

      setDispatchModalOpen(false);
      setOrder((prev) => (prev ? { ...prev, status: "DISPATCHED" } : prev));
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : "Failed to dispatch order.");
    } finally {
      setBusy(false);
    }
  }

  async function releaseFunds() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${id}/release`, { method: "POST" });
      const data = (await response.json()) as {
        success?: boolean;
        status?: string;
        payoutTxid?: string;
        txid?: string;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? `Release failed with status ${response.status}.`);
      }

      setOrder((current) =>
        current
          ? {
              ...current,
              status: "FUNDS_RELEASED",
              release_txid: data.payoutTxid ?? data.txid ?? current.release_txid,
            }
          : current
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to release funds.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmManualPayment() {
    setManualError(null);
    const txid = manualTxid.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(txid)) {
      setManualError("Paste the 64-character transaction ID from the wallet receipt.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/relayer/verify-deposit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: id, txid }),
      });
      const data = (await response.json()) as { success?: boolean; txid?: string; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Unable to verify this payment ID.");
      }
      setOrder((current) =>
        current ? { ...current, status: "HELD_IN_ESCROW", fund_txid: data.txid ?? txid } : current
      );
      setManualTxid("");
    } catch (reason) {
      setManualError(reason instanceof Error ? reason.message : "Unable to verify this payment ID.");
    } finally {
      setBusy(false);
    }
  }

  async function copyReceiptSummary() {
    if (!order) return;
    const totalAmount = Number(order.amount) + Number(order.delivery_fee);
    const text =
      `=== TRUSTPAY SHIELDED ESCROW RECEIPT ===\n` +
      `Order: ${order.item_title} (ID: ${order.id})\n` +
      `Amount: ${formatZec(totalAmount)}\n` +
      `Vendor: ${order.seller_name} (${shortZcashAddress(order.vendor_address)})\n` +
      `Deposited: ${order.paid_at || order.created_at} | Tx: ${order.fund_txid || "Confirmed"}\n` +
      `Dispatched: ${metadata.dispatched_at || "Yes"} | Rider: ${metadata.rider_phone || "Assigned"}\n` +
      `Released: ${metadata.settled_at || new Date().toISOString()} | Payout Tx: ${order.release_txid || "Settled"}\n` +
      `Status: Delivered & Funds Released Privately\n` +
      `=======================================`;

    await navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  }

  if (!order) {
    return (
      <PageShell>
        <PageMessage icon={<Loader2 className="h-7 w-7 animate-spin text-amber-500" />}>
          Loading order details…
        </PageMessage>
      </PageShell>
    );
  }

  const { metadata } = parseOrderMetadata(order.delivery_notes);
  const total = Number(order.amount) + Number(order.delivery_fee);
  const stageIndex = Math.max(0, stages.findIndex(([status]) => status === order.status));
  const released = order.status === "FUNDS_RELEASED";
  const isDisputed = order.status === "DISPUTED";
  const isDispatched = order.status === "DISPATCHED";
  const isHeld = order.status === "HELD_IN_ESCROW";
  const isPending = order.status === "PENDING_PAYMENT";

  // Deterministic 4-Digit Handover PIN for Buyer View
  const handoverPin = getHandoverPin(order.id);
  const pinDigits = handoverPin.split("");

  // Buyer full delivery address
  const rawBuyerAddress =
    metadata.doorstep_address
      ? metadata.landmark
        ? `${metadata.doorstep_address} (Landmark: ${metadata.landmark})`
        : metadata.doorstep_address
      : order.buyer_address || "Doorstep Address not specified";

  // Clean buyer phone for links
  const buyerCleanPhone = (order.buyer_phone || "").replace(/\D/g, "");

  return (
    <PageShell>
      {/* Top Bar: View Role Switcher & Tracking Link */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        {/* Buyer View vs Seller View Switcher */}
        <div className="flex rounded-full border border-slate-800 bg-[#0F172A] p-1 text-xs font-semibold shadow-inner">
          <button
            type="button"
            onClick={() => setSellerView(false)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
              !sellerView
                ? "bg-amber-500 text-[#030712] font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Buyer View
          </button>
          <button
            type="button"
            onClick={() => setSellerView(true)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
              sellerView
                ? "bg-amber-500 text-[#030712] font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Seller View
          </button>
        </div>

        <div className="flex items-center gap-2">
          {sellerView && (
            <button
              type="button"
              onClick={() => setSellerDashOpen(true)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <Wallet className="h-3.5 w-3.5 text-amber-500" />
              Seller Ledger
            </button>
          )}

          <button
            type="button"
            onClick={() => void copyTrackingLink()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            {copiedTracking ? <Check className="h-3.5 w-3.5 text-amber-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedTracking ? "Copied!" : "Copy Tracking Link"}
          </button>
        </div>
      </div>

      {/* Order Title and Pricing Header */}
      <div className="mb-6 text-center">
        {sellerView && (
          <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Seller Management View {sellerAuthorized ? "(Authorized)" : ""}
          </span>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
          {order.item_title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-400">
          <strong className="font-mono text-2xl font-bold tabular-nums text-amber-500">
            {formatZec(total)}
          </strong>
          <span>·</span>
          <span>Sold by <strong className="text-slate-200 font-semibold">{order.seller_name}</strong></span>
        </div>
        <p className="text-xs font-medium text-slate-400 mt-1">
          {formatZecEquivalents(total, rates).summary}
        </p>
      </div>

      {/* Disputed Alert Banner */}
      {isDisputed && (
        <div className="mb-5 flex items-start gap-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 sm:p-5 text-xs text-red-200 shadow-sm">
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-300 text-sm">Escrow Frozen — Structured Dispute Raised</p>
            <p className="mt-1 leading-relaxed text-slate-300">
              Reason: <span className="font-semibold text-white">{metadata.dispute_category || "Dispute under review"}</span>. Payouts are halted until evidence satisfies the settlement criteria.
            </p>
            <button
              type="button"
              onClick={() => setDisputeDrawerOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 font-semibold text-amber-400 underline hover:text-amber-300"
            >
              Open Dispute Evidence Thread ({metadata.dispute_thread?.length || 0} messages) →
            </button>
          </div>
        </div>
      )}

      {/* Released Banner */}
      {released && !isDisputed && (
        <div className="mb-5 flex items-center gap-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 text-xs text-emerald-200 shadow-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-300 text-sm">Escrow Delivered &amp; Funds Released</p>
            <p className="mt-0.5 text-emerald-200/90 text-xs">
              The buyer confirmed delivery. Shielded payment has been broadcast to the vendor.
            </p>
          </div>
        </div>
      )}

      {/* 4-Step Tracker */}
      <div className={`${cardClass} mb-5 p-5 sm:p-6`}>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Escrow Lifecycle
        </div>
        <ol className="space-y-4">
          {stages.map(([status, label, Icon], index) => {
            const isDone = !isDisputed && index <= stageIndex;
            const isCurrent = !isDisputed && status === order.status;

            return (
              <li key={status} className="flex items-center gap-3.5">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 transition ${
                    isDone
                      ? "border-amber-500 bg-amber-500 text-[#030712] font-bold shadow-md shadow-amber-500/20"
                      : isCurrent
                      ? "border-amber-400 bg-amber-400/20 text-amber-400 ring-4 ring-amber-500/10"
                      : "border-slate-800 bg-[#030712] text-slate-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-col">
                  <span
                    className={`text-sm ${
                      isDone ? "font-semibold text-white" : "text-slate-400"
                    }`}
                  >
                    {label}
                  </span>
                  {isCurrent && (
                    <span className="text-[11px] font-medium text-amber-400">Active Stage</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* =========================================================================
          ASYMMETRIC PRIVACY: SELLER VIEW
          ========================================================================= */}
      {sellerView && (
        <div className="mb-5 space-y-5">
          {/* Asymmetric Privacy Information Box */}
          <div className={`${cardClass} p-5 sm:p-6`}>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
              <div className="flex items-center gap-2">
                {isPending ? (
                  <EyeOff className="h-4 w-4 text-amber-400" />
                ) : (
                  <Eye className="h-4 w-4 text-emerald-400" />
                )}
                <h3 className="text-base font-semibold text-white">
                  Buyer Doorstep Delivery Contact
                </h3>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                  isPending
                    ? "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {isPending ? "Protected / Masked" : "Unlocked"}
              </span>
            </div>

            {isPending ? (
              /* Asymmetrically Masked Information */
              <div className="mt-4 space-y-3.5">
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p className="leading-relaxed">
                    <span className="font-semibold text-amber-300">Asymmetric Privacy Active:</span> Buyer
                    name, phone number, and doorstep delivery address are hidden until funds are verified in
                    escrow. Once the deposit is locked, full delivery details unlock automatically.
                  </p>
                </div>

                <div className="space-y-2.5 text-xs font-mono text-slate-400">
                  <div>Buyer Name: <span className="text-slate-300 font-sans">•••••••• ••••••••</span></div>
                  <div>Phone Number: <span>••••••••••••••••</span></div>
                  <div>Doorstep Address: <span>••••••••••••••••••••••••••••••••</span></div>
                </div>
              </div>
            ) : (
              /* Unlocked Buyer Information */
              <div className="mt-4 space-y-4 text-xs sm:text-sm">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Buyer Full Name:
                  </span>
                  <p className="mt-1 font-semibold text-white text-base">
                    {order.buyer_name || "Adebayo Davies"}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Doorstep Delivery Address &amp; Landmark:
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyBuyerAddressText(rawBuyerAddress)}
                      className="inline-flex items-center gap-1 text-xs text-amber-500 hover:underline"
                    >
                      {copiedAddress ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedAddress ? "Copied!" : "Copy Address"}
                    </button>
                  </div>
                  <p className="mt-1.5 rounded-xl border border-slate-800 bg-[#030712] p-3 font-medium text-slate-100">
                    {rawBuyerAddress}
                  </p>
                </div>

                {order.buyer_phone && (
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Buyer Phone Number:
                    </span>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                      <span className="rounded-xl border border-slate-800 bg-[#030712] px-3.5 py-2 font-mono text-slate-100">
                        {order.buyer_phone}
                      </span>
                      <a
                        href={`tel:${order.buyer_phone}`}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        <PhoneCall className="h-3.5 w-3.5 text-amber-500" />
                        Call
                      </a>
                      <a
                        href={`https://wa.me/${buyerCleanPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Seller Action: Dispatch Button */}
          {isHeld && (
            <button
              type="button"
              onClick={() => setDispatchModalOpen(true)}
              disabled={busy}
              className={`${primaryButtonClass} w-full py-4 text-base`}
            >
              <Truck className="h-5 w-5" />
              Mark as Dispatched with Rider
            </button>
          )}

          {/* Two-Stage Settlement Card on Seller View when released */}
          {released && (
            <SellerSettlementCard
              order={order}
              onSettlementUpdated={(newStat) => {
                setOrder((prev) =>
                  prev
                    ? {
                        ...prev,
                        delivery_notes: JSON.stringify({
                          ...parseOrderMetadata(prev.delivery_notes).metadata,
                          payout_status: newStat,
                        }),
                      }
                    : prev
                );
              }}
              onRetryPayout={releaseFunds}
            />
          )}
        </div>
      )}

      {/* =========================================================================
          BUYER VIEW: HANDOVER PIN & RIDER CALL
          ========================================================================= */}
      {!sellerView && (
        <div className="mb-5 space-y-5">
          {/* Once DISPATCHED: Show 4-Digit Handover PIN & Rider Call */}
          {isDispatched && (
            <div className={`${cardClass} border-amber-500/40 bg-amber-500/5 p-6 sm:p-7 text-center shadow-lg shadow-black/20`}>
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500">
                <KeyRound className="h-5 w-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Your Delivery Handover PIN
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
                Share this 4-digit code with the dispatch rider <span className="font-semibold text-white">ONLY</span> after inspecting your package.
              </p>

              {/* 4 Deterministic PIN Digit Boxes */}
              <div className="my-5 flex justify-center gap-3 font-mono text-2xl sm:text-3xl font-bold">
                {pinDigits.map((digit, i) => (
                  <span
                    key={i}
                    className="flex h-14 w-12 sm:h-16 sm:w-14 items-center justify-center rounded-2xl border-2 border-amber-500/70 bg-[#030712] text-amber-400 shadow-md shadow-amber-500/10 tabular-nums"
                  >
                    {digit}
                  </span>
                ))}
              </div>

              {metadata.rider_phone && (
                <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
                  <a
                    href={`tel:${metadata.rider_phone}`}
                    className={`${primaryButtonClass} w-full sm:w-auto px-7`}
                  >
                    <PhoneCall className="h-4 w-4" />
                    Call Rider ({metadata.rider_phone})
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Confirm Delivery & Release Action for Buyer */}
          {isDispatched && (
            <button
              type="button"
              onClick={() => void releaseFunds()}
              disabled={busy}
              className={`${primaryButtonClass} w-full py-4 text-base font-bold`}
            >
              <Wallet className="h-5 w-5" />
              {busy ? "Broadcasting shielded payout…" : `Confirm Delivery & Release ${formatZec(total)}`}
            </button>
          )}

          {/* Manual Payment Verification (for Zingo! or direct wallet transfers) */}
          {isPending && (
            <details className={`${cardClass} p-5`}>
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white">
                Manual Shielded Payment Verification (Wallet Tx ID)
              </summary>
              <div className="mt-3.5 space-y-3.5">
                <p className="text-xs text-slate-300 leading-relaxed">
                  If you paid directly via desktop or mobile wallet, enter the 64-character transaction ID:
                </p>
                <input
                  value={manualTxid}
                  onChange={(e) => setManualTxid(e.target.value)}
                  placeholder="64-character transaction ID (hex)"
                  className={`${inputClass} font-mono text-xs`}
                />
                {manualError && <p role="alert" className="text-xs text-red-300">{manualError}</p>}
                <button
                  type="button"
                  onClick={() => void confirmManualPayment()}
                  disabled={busy}
                  className={`${primaryButtonClass} w-full`}
                >
                  {busy ? "Verifying deposit…" : "Confirm Payment ID"}
                </button>
              </div>
            </details>
          )}

          {/* Raise a Dispute Action */}
          {(isHeld || isDispatched) && !isDisputed && (
            <button
              type="button"
              onClick={() => setDisputeDrawerOpen(true)}
              className={`${secondaryButtonClass} w-full text-xs text-slate-400 hover:text-red-300 hover:border-red-500/40`}
            >
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Raise an Escrow Dispute
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          TIMESTAMPED ESCROW RECEIPT
          ========================================================================= */}
      {released && (
        <div className={`${cardClass} mb-5 overflow-hidden p-6`}>
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
            <div className="flex items-center gap-2.5">
              <FileCheck2 className="h-5 w-5 text-emerald-400" />
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Timestamped Escrow Receipt
              </h3>
            </div>
            <button
              type="button"
              onClick={() => void copyReceiptSummary()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500 hover:underline"
            >
              {copiedReceipt ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedReceipt ? "Copied!" : "Copy Receipt"}
            </button>
          </div>

          <div className="mt-4 space-y-3.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
              <span className="text-slate-400">Deposited to Vault:</span>
              <div className="text-right">
                <span className="font-mono text-slate-200 tabular-nums">
                  {order.paid_at ? new Date(order.paid_at).toLocaleString() : new Date(order.created_at).toLocaleString()}
                </span>
                {order.fund_txid && (
                  <p className="font-mono text-[11px] text-slate-400">
                    Tx: {order.fund_txid.slice(0, 10)}…{order.fund_txid.slice(-8)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
              <span className="text-slate-400">Dispatched with Rider:</span>
              <div className="text-right">
                <span className="font-mono text-slate-200 tabular-nums">
                  {metadata.dispatched_at ? new Date(metadata.dispatched_at).toLocaleString() : "Verified"}
                </span>
                {metadata.rider_phone && (
                  <p className="text-[11px] text-slate-400">Rider: {metadata.rider_phone}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
              <span className="text-slate-400">Delivered &amp; Released:</span>
              <div className="text-right">
                <span className="font-mono text-emerald-400 font-semibold tabular-nums">
                  {metadata.settled_at ? new Date(metadata.settled_at).toLocaleString() : new Date().toLocaleString()}
                </span>
                {order.release_txid && (
                  <p className="font-mono text-[11px] text-slate-400">
                    Payout Tx: {order.release_txid.slice(0, 10)}…{order.release_txid.slice(-8)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-400 font-medium">Total Net Settled:</span>
              <strong className="font-mono text-base font-bold tabular-nums text-amber-500">
                {formatZec(total)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* General Error Message */}
      {error && (
        <p
          role="alert"
          className="mb-5 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Mandatory Dispatch Modal */}
      {dispatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0F172A] p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Truck className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-semibold text-white">Confirm Dispatch with Rider</h3>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              To protect both parties, entering a valid Dispatch Rider Phone Number is mandatory before
              moving the order to Dispatched.
            </p>

            <form onSubmit={handleDispatchSubmit} className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>Dispatch Rider Phone Number *</label>
                <input
                  value={riderPhone}
                  onChange={(e) => setRiderPhone(e.target.value)}
                  placeholder="e.g. +2348023456789 or 08012345678"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Waybill / Tracking Reference (Optional)</label>
                <input
                  value={waybillNotes}
                  onChange={(e) => setWaybillNotes(e.target.value)}
                  placeholder="e.g. GIGM-98234 or Gokada #481"
                  className={inputClass}
                />
              </div>

              {!activeSellerKey && (
                <div>
                  <label className={labelClass}>Seller Dashboard Secret Key *</label>
                  <input
                    value={dispatchKeyInput}
                    onChange={(e) => setDispatchKeyInput(e.target.value)}
                    placeholder="Enter private seller key"
                    className={`${inputClass} font-mono text-xs`}
                  />
                </div>
              )}

              {dispatchError && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {dispatchError}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !riderPhone.trim()}
                className={`${primaryButtonClass} w-full`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Confirm Order Dispatched
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Resolution Drawer */}
      <DisputeDrawer
        open={disputeDrawerOpen}
        order={order}
        isSeller={sellerView}
        onClose={() => setDisputeDrawerOpen(false)}
        onStatusUpdated={(newStatus) => {
          setOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
        }}
      />

      {/* Seller Dashboard Modal */}
      <SellerDashboard
        open={sellerDashOpen}
        onClose={() => setSellerDashOpen(false)}
        initialLookup={order.vendor_address || order.seller_phone}
      />
    </PageShell>
  );
}
