"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Coins, LockKeyhole, ShieldCheck, Truck, Zap } from "lucide-react";
import { BRAND_NAME, VAULT_NAME } from "@/lib/constants";
import { CreateEscrowModal } from "@/components/create-escrow-modal";

const steps = [
  { icon: LockKeyhole, title: "Lock & Share", text: "Buyer locks ZEC in the shielded vault and gets a clear order record." },
  { icon: Truck, title: "Ship Item", text: "Seller fulfills the order while funds remain protected in escrow." },
  { icon: ShieldCheck, title: "Verify & Payout", text: "Buyer confirms delivery; funds release privately to the vendor." },
];

function Badge({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle px-3 py-1.5 text-xs font-medium text-muted-text">{icon}{children}</span>;
}

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-3xl items-center border-b border-border-subtle px-1 pb-4 sm:mt-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-brand"><ShieldCheck className="h-4 w-4" /></span>
          <span className="font-semibold tracking-tight text-primary-text">{BRAND_NAME}</span>
          <span className="hidden rounded-full border border-border-subtle px-2.5 py-1 text-[11px] font-medium text-muted-text sm:inline-flex">Shielded Escrow</span>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-14 sm:px-6">
        <section className="mx-auto flex max-w-2xl flex-col items-center pb-16 pt-20 text-center sm:pb-24 sm:pt-28">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand">Private escrow for social commerce</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-primary-text sm:text-6xl">Trade with confidence. Keep your payment private.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-text sm:text-lg">Create a focused Zcash escrow link for every sale. Funds stay protected until delivery is confirmed.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <Badge icon={<Zap className="h-4 w-4 text-brand"/>}>Shielded settlement</Badge>
            <Badge icon={<ShieldCheck className="h-4 w-4 text-brand"/>}>Encrypted memos</Badge>
            <Badge icon={<Coins className="h-4 w-4 text-brand"/>}>Private ZEC</Badge>
          </div>
          <button type="button" onClick={() => setModalOpen(true)} className="group mt-9 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-sm font-semibold text-canvas transition hover:bg-brand-hover">Create Escrow Link<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></button>
          <p className="mt-3 text-xs text-muted-text">No account required.</p>
        </section>

        <section aria-labelledby="how-it-works">
          <div className="mb-5 flex items-center justify-between"><h2 id="how-it-works" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-text">A clear path from payment to payout</h2><span className="hidden text-xs text-muted-text sm:block">01 — 03</span></div>
          <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {steps.map(({ icon: Icon, title, text }, index) => <li key={title} className="rounded-xl border border-border-subtle bg-surface p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle text-brand"><Icon className="h-4 w-4"/></span><span className="font-mono text-xs text-muted-text">0{index + 1}</span></div><h3 className="text-sm font-semibold text-primary-text">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-text">{text}</p></li>)}
          </ol>
        </section>
        <p className="mt-9 flex items-center justify-center gap-2 text-center text-xs text-muted-text"><ShieldCheck className="h-4 w-4 shrink-0 text-brand"/>Funds stay in the {VAULT_NAME} until delivery is confirmed.</p>
      </main>
      <CreateEscrowModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
