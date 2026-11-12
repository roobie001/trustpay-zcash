"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Loader2, PackageSearch, ShieldCheck, TriangleAlert, Wallet } from "lucide-react";
import { supabase, type EscrowOrder } from "@/lib/supabase";
import { formatZec, explorerTxUrl } from "@/lib/zcash";
import { DEFAULT_DIAL_CODE, toE164 } from "@/lib/phone";
import { VAULT_NAME } from "@/lib/constants";
import { cardClass, inputClass, labelClass, primaryButtonClass } from "@/lib/ui";
import { PageMessage, PageShell } from "@/components/page-shell";
import { PhoneInput } from "@/components/phone-input";
import { ZcashCheckoutModal } from "@/components/zcash-checkout-modal";

export default function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<EscrowOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE.dial);
  const [buyerPhone, setBuyerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.from("escrow_orders").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!active) return;
      if (data) setOrder(data);
      else setNotFound(true);
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  async function handlePay(event: FormEvent) {
    event.preventDefault();
    if (!order) return;
    setError(null);
    const phone = toE164(dialCode, buyerPhone);
    if (!buyerName.trim() || !phone) {
      setError("Please enter your name and a valid phone number.");
      return;
    }
    setCheckoutOpen(true);
  }

  async function recordFunding(paymentTxid: string, buyerAddress: string) {
    setError(null);
    const response = await fetch("/api/escrow/fund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: order!.id, txid: paymentTxid, buyerAddress }),
      });
    const result = await response.json() as { success?: boolean; error?: string };
    if (response.ok && result.success) {
      const phone = toE164(dialCode, buyerPhone);
      if (phone) {
        await supabase.from("escrow_orders").update({
          buyer_name: buyerName.trim(),
          buyer_phone: phone,
        }).eq("id", order!.id);
      }
      setTxid(paymentTxid);
      setCheckoutOpen(false);
      return;
    }
    setAwaitingConfirmation(true);
    setError(result.error ?? "Payment submitted. Waiting for shielded confirmation.");
  }

  useEffect(() => {
    if (!order || (!checkoutOpen && !awaitingConfirmation)) return;
    const poll = window.setInterval(async () => {
      const response = await fetch(`/api/escrow/status?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json() as { status?: EscrowOrder["status"]; fund_txid?: string | null };
      if (result.status) setOrder((current) => current ? { ...current, status: result.status!, fund_txid: result.fund_txid ?? current.fund_txid } : current);
      if (result.status === "HELD_IN_ESCROW") {
        setTxid(result.fund_txid ?? "confirmed");
        setAwaitingConfirmation(false);
        setCheckoutOpen(false);
      }
    }, 4000);
    return () => window.clearInterval(poll);
  }, [awaitingConfirmation, checkoutOpen, order]);

  if (loading) return <PageShell><PageMessage icon={<Loader2 className="h-6 w-6 animate-spin text-slate-400" />}>Loading escrow…</PageMessage></PageShell>;
  if (notFound || !order) return <PageShell><PageMessage icon={<PackageSearch className="h-8 w-8 text-slate-400" />}>This escrow link doesn&apos;t exist or was removed.</PageMessage></PageShell>;

  const total = Number(order.amount) + Number(order.delivery_fee);
  const displayedTxid = txid ?? (order.status === "HELD_IN_ESCROW" ? order.fund_txid : null);
  return (
    <PageShell>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"><ShieldCheck className="h-6 w-6" /></div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{order.item_title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sold by {order.seller_name}</p>
      </div>
      <div className="mb-4 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
        <p className="text-sm leading-relaxed text-emerald-800 dark:text-emerald-200/90"><span className="font-semibold">{VAULT_NAME} protected:</span> the vendor is paid only after delivery confirmation.</p>
      </div>
      <div className={`${cardClass} mb-4 p-5`}>
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400"><span>Item + delivery</span><strong className="text-lg text-slate-900 dark:text-white">{formatZec(total)}</strong></div>
        <p className="mt-2 text-xs text-slate-500">The order id is included in Zcash&apos;s encrypted 512-byte memo.</p>
      </div>
      {displayedTxid ? (
        <div className={`${cardClass} p-6 text-center`}><Check className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-500 p-3 text-white" /><h2 className="font-semibold text-slate-900 dark:text-white">Shielded payment submitted</h2><p className="mt-1 text-sm text-slate-500">Taking you to the order tracker…</p><a className="mt-4 inline-flex items-center gap-1 text-sm text-emerald-600" href={explorerTxUrl(displayedTxid)} target="_blank" rel="noreferrer">View transaction <ExternalLink className="h-3.5 w-3.5" /></a></div>
      ) : (
        <form onSubmit={handlePay} className={`${cardClass} space-y-4 p-5 sm:p-6`}>
          <div><label htmlFor="buyer-name" className={labelClass}>Your name</label><input id="buyer-name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={inputClass} /></div>
          <PhoneInput id="buyer-phone" label="Phone number" dialCode={dialCode} onDialCodeChange={setDialCode} value={buyerPhone} onChange={setBuyerPhone} />
          {error && <p role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"><TriangleAlert className="h-4 w-4 shrink-0" />{error}</p>}
          <button type="submit" className={`${primaryButtonClass} w-full py-3.5`}><Wallet className="h-4 w-4" />Choose private payment method</button>
        </form>
      )}
      {awaitingConfirmation && <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-sm text-amber-200">Awaiting Shielded Confirmation… The tracker will update automatically.</p>}
      <Link href={`/order/${order.id}`} className="mx-auto mt-5 flex w-fit items-center gap-1 text-xs text-slate-500">View order status <ArrowRight className="h-3.5 w-3.5" /></Link>
      <ZcashCheckoutModal open={checkoutOpen} order={order} amount={total} onClose={() => setCheckoutOpen(false)} onPaymentSubmitted={(paymentTxid, buyerAddress) => void recordFunding(paymentTxid, buyerAddress)} />
    </PageShell>
  );
}
