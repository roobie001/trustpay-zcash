"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
  Store,
  TriangleAlert,
  X,
} from "lucide-react";
import { formatZec, isValidZecInput } from "@/lib/zcash";
import { escrowShareText, whatsappPaymentMessage } from "@/lib/constants";
import { DEFAULT_DIAL_CODE, toE164 } from "@/lib/phone";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";
import { isZcashAddress } from "@/lib/zcash";
import { PhoneInput } from "@/components/phone-input";
import { UsdcIcon } from "@/components/usdc-icon";

const CLOSE_ANIMATION_MS = 200;

type Step = "details" | "payout" | "success";

interface CreateOrderResult {
  buyerUrl: string;
  sellerUrl: string;
}

function UsdcInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pr-20 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-2 my-auto flex h-6 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 pl-1 pr-2 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <UsdcIcon className="h-4 w-4" />
        ZEC
      </span>
    </div>
  );
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function CreateEscrowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("details");
  const [itemTitle, setItemTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE.dial);
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerWallet, setSellerWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateOrderResult | null>(null);
  const [copied, setCopied] = useState<"buyer" | "seller" | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const sellerNameInputRef = useRef<HTMLInputElement>(null);

  const amountValid = isValidZecInput(amount) && Number(amount) > 0;
  const feeValid = !deliveryFee.trim() || isValidZecInput(deliveryFee);
  const detailsValid = Boolean(itemTitle.trim()) && amountValid && feeValid;
  const total = (Number(amount) || 0) + (Number(deliveryFee) || 0);

  const walletInput = sellerWallet.trim();
  const walletValid = isZcashAddress(walletInput);
  const e164Phone = toE164(dialCode, sellerPhone);

  function resetForm() {
    setStep("details");
    setItemTitle("");
    setAmount("");
    setDeliveryFee("");
    setSellerName("");
    setDialCode(DEFAULT_DIAL_CODE.dial);
    setSellerPhone("");
    setSellerWallet("");
    setError(null);
    setResult(null);
    setCopied(null);
  }

  function handleClose() {
    if (loading) return;
    onClose();
    // A finished link starts fresh next time; an unfinished draft is kept.
    if (step === "success") setTimeout(resetForm, CLOSE_ANIMATION_MS);
  }

  // Esc to close, and lock page scroll behind the dialog.
  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  });
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleCloseRef.current();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Move focus to the first field of whichever step is showing.
  useEffect(() => {
    if (!open) return;
    const target =
      step === "details"
        ? titleInputRef.current
        : step === "payout"
          ? sellerNameInputRef.current
          : panelRef.current;
    target?.focus({ preventScroll: true });
  }, [open, step]);

  function goToPayout(e: FormEvent) {
    e.preventDefault();
    if (!detailsValid) return;
    setError(null);
    setStep("payout");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!sellerName.trim() || !sellerPhone.trim() || !walletInput) {
      setError("Please fill in every field.");
      return;
    }
    if (!e164Phone) {
      setError("Enter a valid phone number for the selected country.");
      return;
    }
    if (!walletValid) {
      setError("Enter a valid seller Zcash shielded address (u1...).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_title: itemTitle.trim(),
          amount: Number(amount),
          delivery_fee: deliveryFee ? Number(deliveryFee) : 0,
          seller_name: sellerName.trim(),
          seller_phone: e164Phone,
          vendor_address: walletInput,
          escrow_vault_address: process.env.NEXT_PUBLIC_ZCASH_ESCROW_VAULT_ADDRESS,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Something went wrong. Try again.");
        return;
      }

      setResult({
        buyerUrl: `${window.location.origin}/pay/${json.id}`,
        sellerUrl: `${window.location.origin}/order/${json.id}?key=${json.sellerKey}`,
      });
      setStep("success");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(which: "buyer" | "seller", url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  const shareText = escrowShareText(itemTitle.trim());
  const shareLinks = result
    ? {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(
          whatsappPaymentMessage(itemTitle.trim(), result.buyerUrl)
        )}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(result.buyerUrl)}&text=${encodeURIComponent(shareText)}`,
        x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(result.buyerUrl)}&text=${encodeURIComponent(shareText)}`,
      }
    : null;

  const stepIndex = step === "details" ? 0 : step === "payout" ? 1 : 2;
  const heading =
    step === "details" ? "Order details" : step === "payout" ? "Seller payout" : "Escrow link ready";

  return (
    <div
      inert={!open}
      aria-hidden={!open}
      className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6 ${
        open ? "visible" : "invisible"
      } transition-[visibility] duration-200`}
    >
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-escrow-title"
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-white/[0.08] bg-[#0E121A]/95 shadow-2xl shadow-black/50 outline-none backdrop-blur-xl transition duration-200 ease-out sm:max-h-[min(44rem,calc(100dvh-3rem))] sm:max-w-lg sm:rounded-2xl ${
          open
            ? "translate-y-0 opacity-100 sm:scale-100"
            : "translate-y-8 opacity-0 sm:translate-y-2 sm:scale-95"
        }`}
      >
        {/* Header: progress + title + close */}
        <div className="shrink-0 px-5 pt-4 sm:px-7 sm:pt-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden dark:bg-slate-700" />
          <div className="mb-4 flex gap-1.5" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out ${
                    stepIndex > i || (stepIndex === i && step !== "success") ? "w-full" : "w-0"
                  } ${stepIndex === i ? "opacity-60" : ""}`}
                />
              </div>
            ))}
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {step === "success" ? "Done" : `Step ${stepIndex + 1} of 2`}
              </p>
              <h2
                id="create-escrow-title"
                className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
              >
                {heading}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              aria-label="Close"
              className="-mr-1.5 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body: scrolls on short screens, header stays put */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-7 sm:pb-7">
          {step === "details" && (
            <form
              key="details"
              onSubmit={goToPayout}
              noValidate
              className="animate-step-in space-y-4 motion-reduce:animate-none"
            >
              <div>
                <label htmlFor="item-title" className={labelClass}>
                  Product Name
                </label>
                <input
                  ref={titleInputRef}
                  id="item-title"
                  type="text"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="e.g. Nike Dunk Low Retro"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
                <div>
                  <label htmlFor="item-price" className={labelClass}>
                    Item Price
                  </label>
                  <UsdcInput id="item-price" value={amount} onChange={setAmount} placeholder="25.00" />
                </div>
                <div>
                  <label htmlFor="delivery-fee" className={labelClass}>
                    Delivery Fee
                  </label>
                  <UsdcInput
                    id="delivery-fee"
                    value={deliveryFee}
                    onChange={setDeliveryFee}
                    placeholder="1.50"
                  />
                </div>
              </div>

              {(amount && !amountValid) || !feeValid ? (
                <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                  Use a positive ZEC amount with at most 8 decimals.
                </p>
              ) : null}

              <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                <div>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Buyer locks in escrow
                  </p>
                  <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70">
                    Item + delivery, held by the shielded vault
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                  <UsdcIcon className="h-5 w-5" />
                  {formatZec(total)}
                </span>
              </div>

              <button type="submit" disabled={!detailsValid} className={`${primaryButtonClass} w-full`}>
                Continue to Payout
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            </form>
          )}

          {step === "payout" && (
            <form
              key="payout"
              onSubmit={handleSubmit}
              noValidate
              className="animate-step-in space-y-4 motion-reduce:animate-none"
            >
              <div>
                <label htmlFor="seller-name" className={labelClass}>
                  Seller Name / Store Name
                </label>
                <input
                  ref={sellerNameInputRef}
                  id="seller-name"
                  type="text"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Your name or store name"
                  className={inputClass}
                />
              </div>

              <PhoneInput
                id="seller-phone"
                label="Contact Phone"
                dialCode={dialCode}
                onDialCodeChange={setDialCode}
                value={sellerPhone}
                onChange={setSellerPhone}
              />

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="seller-wallet"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Seller Zcash Shielded Address
                  </label>
                </div>
                <input
                  id="seller-wallet"
                  type="text"
                  value={sellerWallet}
                  onChange={(e) => setSellerWallet(e.target.value)}
                  placeholder="u1… or z-address"
                  spellCheck={false}
                  autoComplete="off"
                  className={`${inputClass} font-mono`}
                />
                <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                  {!walletInput ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      &quot;ZEC is paid out to this shielded address when the buyer confirms delivery.&quot;
                    </span>
                  ) : walletValid ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      Valid Zcash shielded address — payout stays private.
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                      That doesn&apos;t look like a valid Zcash shielded address.
                    </span>
                  )}
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("details");
                  }}
                  disabled={loading}
                  className={`${secondaryButtonClass} shrink-0 disabled:opacity-50`}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button type="submit" disabled={loading} className={`${primaryButtonClass} flex-1`}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Generate Escrow Link
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {step === "success" && result && shareLinks && (
            <div key="success" className="animate-step-in motion-reduce:animate-none">
              <div className="mb-5 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium">
                  {formatZec(total)} escrow for &ldquo;{itemTitle.trim()}&rdquo; is ready. Share
                  this link with your buyer.
                </p>
              </div>

              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Buyer payment link
              </label>
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5 dark:border-slate-800 dark:bg-slate-950/60">
                <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700 dark:text-slate-300">
                  {result.buyerUrl}
                </span>
                <button
                  type="button"
                  onClick={() => copyLink("buyer", result.buyerUrl)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {copied === "buyer" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "buyer" ? "Copied" : "Copy Link"}
                </button>
              </div>

              <div className="mb-6 grid grid-cols-3 gap-2">
                <a
                  href={shareLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-2 py-2.5 text-xs font-semibold text-white transition hover:brightness-95 sm:text-sm"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <a
                  href={shareLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#229ED9] px-2 py-2.5 text-xs font-semibold text-white transition hover:brightness-95 sm:text-sm"
                >
                  <Send className="h-4 w-4" />
                  Telegram
                </a>
                <a
                  href={shareLinks.x}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-black px-2 py-2.5 text-xs font-semibold text-white ring-1 ring-white/10 transition hover:bg-slate-800 sm:text-sm"
                >
                  <XLogo className="h-3.5 w-3.5" />
                  Post on X
                </a>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-500/20 dark:bg-amber-500/5">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <Store className="h-3.5 w-3.5" />
                  Your private seller dashboard — save this
                </p>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-amber-900/80 dark:text-amber-200/80">
                    {result.sellerUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyLink("seller", result.sellerUrl)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-500/10"
                  >
                    {copied === "seller" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied === "seller" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-amber-800/70 dark:text-amber-300/70">
                  The only way to mark this order dispatched later. Don&apos;t share it.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className={`${secondaryButtonClass} mt-5 w-full`}
              >
                Create Another Link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
