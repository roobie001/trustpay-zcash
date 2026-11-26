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
  isTestnetZcashAddress,
  loadEphemeralZcashWallet,
  orderMemoPayload,
  type EphemeralZcashWallet,
} from "@/lib/zcash";
import { describeTxError, useZcashWallet } from "@/lib/use-escrow";
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

type CheckoutTab = "scan" | "manual" | "instant";

export function ZcashCheckoutModal({
  open,
  order,
  amount,
  simMode,
  onClose,
  onPaymentSubmitted,
}: {
  open: boolean;
  order: EscrowOrder;
  amount: number;
  simMode: boolean;
  onClose: () => void;
  onPaymentSubmitted: (txid: string, buyerAddress: string) => void;
}) {
  const [tab, setTab] = useState<CheckoutTab>("scan");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualTxid, setManualTxid] = useState("");
  const [manualBuyerAddress, setManualBuyerAddress] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState("");
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
    const configuredRelayerUrl = process.env.NEXT_PUBLIC_ZCASH_TESTNET_RELAYER_URL?.trim();
    const relayerUrl = configuredRelayerUrl && !/localhost|127\.0\.0\.1/i.test(configuredRelayerUrl)
      ? configuredRelayerUrl
      : "/api/relayer";
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

  async function simulatePayment() {
      setError(null);
      setSimulating(true);
      try {
        const simulatedWallet = ephemeral ?? createEphemeralZcashWallet();
        if (!ephemeral) setEphemeral(simulatedWallet);
        setSimulationStep("Broadcasting shielded transaction...");
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        setSimulationStep("Encrypting order ID in 512-byte memo...");
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        setSimulationStep("Confirming deposit in the escrow vault...");
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const simulatedTxid = `txid_sim_${Date.now()}`;
        const response = await fetch("/api/relayer/verify-deposit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: order.id, txid: simulatedTxid, simulation: true }),
        });
        const result = await response.json() as { success?: boolean; error?: string };
        if (!response.ok || !result.success) throw new Error(result.error ?? "Simulation verification failed.");
        onPaymentSubmitted(simulatedTxid, simulatedWallet.address);
      } catch (reason) {
        setError(describeTxError(reason));
      } finally {
        setSimulating(false);
        setSimulationStep("");
      }
  }

  function confirmManualPayment() {
    setError(null);
    if (!/^[a-f0-9]{64}$/i.test(manualTxid.trim())) {
      setError("Enter the 64-character transaction ID from your wallet.");
      return;
    }
    if (!isTestnetZcashAddress(manualBuyerAddress)) {
      setError("Enter the sender's utest1 testnet address.");
      return;
    }
    onPaymentSubmitted(manualTxid.trim(), manualBuyerAddress.trim());
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zcash-checkout-title"
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-800/80 bg-[#0F172A] p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">
              Private Shielded Checkout
            </span>
            <h2 id="zcash-checkout-title" className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-white">
              Pay <span className="tabular-nums text-amber-500">{formatZec(amount)}</span> with Zcash
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-800 bg-[#030712] p-1.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setError(null);
              }}
              className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors ${
                tab === id
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Testnet / Simulation Box */}
        {(simMode || isTestnetZcashAddress(order.escrow_vault_address) || process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")) && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-400">⚡ Simulate Testnet Deposit</p>
                <p className="mt-0.5 text-xs text-slate-300">Instant shielded escrow funding simulation for testnet demo.</p>
              </div>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-400">
                Demo / Testnet
              </span>
            </div>
            <button
              type="button"
              onClick={() => void simulatePayment()}
              disabled={simulating}
              className={`${primaryButtonClass} mt-3.5 w-full`}
            >
              {simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {simulating ? simulationStep : "Simulate Testnet Deposit"}
            </button>
          </div>
        )}

        {/* Tab 1: Scan / Open QR */}
        {tab === "scan" && (
          <div className="mt-5 text-center">
            {uri ? (
              <>
                <div className="mx-auto w-fit rounded-2xl bg-white p-4 shadow-lg flex items-center justify-center">
                  <QRCodeSVG value={uri} size={210} includeMargin />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-300">
                  Scan this ZIP-321 payment QR, or open it directly in a compatible wallet.
                </p>
                <a href={uri} className={`${primaryButtonClass} mt-4 w-full`}>
                  <Wallet className="h-4 w-4" />
                  Open in Zcash Wallet
                </a>
              </>
            ) : (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
                The escrow vault address is not a valid Zcash testnet address.
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Use a shielded wallet so the encrypted memo is attached properly.
            </p>
          </div>
        )}

        {/* Tab 2: Manual Transfer */}
        {tab === "manual" && (
          <div className="mt-5 space-y-3.5">
            {fields.map(([label, value, name]) => (
              <div key={name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</label>
                  <button
                    type="button"
                    onClick={() => void copy(value, name)}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                  >
                    {copied === name ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === name ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="break-all select-all rounded-xl border border-slate-800 bg-[#030712] p-3 font-mono text-xs sm:text-sm text-slate-200">
                  {value}
                </div>
              </div>
            ))}
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs leading-relaxed text-amber-200">
              The memo is required for automatic escrow matching. After sending, enter the transaction ID and sender address below.
            </p>
            <input
              value={manualTxid}
              onChange={(event) => setManualTxid(event.target.value)}
              className={`${inputClass} font-mono text-xs sm:text-sm`}
              placeholder="64-character txid (hex)"
            />
            <input
              value={manualBuyerAddress}
              onChange={(event) => setManualBuyerAddress(event.target.value)}
              className={`${inputClass} font-mono text-xs sm:text-sm`}
              placeholder="Sender utest1... address"
            />
            <button
              type="button"
              onClick={confirmManualPayment}
              className={`${primaryButtonClass} w-full`}
            >
              Confirm Payment Sent
            </button>
            {wallet.isConnected ? (
              <button
                type="button"
                onClick={() => void payWithProvider()}
                disabled={wallet.pending}
                className={`${primaryButtonClass} w-full`}
              >
                {wallet.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Pay with Connected Wallet
              </button>
            ) : providerAvailable ? (
              <button
                type="button"
                onClick={() => void connectProvider()}
                disabled={wallet.pending}
                className={`${secondaryButtonClass} w-full`}
              >
                <Wallet className="h-4 w-4" />
                Quick-connect Injected Zcash Wallet
              </button>
            ) : (
              <p className="rounded-xl border border-slate-800 bg-[#030712] p-3.5 text-xs text-slate-400">
                No injected browser wallet detected. Use the QR, manual transfer, or Instant Browser Wallet tab.
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Instant Wallet */}
        {tab === "instant" && (
          <div className="mt-5">
            <div className={`${cardClass} border-slate-800 bg-[#030712] p-4 sm:p-5`}>
              <p className="text-sm font-semibold text-white">Testnet Judge Demo</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                This creates a local demo address. It is not connected to your Zodl/Vizor wallet and cannot show its balance. For a real funded payment, use Scan / Open or Manual transfer.
              </p>
              {ephemeral ? (
                <div className="mt-4 space-y-3.5">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Ephemeral Shielded Address
                    </span>
                    <p className="mt-1 break-all select-all rounded-lg border border-slate-800 bg-[#0B1120] p-2.5 font-mono text-xs text-amber-400">
                      {ephemeral.address}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Testnet balance</span>
                    <strong className="font-mono text-sm tabular-nums text-white">
                      {ephemeral.balanceZec === null ? "Unavailable" : `${ephemeral.balanceZec.toFixed(8)} ZEC`}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open(process.env.NEXT_PUBLIC_ZCASH_TESTNET_FAUCET_URL, "_blank", "noopener,noreferrer")}
                    className={`${secondaryButtonClass} w-full`}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Faucet / Top-up Testnet ZEC
                  </button>
                  <button
                    type="button"
                    onClick={() => void payWithInstantWallet()}
                    className={`${primaryButtonClass} w-full`}
                  >
                    <Shield className="h-4 w-4" />
                    Pay with Instant Browser Wallet
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={createBrowserWallet}
                  className={`${primaryButtonClass} mt-4 w-full`}
                >
                  <Smartphone className="h-4 w-4" />
                  Create Testnet Browser Wallet
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
