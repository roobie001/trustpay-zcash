"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, LayoutDashboard, Loader2, PackageCheck, ShieldCheck, Truck, TriangleAlert, Wallet } from "lucide-react";
import { supabase, type EscrowOrder } from "@/lib/supabase";
import { explorerTxUrl, formatZec, shortZcashAddress } from "@/lib/zcash";
import { BRAND_NAME, VAULT_NAME } from "@/lib/constants";
import { cardClass, darkButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";
import { PageMessage, PageShell } from "@/components/page-shell";

const stages = [
  ["PENDING_PAYMENT", "Payment awaiting confirmation", ShieldCheck],
  ["HELD_IN_ESCROW", `Payment held in ${VAULT_NAME}`, ShieldCheck],
  ["DISPATCHED", "Dispatched with rider", Truck],
  ["FUNDS_RELEASED", "Funds released privately", PackageCheck],
] as const;

async function readJsonResponse<T extends object>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: `Request failed with status ${response.status}.` } as T;
  }
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const key = useSearchParams().get("key");
  const [order, setOrder] = useState<EscrowOrder | null>(null);
  const [sellerView, setSellerView] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualTxid, setManualTxid] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.from("escrow_orders").select("*").eq("id", id).maybeSingle().then(({ data }) => { if (active) setOrder(data); });
    if (key) void fetch(`/api/orders/${id}/verify-seller?key=${encodeURIComponent(key)}`).then((r) => r.json()).then((data) => { if (active) setSellerView(Boolean(data.isSeller)); });
    const channel = supabase.channel(`escrow_orders:${id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "escrow_orders", filter: `id=eq.${id}` }, (payload) => { if (active) setOrder(payload.new as EscrowOrder); }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [id, key]);

  useEffect(() => {
    let active = true;
    async function refreshStatus() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(id)}/status?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { "cache-control": "no-cache" },
        });
        if (!response.ok) return;
        const data = await response.json() as {
          status?: EscrowOrder["status"];
          fund_txid?: string | null;
          release_txid?: string | null;
        };
        if (active && data.status) {
          setOrder((current) => current
            ? {
                ...current,
                status: data.status!,
                fund_txid: data.fund_txid ?? current.fund_txid,
                release_txid: data.release_txid ?? current.release_txid,
              }
            : current);
        }
      } catch {
        // Supabase realtime remains active; a transient polling failure is recoverable.
      }
    }
    void refreshStatus();
    const interval = window.setInterval(() => void refreshStatus(), 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [id]);

  async function updateStatus(status: "DISPATCHED" | "DISPUTED") {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/orders/${id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, key: status === "DISPATCHED" ? key : undefined }) });
      const data = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Unable to update order.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update order."); }
    finally { setBusy(false); }
  }

  async function releaseFunds() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/orders/${id}/release`, { method: "POST" });
      const data = await readJsonResponse<{ success?: boolean; status?: string; txid?: string; payoutTxid?: string; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? `Release failed with status ${response.status}.`);
      if (!data.success) throw new Error(data.error ?? "Unable to release funds.");
      setOrder((current) => current ? { ...current, status: "FUNDS_RELEASED", release_txid: data.payoutTxid ?? data.txid ?? current.release_txid } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to release funds."); }
    finally { setBusy(false); }
  }

  async function confirmPaymentId() {
    setManualError(null);
    const txid = manualTxid.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(txid)) {
      setManualError("Paste the 64-character transaction ID from the Zingo! receipt.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/relayer/verify-deposit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: id, txid }),
      });
      const data = await response.json() as { success?: boolean; txid?: string; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Unable to verify this payment ID.");
      }
      setOrder((current) => current
        ? { ...current, status: "HELD_IN_ESCROW", fund_txid: data.txid ?? txid }
        : current);
      setManualTxid("");
    } catch (reason) {
      setManualError(reason instanceof Error ? reason.message : "Unable to verify this payment ID.");
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <PageShell><PageMessage icon={<Loader2 className="h-6 w-6 animate-spin text-slate-400" />}>Loading order…</PageMessage></PageShell>;
  const total = Number(order.amount) + Number(order.delivery_fee);
  const stageIndex = Math.max(0, stages.findIndex(([status]) => status === order.status));
  const released = order.status === "FUNDS_RELEASED";
  return (
    <PageShell>
      <div className="mb-6 text-center">
        {sellerView && <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300"><LayoutDashboard className="h-3.5 w-3.5 text-emerald-400" />Seller dashboard</span>}
        <h1 className="text-2xl font-bold text-white">{order.item_title}</h1>
        <p className="mt-1 text-sm text-slate-400">{formatZec(total)} · {order.seller_name}</p>
      </div>
      {order.status === "DISPUTED" && <Banner tone="amber">Escrow frozen. {BRAND_NAME} will mediate before any payout.</Banner>}
      {released && <Banner tone="green">Funds released to the vendor through a shielded payout.</Banner>}
      <div className={`${cardClass} mb-4 p-5`}>
        <ol className="space-y-5">{stages.map(([status, label, Icon], index) => {
          const done = order.status !== "DISPUTED" && index <= stageIndex;
          return <li key={status} className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-700 text-slate-600"}`}><Icon className="h-4 w-4" /></span><span className={done ? "text-sm text-white" : "text-sm text-slate-500"}>{label}</span></li>;
        })}</ol>
      </div>
      {sellerView && <div className={`${cardClass} mb-4 p-5`}><h2 className="mb-3 text-sm font-semibold text-white">Shielded payout destination</h2><p className="font-mono text-xs text-slate-400">{shortZcashAddress(order.vendor_address)}</p>{released && order.release_txid && <a className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-400" href={explorerTxUrl(order.release_txid)} target="_blank" rel="noreferrer">View payout transaction <ExternalLink className="h-3.5 w-3.5" /></a>}</div>}
      {!sellerView && order.status === "PENDING_PAYMENT" && <details className={`${cardClass} mb-4 p-4`}>
        <summary className="cursor-pointer text-sm font-semibold text-primary-text">Manual Payment Verification (Zingo! Receipt)</summary>
        <div className="mt-4 space-y-3">
          <p className="text-xs leading-relaxed text-muted-text">Paste the transaction ID from your wallet after sending the exact amount and required TrustPay memo.</p>
          <input value={manualTxid} onChange={(event) => setManualTxid(event.target.value)} placeholder="64-character transaction ID" className={`${inputClass} font-mono`} inputMode="text" autoComplete="off" />
          {manualError && <p role="alert" className="text-xs text-red-300">{manualError}</p>}
          <button type="button" onClick={() => void confirmPaymentId()} disabled={busy} className={`${primaryButtonClass} w-full`}>
            {busy ? "Verifying payment…" : "Confirm Payment ID"}
          </button>
        </div>
      </details>}
      {error && <p role="alert" className="mb-3 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"><TriangleAlert className="h-4 w-4 shrink-0" />{error}</p>}
      <div className="space-y-3">
        {sellerView && order.status === "HELD_IN_ESCROW" && <button onClick={() => void updateStatus("DISPATCHED")} disabled={busy} className={`${darkButtonClass} w-full`}><Truck className="h-4 w-4" />{busy ? "Updating…" : "Mark as dispatched"}</button>}
        {!sellerView && order.status === "DISPATCHED" && <button onClick={() => void releaseFunds()} disabled={busy} className={`${primaryButtonClass} w-full py-3.5`}><Wallet className="h-5 w-5" />{busy ? "Submitting shielded payout…" : `Confirm delivery & release ${formatZec(total)}`}</button>}
        {!sellerView && ["HELD_IN_ESCROW", "DISPATCHED"].includes(order.status) && <button onClick={() => void updateStatus("DISPUTED")} disabled={busy} className={`${secondaryButtonClass} w-full`}>Raise a dispute</button>}
      </div>
      <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">Zcash shielded transactions keep balances, addresses, order metadata, and payout history private. The encrypted memo is limited to 512 bytes.</p>
    </PageShell>
  );
}

function Banner({ children, tone }: { children: React.ReactNode; tone: "amber" | "green" }) {
  return <div className={`mb-4 flex gap-2 rounded-2xl border p-4 text-sm ${tone === "amber" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}><ShieldCheck className="h-5 w-5 shrink-0" />{children}</div>;
}
