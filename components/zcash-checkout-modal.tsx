"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, Loader2, QrCode, Shield, Smartphone, Wallet, X } from "lucide-react";
import type { EscrowOrder } from "@/lib/supabase";
import {
  buildZcashPaymentUri,
  createEphemeralZcashWallet,
  encodeMemoBase64Url,
  formatZec,
  hasInjectedZcashWallet,
  loadEphemeralZcashWallet,
  orderMemoPayload,
  type EphemeralZcashWallet,
} from "@/lib/zcash";
import { describeTxError, useZcashWallet } from "@/lib/use-escrow";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

type CheckoutTab = "scan" | "manual" | "instant";

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
  onPaymentSubmitted: (txid: string, buyerAddress: string) => void;
}) {
  const [tab, setTab] = useState<CheckoutTab>("scan");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ephemeral, setEphemeral] = useState<EphemeralZcashWallet | null>(() => loadEphemeralZcashWallet());
  const wallet = useZcashWallet();
  const providerAvailable = useSyncExternalStore(
    () => () => undefined,
    hasInjectedZcashWallet,
    () => false
  );
  const memo = orderMemoPayload(order.id);
  const uri = useMemo(() => {
    try {
      return buildZcashPaymentUri({
        address: order.escrow_vault_address,
        amountZec: amount,
        orderId: order.id,
        label: "TrustPay escrow",
      });
    } catch {
      return null;
    }
  },
    [amount, order.escrow_vault_address, order.id]
  );

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

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
      const address = wallet.address ?? await wallet.connect();
      const result = await wallet.sendShieldedPayment({ recipient: order.escrow_vault_address, amount, memo });
      onPaymentSubmitted(result.txid, address);
    } catch (reason) {
      setError(describeTxError(reason));
    }
  }

  function createBrowserWallet() {
    setError(null);
    setEphemeral(createEphemeralZcashWallet());
  }

  async function payWithInstantWallet() {
    if (!ephemeral) return;
    setError(null);
    const relayerUrl = process.env.NEXT_PUBLIC_ZCASH_TESTNET_RELAYER_URL;
    if (!relayerUrl) {
      setError("Instant Browser Wallet needs NEXT_PUBLIC_ZCASH_TESTNET_RELAYER_URL for testnet demos.");
      return;
    }
    try {
      const response = await fetch(`${relayerUrl.replace(/\/$/, "")}/testnet/fund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          buyerAddress: ephemeral.address,
          recipient: order.escrow_vault_address,
          amount,
          memo,
        }),
      });
      const responseText = await response.text();
      let result: { txid?: string; error?: string } = {};
      try {
        result = JSON.parse(responseText) as { txid?: string; error?: string };
      } catch {
        throw new Error(
          `The configured testnet relayer returned an unexpected response (${response.status}). Check NEXT_PUBLIC_ZCASH_TESTNET_RELAYER_URL.`
        );
      }
      if (!response.ok || !result.txid) throw new Error(result.error ?? "Testnet relayer did not accept the payment.");
      onPaymentSubmitted(result.txid, ephemeral.address);
    } catch (reason) {
      setError(describeTxError(reason));
    }
  }

  if (!open) return null;
  const encodedMemo = encodeMemoBase64Url(memo);
  const fields = [
    ["Escrow Unified Address", order.escrow_vault_address, "address"],
    ["Exact Amount", amount.toFixed(8), "amount"],
    ["Required Order Memo (Base64URL)", encodedMemo, "memo"],
  ] as const;
  const tabs: { id: CheckoutTab; label: string; icon: typeof QrCode }[] = [
    { id: "scan", label: "Scan / Open", icon: QrCode },
    { id: "manual", label: "Manual transfer", icon: Copy },
    { id: "instant", label: "Instant wallet", icon: Smartphone },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-canvas/90 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="zcash-checkout-title" className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border-subtle bg-surface p-6 sm:rounded-2xl sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Private checkout</p><h2 id="zcash-checkout-title" className="mt-1 text-xl font-semibold tracking-tight text-primary-text">Pay {formatZec(amount)} with Zcash</h2></div>
          <button type="button" onClick={onClose} aria-label="Close checkout" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border-subtle bg-canvas p-1">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setTab(id); setError(null); }} className={`flex items-center justify-center gap-1 rounded-md px-2 py-2.5 text-[11px] font-semibold transition sm:text-xs ${tab === id ? "bg-brand text-canvas" : "text-muted-text hover:text-primary-text"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
        </div>

        {tab === "scan" && <div className="mt-5 text-center">
          {uri ? <><div className="mx-auto w-fit rounded-2xl bg-white p-3"><QRCodeSVG value={uri} size={210} includeMargin /></div>
          <p className="mt-4 text-sm text-muted-text">Scan this ZIP-321 payment QR, or open it directly in a compatible wallet.</p>
          <a href={uri} className={`${primaryButtonClass} mt-4 w-full`}><Wallet className="h-4 w-4" />Open in Zcash Wallet</a></> : <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">The escrow vault address is not a valid Zcash testnet address.</p>}
          <p className="mt-3 text-xs leading-relaxed text-muted-text">Use a shielded wallet so the encrypted memo is attached properly.</p>
        </div>}

        {tab === "manual" && <div className="mt-5 space-y-3">
          {fields.map(([label, value, name]) => <div key={name}><div className="mb-1 flex items-center justify-between"><label className="text-xs font-semibold text-muted-text">{label}</label><button type="button" onClick={() => void copy(value, name)} className="inline-flex items-center gap-1 text-xs text-brand">{copied === name ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied === name ? "Copied" : "Copy"}</button></div><div className="break-all rounded-lg border border-border-subtle bg-canvas p-3 font-mono text-xs text-primary-text">{value}</div></div>)}
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">The memo is required for automatic escrow matching. Omitting it can leave the deposit unrecognized.</p>
          {wallet.isConnected ? <button type="button" onClick={() => void payWithProvider()} disabled={wallet.pending} className={`${primaryButtonClass} w-full`}>{wallet.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}Pay with connected wallet</button> : providerAvailable ? <button type="button" onClick={() => void connectProvider()} disabled={wallet.pending} className={`${secondaryButtonClass} w-full`}><Wallet className="h-4 w-4" />Quick-connect injected Zcash wallet</button> : <p className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-400">No injected browser wallet detected. Use the QR, manual transfer, or Instant Browser Wallet tab.</p>}
        </div>}

        {tab === "instant" && <div className="mt-5">
          <div className={`${cardClass} border-white/10 bg-slate-950/50 p-4`}>
            <p className="text-sm font-semibold text-white">Testnet judge demo</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">This zero-install wallet is ephemeral and testnet-only. It requires the configured testnet relayer to create a real shielded transaction.</p>
            {ephemeral ? <div className="mt-4 space-y-3"><div><p className="text-xs text-muted-text">Ephemeral shielded address</p><p className="mt-1 break-all font-mono text-xs text-brand">{ephemeral.address}</p></div><div className="flex items-center justify-between text-sm text-muted-text"><span>Testnet balance</span><strong className="font-mono tabular-nums text-primary-text">{ephemeral.balanceZec.toFixed(8)} ZEC</strong></div><button type="button" onClick={() => window.open(process.env.NEXT_PUBLIC_ZCASH_TESTNET_FAUCET_URL, "_blank", "noopener,noreferrer")} className={`${secondaryButtonClass} w-full`}><ExternalLink className="h-4 w-4" />Faucet / Top-up testnet ZEC</button><button type="button" onClick={() => void payWithInstantWallet()} className={`${primaryButtonClass} w-full`}><Shield className="h-4 w-4" />Pay with Instant Browser Wallet</button></div> : <button type="button" onClick={createBrowserWallet} className={`${primaryButtonClass} mt-4 w-full`}><Smartphone className="h-4 w-4" />Create testnet browser wallet</button>}
          </div>
        </div>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}
