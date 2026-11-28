"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ExternalLink,
  EyeOff,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Truck,
  Wallet,
} from "lucide-react";
import { supabase, type EscrowOrder } from "@/lib/supabase";
import { formatZec, explorerTxUrl } from "@/lib/zcash";
import { formatZecEquivalents, getZecRates, type ZecRates } from "@/lib/format";
import { DEFAULT_DIAL_CODE, toE164 } from "@/lib/phone";
import { VAULT_NAME } from "@/lib/constants";
import {
  getSavedBuyerProfile,
  saveBuyerProfile,
  saveRecentDeal,
} from "@/lib/storage";
import { cardClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";
import { TrustPayLogo } from "@/components/BrandLogo";
import { PageShell } from "@/components/page-shell";
import { PhoneInput } from "@/components/phone-input";
import { ZcashCheckoutModal } from "@/components/zcash-checkout-modal";

interface PayClientProps {
  initialOrder: EscrowOrder;
}

export function PayClient({ initialOrder }: PayClientProps) {
  const [order, setOrder] = useState<EscrowOrder>(initialOrder);

  // Buyer Form Details - initialized from local profile
  const [buyerName, setBuyerName] = useState(() => getSavedBuyerProfile()?.name || "");
  const [dialCode, setDialCode] = useState(() => getSavedBuyerProfile()?.dialCode || DEFAULT_DIAL_CODE.dial);
  const [buyerPhone, setBuyerPhone] = useState(() => getSavedBuyerProfile()?.phone || "");
  const [doorstepAddress, setDoorstepAddress] = useState(() => getSavedBuyerProfile()?.doorstep_address || "");
  const [landmark, setLandmark] = useState(() => getSavedBuyerProfile()?.landmark || "");
  const [saveLocally, setSaveLocally] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(
    initialOrder.deposit_txid || initialOrder.fund_txid || (initialOrder.status !== "PENDING_PAYMENT" ? "confirmed" : null)
  );
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [toastVerified, setToastVerified] = useState(false);
  const [rates, setRates] = useState<ZecRates | null>(null);

  // Load live rates
  useEffect(() => {
    void getZecRates().then(setRates);
  }, []);

  // Realtime subscription and fallback polling for instant deposit confirmations
  useEffect(() => {
    let active = true;

    const channel = supabase
      .channel(`escrow_orders:pay:${order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "escrow_orders", filter: `id=eq.${order.id}` },
        (payload) => {
          if (!active) return;
          const updated = payload.new as EscrowOrder;
          setOrder(updated);
          if (
            updated.status === "HELD_IN_ESCROW" ||
            updated.status === "DISPATCHED" ||
            updated.status === "FUNDS_RELEASED"
          ) {
            setTxid(updated.deposit_txid || updated.fund_txid || "confirmed");
            setCheckoutOpen(false);
            setAwaitingConfirmation(false);
            setToastVerified(true);
          }
        }
      )
      .subscribe();

    // Fast fallback polling every 4 seconds
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/status?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          status?: EscrowOrder["status"];
          deposit_txid?: string | null;
          fund_txid?: string | null;
        };
        if (active && data.status) {
          setOrder((prev) => ({
            ...prev,
            status: data.status!,
            deposit_txid: data.deposit_txid ?? prev.deposit_txid,
            fund_txid: data.fund_txid ?? prev.fund_txid,
          }));
          if (
            data.status === "HELD_IN_ESCROW" ||
            data.status === "DISPATCHED" ||
            data.status === "FUNDS_RELEASED"
          ) {
            setTxid(data.deposit_txid || data.fund_txid || "confirmed");
            setCheckoutOpen(false);
            setAwaitingConfirmation(false);
            setToastVerified(true);
          }
        }
      } catch {
        // Realtime handles main updates
      }
    }, 4000);

    return () => {
      active = false;
      void supabase.removeChannel(channel);
      window.clearInterval(interval);
    };
  }, [order.id]);

  async function handlePay(event: FormEvent) {
    event.preventDefault();
    if (!order) return;
    setError(null);

    const phone = toE164(dialCode, buyerPhone);
    if (!buyerName.trim() || !phone) {
      setError("Please enter your name / alias and a valid WhatsApp contact number.");
      return;
    }

    const trimmedAddress = doorstepAddress.trim();
    const trimmedLandmark = landmark.trim();
    const fullDeliveryAddress = trimmedAddress
      ? trimmedLandmark
        ? `${trimmedAddress} (Landmark: ${trimmedLandmark})`
        : trimmedAddress
      : null;

    // Save buyer profile locally if checked
    if (saveLocally) {
      saveBuyerProfile({
        name: buyerName.trim(),
        dialCode,
        phone: buyerPhone.trim(),
        doorstep_address: trimmedAddress || undefined,
        landmark: trimmedLandmark || undefined,
      });
    }

    // Persist buyer details into order metadata (with doorstep & landmark if provided)
    try {
      if (trimmedAddress || trimmedLandmark) {
        await fetch(`/api/orders/${order.id}/meta`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            doorstep_address: trimmedAddress || undefined,
            landmark: trimmedLandmark || undefined,
          }),
        });
      }

      await supabase
        .from("escrow_orders")
        .update({
          buyer_name: buyerName.trim(),
          buyer_phone: phone,
          buyer_address: fullDeliveryAddress,
        })
        .eq("id", order.id);

      // Save into buyer's recent deals
      saveRecentDeal({
        id: order.id,
        item_title: order.item_title,
        amount: Number(order.amount),
        delivery_fee: Number(order.delivery_fee || 0),
        role: "buyer",
        status: order.status,
        created_at: order.created_at,
        vendor_address: order.vendor_address,
      });
    } catch (err) {
      console.warn("Failed to update buyer metadata before checkout:", err);
    }

    setCheckoutOpen(true);
  }

  function recordFunding(paymentTxid: string) {
    setError(null);
    setTxid(paymentTxid);
    setCheckoutOpen(false);
    setAwaitingConfirmation(false);
    setToastVerified(true);
    setOrder((current) => ({
      ...current,
      status: "HELD_IN_ESCROW",
      deposit_txid: paymentTxid,
      fund_txid: paymentTxid,
      paid_at: new Date().toISOString(),
      funded_at: new Date().toISOString(),
    }));
  }

  const isTestnet =
    order.escrow_vault_address.startsWith("utest1") ||
    order.escrow_vault_address.startsWith("tm");
  const total = Number(order.amount) + Number(order.delivery_fee);
  const displayedTxid =
    txid ??
    (order.status === "HELD_IN_ESCROW"
      ? order.deposit_txid || order.fund_txid
      : null);
  const isPaid = order.status !== "PENDING_PAYMENT";

  const buyerHeaderSlot = (
    <div className="flex shrink-0 items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 sm:px-3 py-1 text-xs font-semibold text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">Protected Checkout</span>
        <span className="sm:hidden">Protected</span>
      </span>
      <span className="rounded-full border border-slate-800 bg-[#0F172A] px-2.5 py-1 text-xs font-semibold text-amber-400">
        {isTestnet ? "TAZ Testnet" : "ZEC Mainnet"}
      </span>
    </div>
  );

  return (
    <PageShell role="buyer" rightSlot={buyerHeaderSlot}>
      {/* Prominent Real-Time On-Chain Deposit Banner */}
      {(toastVerified || (displayedTxid && isPaid)) && (
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 sm:p-5 shadow-lg shadow-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-white text-sm sm:text-base">
                Deposit Verified On-Chain — Funds Locked in TrustPay Vault
              </p>
              <p className="text-xs text-emerald-300/90 mt-0.5">
                Payment confirmed on {isTestnet ? "TAZ Testnet" : "ZEC Mainnet"}. The seller is now authorized to dispatch your order.
              </p>
            </div>
          </div>
          {displayedTxid && (
            <a
              href={explorerTxUrl(displayedTxid, isTestnet)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 transition-colors"
            >
              <span>View On-Chain Tx</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Order Header with Bespoke Brand Emblem */}
      <div className="mb-6 text-center">
        <TrustPayLogo className="mx-auto mb-3.5 h-12 w-12 sm:h-14 sm:w-14" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
          {order.item_title}
        </h1>
        <p className="mt-1.5 text-sm sm:text-base text-slate-400">
          Sold by <span className="font-semibold text-slate-200">{order.seller_name}</span>
        </p>
      </div>

      {/* Escrow Shield Banner */}
      <div className="mb-6 flex gap-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 shadow-sm">
        <ShieldCheck className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
        <div className="text-xs sm:text-sm leading-relaxed text-amber-200">
          <span className="font-semibold text-amber-300">{VAULT_NAME} Protected:</span> Your payment is
          held in private escrow. The seller is only paid after you inspect and accept your delivery.
        </div>
      </div>

      {/* Order Pricing Card */}
      <div className={`${cardClass} mb-6 p-5 sm:p-6`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Escrow Due (Item + Delivery)
          </span>
          <div className="text-right">
            <strong className="block font-mono text-2xl sm:text-3xl font-bold tabular-nums text-amber-500">
              {formatZec(total)}
            </strong>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              {formatZecEquivalents(total, rates).summary}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs text-slate-400">
          <span>Item: <strong className="font-mono text-slate-200">{formatZec(Number(order.amount))}</strong></span>
          <span>Delivery Fee: <strong className="font-mono text-slate-200">{formatZec(Number(order.delivery_fee))}</strong></span>
        </div>
      </div>

      {/* Payment Confirmed State */}
      {displayedTxid || isPaid ? (
        <div className={`${cardClass} p-7 text-center`}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-[#030712] shadow-lg shadow-amber-500/20">
            <Check className="h-7 w-7 stroke-[2.5]" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Payment Held in Shielded Escrow
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
            Your ZEC has been verified in the escrow vault. The vendor has been notified to dispatch your
            order.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={`/order/${order.id}`} className={`${primaryButtonClass} flex-1`}>
              Track Order &amp; Delivery <ArrowRight className="h-4 w-4" />
            </Link>

            {displayedTxid && !displayedTxid.startsWith("txid_sim_") && (
              <a
                href={explorerTxUrl(displayedTxid, isTestnet)}
                target="_blank"
                rel="noreferrer"
                className={`${secondaryButtonClass} flex-1`}
              >
                View on Chain <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      ) : (
        /* Buyer Checkout Form */
        <form onSubmit={handlePay} className={`${cardClass} space-y-5 p-5 sm:p-7`}>
          <div className="border-b border-slate-800/80 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-white">
                Contact &amp; Delivery Details
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                <EyeOff className="h-3 w-3" />
                Asymmetric Privacy
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Contact and delivery details remain masked from the seller until escrow deposit is locked on-chain.
            </p>
          </div>

          <div>
            <label htmlFor="buyer-name" className={labelClass}>
              Buyer Name / Alias *
            </label>
            <input
              id="buyer-name"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="e.g. John Doe, Alex, or @handle"
              className={inputClass}
            />
          </div>

          <PhoneInput
            id="buyer-phone"
            label="Contact Phone / Handle *"
            dialCode={dialCode}
            onDialCodeChange={setDialCode}
            value={buyerPhone}
            onChange={setBuyerPhone}
          />

          <div>
            <label htmlFor="doorstep-address" className={labelClass}>
              Delivery Address or Pickup Point <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              id="doorstep-address"
              value={doorstepAddress}
              onChange={(e) => setDoorstepAddress(e.target.value)}
              placeholder="Street address, pickup hub, or leave blank for digital delivery"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              Delivery Address or Pickup Point (Optional — leave blank for digital delivery or private coordination).
            </p>
          </div>

          <div>
            <label htmlFor="landmark" className={labelClass}>
              Nearest Landmark or Delivery Note <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              id="landmark"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. Beside City Mall, or Telegram handle"
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-400 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={saveLocally}
              onChange={(e) => setSaveLocally(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
            />
            Save my details locally for faster checkout next time
          </label>

          {error && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300"
            >
              <TriangleAlert className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <button type="submit" className={`${primaryButtonClass} w-full py-4 text-base`}>
            <Wallet className="h-5 w-5" />
            Proceed to Private Shielded Payment
          </button>

          {/* 3-Point Escrow Protection Summary */}
          <div className="mt-6 border-t border-slate-800/80 pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              TrustPay Buyer Protection Guarantee
            </p>
            <ul className="space-y-3 text-xs">
              <li className="flex items-start gap-2.5 text-slate-300">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <span className="font-semibold text-white">1. Shielded Escrow Vault:</span> Your
                  ZEC is held in an encrypted, neutral vault bound to your order memo.
                </div>
              </li>
              <li className="flex items-start gap-2.5 text-slate-300">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <span className="font-semibold text-white">2. Delivery Guarantee:</span> The
                  vendor receives zero payout until you verify and confirm package delivery.
                </div>
              </li>
              <li className="flex items-start gap-2.5 text-slate-300">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <span className="font-semibold text-white">3. Instant Dispute Freeze:</span> Any
                  defect or missing item freezes the escrow instantly with 1 tap.
                </div>
              </li>
            </ul>
          </div>
        </form>
      )}

      {awaitingConfirmation && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-center text-xs text-amber-200">
          Awaiting Shielded Confirmation… The tracker will update automatically via Realtime.
        </p>
      )}

      <div className="mt-6 text-center">
        <Link
          href={`/order/${order.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white"
        >
          View public order status tracker <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Checkout Modal */}
      <ZcashCheckoutModal
        open={checkoutOpen}
        order={order}
        amount={total}
        onClose={() => setCheckoutOpen(false)}
        onPaymentSubmitted={(paymentTxid) => recordFunding(paymentTxid)}
      />
    </PageShell>
  );
}
