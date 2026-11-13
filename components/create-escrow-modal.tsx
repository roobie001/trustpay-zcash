"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, Link2, Loader2, Pencil, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { isZcashAddress } from "@/lib/zcash";
import { formatZec, isValidZecInput } from "@/lib/format";
import type { Seller } from "@/lib/supabase";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

type Props = { open: boolean; onClose: () => void };
const PROFILE_KEY = "trustpay:seller-profile";
const TOKEN_KEY = "trustpay:seller-token";

function truncateAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

export function CreateEscrowModal({ open, onClose }: Props) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sellerResult, setSellerResult] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [overrideAddress, setOverrideAddress] = useState(false);
  const [orderAddress, setOrderAddress] = useState("");

  useEffect(() => {
    let active = true;
    async function hydrate() {
      const url = new URL(window.location.href);
      const token = url.searchParams.get("sellerToken") ?? localStorage.getItem(TOKEN_KEY);
      if (!token) {
        if (active) setLoading(false);
        return;
      }
      const response = await fetch(`/api/seller?token=${encodeURIComponent(token)}`);
      if (!response.ok) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(PROFILE_KEY);
        if (active) setLoading(false);
        return;
      }
      const data = await response.json() as { seller: Seller };
      if (active) {
        setSeller(data.seller);
        setStoreName(data.seller.store_name);
        setSocialHandle(data.seller.social_handle ?? "");
        setPayoutAddress(data.seller.payout_address);
        localStorage.setItem(TOKEN_KEY, data.seller.seller_secret_token);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(data.seller));
        setLoading(false);
        if (url.searchParams.has("sellerToken")) window.history.replaceState({}, "", window.location.pathname);
      }
    }
    void hydrate().catch(() => { if (active) { setError("Could not restore your seller profile."); setLoading(false); } });
    return () => { active = false; };
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!storeName.trim() || !isZcashAddress(payoutAddress)) {
      setError("Enter a store name and a valid shielded Zcash address. Transparent t1/t3 addresses are not supported.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/seller", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seller_secret_token: seller?.seller_secret_token ?? localStorage.getItem(TOKEN_KEY) ?? undefined,
          store_name: storeName,
          social_handle: socialHandle,
          payout_address: payoutAddress,
        }),
      });
      const data = await response.json() as { seller?: Seller; error?: string };
      if (!response.ok || !data.seller) throw new Error(data.error ?? "Failed to save profile.");
      setSeller(data.seller);
      localStorage.setItem(TOKEN_KEY, data.seller.seller_secret_token);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(data.seller));
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function createOrder(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const sellerToken = seller?.seller_secret_token ?? localStorage.getItem(TOKEN_KEY) ?? "";
    const amountZec = Number.parseFloat(amount);
    if (!seller || !seller.id || !sellerToken || !itemTitle.trim() || !isValidZecInput(amount) || !Number.isFinite(amountZec) || amountZec <= 0) {
      setError("Enter an item title and a positive ZEC amount.");
      return;
    }
    const payout = overrideAddress ? orderAddress.trim() : seller.payout_address;
    if (!isZcashAddress(payout)) {
      setError("Use a valid shielded Zcash payout address.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        item_title: itemTitle.trim(),
        amount: amountZec,
        delivery_fee: 0,
        delivery_notes: deliveryNotes.trim(),
        seller_id: seller.id,
        seller_secret_token: sellerToken,
        seller_name: seller.store_name,
        vendor_address: payout,
        escrow_vault_address: process.env.NEXT_PUBLIC_ZCASH_ESCROW_VAULT_ADDRESS ?? "",
      };
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { id?: string; sellerKey?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? "Failed to create order.");
      const link = `${window.location.origin}/pay/${data.id}`;
      setResult(link);
      if (data.sellerKey) {
        setSellerResult(`${window.location.origin}/order/${data.id}?key=${encodeURIComponent(data.sellerKey)}`);
      }
      setItemTitle("");
      setAmount("");
      setDeliveryNotes("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to create order.");
    } finally {
      setSaving(false);
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!open) return null;
  const profileReady = Boolean(seller) && !editing;
  const syncLink = seller ? `${window.location.origin}/?sellerToken=${seller.seller_secret_token}` : "";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-canvas/90 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border-subtle bg-surface p-6 sm:rounded-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">TrustPay seller</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-primary-text">{profileReady ? "Create a fast escrow link" : "Set Up Your Seller Profile (One-Time)"}</h2></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-muted-text hover:bg-white/[0.04] hover:text-primary-text"><X className="h-5 w-5" /></button></div>
        {loading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-400" /></div> : profileReady ? (
          <>
            <div className="mb-5 rounded-lg border border-border-subtle bg-[#161920] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-text">Saved Seller Profile</p><p className="font-semibold text-primary-text">{seller!.store_name}</p><p className="font-mono text-xs text-muted-text">{truncateAddress(seller!.payout_address)}</p></div><div className="flex gap-2"><button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-text hover:bg-white/[0.04]"><Pencil className="h-3.5 w-3.5" />Edit</button><button type="button" onClick={() => void copyValue(syncLink)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-brand hover:bg-brand/10">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}Sync</button></div></div>
            </div>
            <form onSubmit={createOrder} className="space-y-5">
              <div><label htmlFor="item-title" className={labelClass}>Item / Order Title</label><input id="item-title" value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} placeholder="e.g. Nike Dunk Low Retro" className={inputClass} /></div>
              <div><label htmlFor="amount" className={labelClass}>Amount (ZEC)</label><input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.25000000" className={inputClass} />{amount && isValidZecInput(amount) && <p className="mt-1 text-xs text-slate-500">{formatZec(Number(amount))}</p>}</div>
              <div><label htmlFor="delivery-notes" className={labelClass}>Delivery Terms / Notes <span className="font-normal text-slate-500">(optional)</span></label><textarea id="delivery-notes" value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} rows={2} className={inputClass} placeholder="Meet at the agreed delivery point" /></div>
              <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={overrideAddress} onChange={(e) => { setOverrideAddress(e.target.checked); setOrderAddress(seller!.payout_address); }} />Use a different payout address for this order</label>
              {overrideAddress && <input value={orderAddress} onChange={(e) => setOrderAddress(e.target.value)} className={`${inputClass} font-mono`} placeholder="u1... or zs1..." />}
              <button type="submit" disabled={saving} className={`${primaryButtonClass} w-full`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}Generate One-Time Buyer Link</button>
            </form>
          </>
        ) : (
          <form onSubmit={saveProfile} className="space-y-5">
            <div><label htmlFor="store-name" className={labelClass}>Store / Vendor Name</label><input id="store-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Roobie Kicks" className={inputClass} /></div>
            <div><label htmlFor="social-handle" className={labelClass}>Social Handle / WhatsApp <span className="font-normal text-slate-500">(optional)</span></label><input id="social-handle" value={socialHandle} onChange={(e) => setSocialHandle(e.target.value)} placeholder="@roobiekicks" className={inputClass} /></div>
            <div><label htmlFor="payout-address" className={labelClass}>Default Zcash Payout Address</label><input id="payout-address" value={payoutAddress} onChange={(e) => setPayoutAddress(e.target.value)} placeholder="u1... or zs1..." className={`${inputClass} font-mono`} />{payoutAddress && <p className={`mt-1 flex items-center gap-1 text-xs ${isZcashAddress(payoutAddress) ? "text-emerald-400" : "text-amber-400"}`}>{isZcashAddress(payoutAddress) ? <Check className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}Paste your Unified Address from Vizor on PC or Zodl on mobile.</p>}</div>
            <button type="submit" disabled={saving} className={`${primaryButtonClass} w-full`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Save Profile &amp; Continue</button>
          </form>
        )}
        {editing && <button type="button" onClick={() => setEditing(false)} className={`${secondaryButtonClass} mt-3 w-full`}>Cancel editing</button>}
        {result && <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4"><p className="text-sm font-semibold text-emerald-300">Buyer link ready</p><p className="mt-2 break-all font-mono text-xs text-slate-300">{result}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => void copyValue(result)} className={`${primaryButtonClass} flex-1`}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}1-Click Copy Link</button><a href={`https://wa.me/?text=${encodeURIComponent(`Pay securely via TrustPay: ${result}`)}`} target="_blank" rel="noreferrer" className={`${secondaryButtonClass} flex-1`}>Share to WhatsApp</a></div>{sellerResult && <button type="button" onClick={() => void copyValue(sellerResult)} className="mt-3 w-full text-xs text-brand">Copy seller dashboard link</button>}</div>}
        {error && <p role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"><TriangleAlert className="h-4 w-4 shrink-0" />{error}</p>}
      </div>
    </div>
  );
}
