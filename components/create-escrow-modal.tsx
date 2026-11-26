"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { isZcashAddress } from "@/lib/zcash";
import { formatZec, formatZecEquivalents, getZecRates, isValidZecInput, type ZecRates } from "@/lib/format";
import { DEFAULT_DIAL_CODE, toE164 } from "@/lib/phone";
import type { Seller } from "@/lib/supabase";
import {
  buildWhatsAppShareUrl,
  getSavedSellerProfile,
  getZcashNetwork,
  saveRecentDeal,
  saveSellerProfile,
  setZcashNetwork,
  type SellerProfile,
  type ZcashNetwork,
  encodeOrderMetadata,
} from "@/lib/storage";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";
import { PhoneInput } from "@/components/phone-input";

type Props = { open: boolean; onClose: () => void };

const TOKEN_KEY = "trustpay:seller-token";

function truncateAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function CreateEscrowModal({ open, onClose }: Props) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedBuyer, setCopiedBuyer] = useState(false);
  const [copiedSeller, setCopiedSeller] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sellerResult, setSellerResult] = useState<string | null>(null);
  const [whatsAppUrl, setWhatsAppUrl] = useState<string | null>(null);

  // Profile Fields
  const [storeName, setStoreName] = useState(() => getSavedSellerProfile()?.store_name || "");
  const [sellerPhone, setSellerPhone] = useState(() => {
    const p = getSavedSellerProfile()?.phone || "";
    const digits = p.replace(/\D/g, "");
    if (digits.startsWith("234") && digits.length > 3) return digits.slice(3);
    return digits;
  });
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE.dial);
  const [socialHandle, setSocialHandle] = useState("");
  const [payoutAddress, setPayoutAddress] = useState(() => getSavedSellerProfile()?.payout_address || "");

  // Order Fields
  const [itemTitle, setItemTitle] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [itemCondition, setItemCondition] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [overrideAddress, setOverrideAddress] = useState(false);
  const [orderAddress, setOrderAddress] = useState("");

  // Live Exchange Rates & Network
  const [rates, setRates] = useState<ZecRates | null>(null);
  const [network, setNetworkState] = useState<ZcashNetwork>(() => getZcashNetwork());

  useEffect(() => {
    void getZecRates().then(setRates);
  }, []);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      const savedProfile = getSavedSellerProfile();

      // Check URL parameter or token in server database
      const url = new URL(window.location.href);
      const token =
        url.searchParams.get("sellerToken") ??
        savedProfile?.seller_secret_token ??
        localStorage.getItem(TOKEN_KEY);

      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/seller?token=${encodeURIComponent(token)}`);
        if (response.ok) {
          const data = (await response.json()) as { seller: Seller };
          if (active && data.seller) {
            setSeller(data.seller);
            setStoreName(data.seller.store_name);
            setSocialHandle(data.seller.social_handle ?? "");
            setPayoutAddress(data.seller.payout_address);

            saveSellerProfile({
              store_name: data.seller.store_name,
              phone: savedProfile?.phone || "",
              social_handle: data.seller.social_handle ?? "",
              payout_address: data.seller.payout_address,
              seller_secret_token: data.seller.seller_secret_token,
            });

            if (url.searchParams.has("sellerToken")) {
              window.history.replaceState({}, "", window.location.pathname);
            }
          }
        }
      } catch {
        // Continue with local profile
      } finally {
        if (active) setLoading(false);
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  function handleToggleNetwork(net: ZcashNetwork) {
    setNetworkState(net);
    setZcashNetwork(net);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const phone = toE164(dialCode, sellerPhone) || sellerPhone.trim();

    if (!storeName.trim() || !isZcashAddress(payoutAddress)) {
      setError(
        "Enter a vendor name and a valid Zcash payout address (u1..., zs1..., t1..., or testnet utest1... / tm...)."
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/seller", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seller_secret_token:
            seller?.seller_secret_token ?? localStorage.getItem(TOKEN_KEY) ?? undefined,
          store_name: storeName.trim(),
          social_handle: socialHandle.trim() || phone || null,
          payout_address: payoutAddress.trim(),
        }),
      });
      const data = (await response.json()) as { seller?: Seller; error?: string };
      if (!response.ok || !data.seller) throw new Error(data.error ?? "Failed to save profile.");

      setSeller(data.seller);
      const profileData: SellerProfile = {
        store_name: data.seller.store_name,
        phone,
        social_handle: data.seller.social_handle ?? "",
        payout_address: data.seller.payout_address,
        seller_secret_token: data.seller.seller_secret_token,
      };
      saveSellerProfile(profileData);
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
    const amountZec = Number.parseFloat(itemPrice);
    const feeZec = Number.parseFloat(deliveryFee) || 0;

    if (
      !seller ||
      !seller.id ||
      !sellerToken ||
      !itemTitle.trim() ||
      !isValidZecInput(itemPrice) ||
      !Number.isFinite(amountZec) ||
      amountZec <= 0
    ) {
      setError("Enter an item title and a positive ZEC amount.");
      return;
    }

    const payout = overrideAddress ? orderAddress.trim() : seller.payout_address;
    if (!isZcashAddress(payout)) {
      setError("Use a valid Zcash payout address (u1..., zs1..., t1..., utest1..., tm...).");
      return;
    }

    setSaving(true);
    try {
      // Encode delivery notes with item condition and descriptions
      const encodedNotes = encodeOrderMetadata(deliveryNotes.trim(), {
        item_condition: itemCondition.trim() || undefined,
        item_description: deliveryNotes.trim() || undefined,
      });

      const vault =
        process.env.NEXT_PUBLIC_ZCASH_ESCROW_VAULT_ADDRESS ||
        "utest1qx0z2p4lm9xwh3fe6jc0nj6qfmyj5sd5tere2kvvgsgvp8phempuhtykfy4gy3qdkaxak60svsq409dg7auxmmeaqutrg6jgevpew9a3";

      const phone = toE164(dialCode, sellerPhone) || sellerPhone.trim();

      const payload = {
        item_title: itemTitle.trim(),
        amount: amountZec,
        delivery_fee: feeZec,
        delivery_notes: encodedNotes,
        seller_id: seller.id,
        seller_secret_token: sellerToken,
        seller_name: seller.store_name,
        seller_phone: phone,
        vendor_address: payout,
        escrow_vault_address: vault,
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        id?: string;
        sellerKey?: string;
        error?: string;
      };

      if (!response.ok || !data.id) throw new Error(data.error ?? "Failed to create order.");

      const payLink = `${window.location.origin}/pay/${data.id}`;
      const trackLink = `${window.location.origin}/order/${data.id}${
        data.sellerKey ? `?key=${encodeURIComponent(data.sellerKey)}` : ""
      }`;

      setResult(payLink);
      setSellerResult(trackLink);

      // Save into local recent deals
      saveRecentDeal({
        id: data.id,
        item_title: itemTitle.trim(),
        amount: amountZec,
        delivery_fee: feeZec,
        role: "seller",
        status: "PENDING_PAYMENT",
        created_at: new Date().toISOString(),
        sellerKey: data.sellerKey,
        vendor_address: payout,
      });

      // Prepare 1-tap WhatsApp share URL
      const totalZec = amountZec + feeZec;
      const equiv = formatZecEquivalents(totalZec, rates).summary;
      const waUrl = buildWhatsAppShareUrl({
        itemTitle: itemTitle.trim(),
        zecAmount: totalZec,
        orderUrl: payLink,
        usdNgnText: equiv,
      });
      setWhatsAppUrl(waUrl);

      // Clear fields
      setItemTitle("");
      setItemPrice("");
      setDeliveryFee("0");
      setItemCondition("");
      setDeliveryNotes("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to create order.");
    } finally {
      setSaving(false);
    }
  }

  async function copyValue(value: string, isBuyer: boolean) {
    await navigator.clipboard.writeText(value);
    if (isBuyer) {
      setCopiedBuyer(true);
      window.setTimeout(() => setCopiedBuyer(false), 2000);
    } else {
      setCopiedSeller(true);
      window.setTimeout(() => setCopiedSeller(false), 2000);
    }
  }

  if (!open) return null;

  const profileReady = Boolean(seller) && !editing;
  const syncLink = seller
    ? `${window.location.origin}/?sellerToken=${seller.seller_secret_token}`
    : "";

  const calculatedTotal =
    (Number.parseFloat(itemPrice) || 0) + (Number.parseFloat(deliveryFee) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-800 bg-[#0F172A] p-6 sm:rounded-2xl sm:p-8 shadow-2xl"
      >
        {/* Header & Network Indicator Switcher */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
                TrustPay Vendor
              </p>
              {/* Testnet vs Mainnet Switcher */}
              <div className="flex rounded-full border border-slate-800 bg-[#030712] p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => handleToggleNetwork("testnet")}
                  className={`rounded-full px-2.5 py-0.5 transition ${
                    network === "testnet"
                      ? "bg-amber-500 text-[#030712] font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  TAZ Testnet
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleNetwork("mainnet")}
                  className={`rounded-full px-2.5 py-0.5 transition ${
                    network === "mainnet"
                      ? "bg-amber-500 text-[#030712] font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  ZEC Mainnet
                </button>
              </div>
            </div>
            <h2 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-white">
              {profileReady ? "Create Escrow Link" : "Seller Profile Setup"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
          </div>
        ) : profileReady ? (
          <>
            {/* Saved Profile Summary Card */}
            <div className="mb-5 rounded-2xl border border-slate-800 bg-[#030712] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Saved Seller Profile
                  </p>
                  <p className="font-bold text-white text-base mt-0.5">{seller!.store_name}</p>
                  <p className="font-mono text-xs text-slate-400 mt-0.5">
                    {truncateAddress(seller!.payout_address)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyValue(syncLink, false)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20"
                  >
                    {copiedSeller ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Sync
                  </button>
                </div>
              </div>
            </div>

            {/* Escrow Link Form */}
            <form onSubmit={createOrder} className="space-y-4">
              <div>
                <label htmlFor="item-title" className={labelClass}>
                  Item / Order Title *
                </label>
                <input
                  id="item-title"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="e.g. Nike Dunk Low Retro"
                  className={inputClass}
                />
              </div>

              {/* Price & Currency Equivalents */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="amount" className={labelClass}>
                    Item Price (ZEC) *
                  </label>
                  <input
                    id="amount"
                    inputMode="decimal"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="0.25000000"
                    className={inputClass}
                  />
                  {itemPrice && isValidZecInput(itemPrice) && (
                    <p className="mt-1.5 text-xs text-amber-400 font-medium tabular-nums">
                      {formatZecEquivalents(Number(itemPrice), rates).summary}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="delivery-fee" className={labelClass}>
                    Delivery Fee (ZEC)
                  </label>
                  <input
                    id="delivery-fee"
                    inputMode="decimal"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder="0.01000000"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Item Condition & Delivery SLA (Cleanly stacked with full width to prevent clipping) */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="condition" className={labelClass}>
                    Item Condition <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <input
                    id="condition"
                    value={itemCondition}
                    onChange={(e) => setItemCondition(e.target.value)}
                    placeholder="e.g. Brand New, Pristine"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="delivery-notes" className={labelClass}>
                    Delivery SLA / Notes <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <input
                    id="delivery-notes"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="e.g. Same-day delivery via rider"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Override payout address option */}
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={overrideAddress}
                  onChange={(e) => {
                    setOverrideAddress(e.target.checked);
                    setOrderAddress(seller!.payout_address);
                  }}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                />
                Use custom payout address for this specific order
              </label>

              {overrideAddress && (
                <input
                  value={orderAddress}
                  onChange={(e) => setOrderAddress(e.target.value)}
                  className={`${inputClass} font-mono text-xs`}
                  placeholder="u1... or utest1... address"
                />
              )}

              {/* Total Display */}
              {calculatedTotal > 0 && (
                <div className="rounded-xl border border-slate-800 bg-[#030712] p-4 text-xs flex justify-between items-center shadow-inner">
                  <span className="text-slate-400 uppercase tracking-wider font-semibold">
                    Total Escrow Value:
                  </span>
                  <div className="text-right">
                    <strong className="font-mono text-lg font-bold tabular-nums text-amber-500">
                      {formatZec(calculatedTotal)}
                    </strong>
                    <p className="text-xs text-slate-400 tabular-nums">
                      {formatZecEquivalents(calculatedTotal, rates).summary}
                    </p>
                  </div>
                </div>
              )}

              <button type="submit" disabled={saving} className={`${primaryButtonClass} w-full py-4 text-base`}>
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Link2 className="h-5 w-5" />
                )}
                Generate One-Time Buyer Link
              </button>
            </form>
          </>
        ) : (
          /* Profile Setup / Edit Form */
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label htmlFor="store-name" className={labelClass}>
                Store / Vendor Name *
              </label>
              <input
                id="store-name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Roobie Kicks"
                className={inputClass}
              />
            </div>

            <PhoneInput
              id="seller-phone"
              label="WhatsApp Phone Number *"
              dialCode={dialCode}
              onDialCodeChange={setDialCode}
              value={sellerPhone}
              onChange={setSellerPhone}
            />

            <div>
              <label htmlFor="social-handle" className={labelClass}>
                Social Handle / Instagram <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="social-handle"
                value={socialHandle}
                onChange={(e) => setSocialHandle(e.target.value)}
                placeholder="@roobiekicks"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="payout-address" className={labelClass}>
                Default Zcash Payout Address *
              </label>
              <input
                id="payout-address"
                value={payoutAddress}
                onChange={(e) => setPayoutAddress(e.target.value)}
                placeholder="u1... or utest1... address"
                className={`${inputClass} font-mono text-xs`}
              />
              {payoutAddress && (
                <p
                  className={`mt-1.5 flex items-center gap-1.5 text-xs ${
                    isZcashAddress(payoutAddress) ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {isZcashAddress(payoutAddress) ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <TriangleAlert className="h-3.5 w-3.5" />
                  )}
                  {isZcashAddress(payoutAddress)
                    ? "Valid Zcash address format."
                    : "Address format not recognized."}
                </p>
              )}
            </div>

            <button type="submit" disabled={saving} className={`${primaryButtonClass} w-full py-4 text-base`}>
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
              Save Profile &amp; Continue
            </button>
          </form>
        )}

        {editing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className={`${secondaryButtonClass} mt-3 w-full`}
          >
            Cancel editing
          </button>
        )}

        {/* Link Output Block */}
        {result && (
          <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-300">Escrow Link Ready to Share</p>
            <p className="mt-2 break-all font-mono text-xs text-slate-200 select-all p-3 rounded-xl bg-[#030712] border border-slate-800">
              {result}
            </p>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={() => void copyValue(result, true)}
                className={`${primaryButtonClass} flex-1`}
              >
                {copiedBuyer ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedBuyer ? "Copied!" : "1-Click Copy Link"}
              </button>

              {whatsAppUrl && (
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${secondaryButtonClass} flex-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}
                >
                  <ExternalLink className="h-4 w-4" />
                  Share to WhatsApp
                </a>
              )}
            </div>

            {sellerResult && (
              <button
                type="button"
                onClick={() => void copyValue(sellerResult, false)}
                className="mt-3.5 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-amber-400 hover:underline"
              >
                {copiedSeller ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedSeller ? "Copied Seller Link!" : "Copy Private Seller Dashboard Link"}
              </button>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300"
          >
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
