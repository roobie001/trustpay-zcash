"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Coins, LockKeyhole, ShieldCheck, Truck, Zap } from "lucide-react";
import { BRAND_NAME, VAULT_NAME } from "@/lib/constants";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { CreateEscrowModal } from "@/components/create-escrow-modal";

const steps = [
  { icon: LockKeyhole, title: "Lock & Share", text: "Buyer locks ZEC in the shielded vault and gets a clear order record." },
  { icon: Truck, title: "Ship Item", text: "Seller fulfills the order while funds remain protected in escrow." },
  { icon: ShieldCheck, title: "Verify & Payout", text: "Buyer confirms delivery; funds release privately to the vendor." },
];

function Badge({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 py-2 text-xs font-medium text-slate-300 backdrop-blur-xl">{icon}{children}</span>;
}

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#07080B]/80">
      <header className="relative mx-auto mt-5 flex w-[calc(100%-2rem)] max-w-5xl items-center justify-between rounded-full border border-white/[0.08] bg-[#0E121A]/80 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl sm:mt-6 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00F59B1A] text-[#00F59B]"><ShieldCheck className="h-5 w-5" /></span>
          <span className="font-semibold tracking-tight text-white">{BRAND_NAME}</span>
          <span className="hidden items-center gap-2 rounded-full border border-[#00F59B]/20 bg-[#00F59B]/[0.06] px-3 py-1 text-[11px] font-medium text-[#9afbd0] sm:inline-flex"><span className="h-2 w-2 rounded-full bg-[#00F59B]"/>Zcash Shielded</span>
        </div>
        <ConnectWalletButton />
      </header>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-14 sm:px-6">
        <section className="flex flex-col items-center pb-16 pt-16 text-center sm:pb-20 sm:pt-24">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#0E121A]/80 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-300 sm:hidden"><span className="h-1.5 w-1.5 rounded-full bg-[#00F59B]"/>Zcash Shielded</span>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#00F59B]">Escrow for the way people trade now</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-balance text-white sm:text-6xl">Social Commerce With <span className="bg-gradient-to-r from-[#00F59B] to-[#8affe0] bg-clip-text text-transparent">Incorruptible Rails.</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">Create private escrow links for WhatsApp, Telegram, X, and Instagram sales. Shielded ZEC payments keep balances, histories, and order memos confidential.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <Badge icon={<Zap className="h-4 w-4 text-amber-300"/>}>Shielded settlement</Badge>
            <Badge icon={<ShieldCheck className="h-4 w-4 text-[#00F59B]"/>}>Encrypted order memos</Badge>
            <Badge icon={<Coins className="h-4 w-4 text-[#2775CA]"/>}>Private ZEC</Badge>
          </div>
          <button type="button" onClick={() => setModalOpen(true)} className="group mt-9 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00F59B] px-7 py-4 text-base font-bold text-[#06110c] shadow-[0_12px_45px_-12px_#00f59b80] transition hover:-translate-y-0.5 hover:bg-[#00DC8B] hover:shadow-[0_16px_55px_-12px_#00f59b99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#00F59B]/30 active:translate-y-0">Create Escrow Link<ArrowRight className="h-5 w-5 transition group-hover:translate-x-1"/></button>
          <p className="mt-3 text-xs text-slate-500">No sign-up. Takes about 30 seconds.</p>
        </section>

        <section aria-labelledby="how-it-works">
          <div className="mb-5 flex items-center justify-between"><h2 id="how-it-works" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">A clear path from payment to payout</h2><span className="hidden text-xs text-slate-600 sm:block">01 — 03</span></div>
          <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {steps.map(({ icon: Icon, title, text }, index) => <li key={title} className="rounded-2xl border border-white/[0.08] bg-[#0E121A]/75 p-5 backdrop-blur-xl transition hover:border-[#00F59B]/25 hover:bg-[#111923]/90 sm:p-6"><div className="mb-5 flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00F59B1A] text-[#00F59B]"><Icon className="h-5 w-5"/></span><span className="font-mono text-xs text-slate-600">0{index + 1}</span></div><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></li>)}
          </ol>
        </section>
        <p className="mt-9 flex items-center justify-center gap-2 text-center text-xs text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0 text-[#00F59B]"/>Funds stay in the {VAULT_NAME} shielded vault until the buyer confirms delivery.</p>
      </main>
      <CreateEscrowModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
