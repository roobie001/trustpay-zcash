"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Coins,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react";
import { VAULT_NAME } from "@/lib/constants";
import { BrandLockup } from "@/components/BrandLogo";
import { CreateEscrowModal } from "@/components/create-escrow-modal";
import { RecentDeals } from "@/components/RecentDeals";
import { SellerDashboard } from "@/components/SellerDashboard";
import { getZcashNetwork, setZcashNetwork, type ZcashNetwork } from "@/lib/storage";

const steps = [
  {
    icon: LockKeyhole,
    title: "Lock & Share",
    text: "Buyer locks ZEC in the shielded vault and receives an encrypted order record.",
  },
  {
    icon: Truck,
    title: "Ship with Rider",
    text: "Seller fulfills and tracks dispatch while funds remain neutral in escrow.",
  },
  {
    icon: ShieldCheck,
    title: "Verify & Settle",
    text: "Buyer verifies package and confirms PIN; funds release privately to vendor.",
  },
];

function Badge({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-800/90 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-300 shadow-sm">
      {icon}
      {children}
    </span>
  );
}

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [sellerDashOpen, setSellerDashOpen] = useState(false);
  const [network, setNetwork] = useState<ZcashNetwork>(() => getZcashNetwork());

  function handleToggleNetwork(net: ZcashNetwork) {
    setNetwork(net);
    setZcashNetwork(net);
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#030712] text-slate-100 overflow-x-hidden w-full">
      {/* Top Navbar */}
      <header className="mx-auto w-full max-w-5xl border-b border-slate-800/80 px-4 pt-3 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
        {/* Top Row: Brand Lockup + Compact Network Toggle + Desktop Dashboard */}
        <div className="flex items-center justify-between gap-3">
          <BrandLockup href="/" subtitle="Shielded Escrow" />

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Testnet vs Mainnet Switcher (Compact single-line on mobile, full label on desktop) */}
            <div className="flex shrink-0 rounded-full border border-slate-800 bg-[#0F172A] p-1 text-xs font-semibold shadow-inner">
              <button
                type="button"
                onClick={() => handleToggleNetwork("testnet")}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  network === "testnet"
                    ? "bg-amber-500 text-[#030712] font-bold shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Switch to Zcash Testnet (TAZ)"
              >
                <span>TAZ</span>
                <span className="hidden sm:inline">&nbsp;Testnet</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleNetwork("mainnet")}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  network === "mainnet"
                    ? "bg-amber-500 text-[#030712] font-bold shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Switch to Zcash Mainnet (ZEC)"
              >
                <span>ZEC</span>
                <span className="hidden sm:inline">&nbsp;Mainnet</span>
              </button>
            </div>

            {/* Desktop Dashboard Button */}
            <button
              type="button"
              onClick={() => setSellerDashOpen(true)}
              className="hidden sm:inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white shrink-0"
            >
              <LayoutDashboard className="h-4 w-4 text-amber-500" />
              <span>Seller Dashboard</span>
            </button>
          </div>
        </div>

        {/* Mobile Action Bar (< 640px / sm:): Dashboard + Recent Deals */}
        <div className="mt-2.5 flex items-center gap-2 sm:hidden w-full">
          <button
            type="button"
            onClick={() => setSellerDashOpen(true)}
            className="flex flex-1 min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-amber-500" />
            <span>Seller Dashboard</span>
          </button>
          <a
            href="#recent-deals-heading"
            className="flex flex-1 min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            <span>Recent Deals</span>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-20 sm:px-6 overflow-x-hidden">
        {/* Hero Section */}
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-2 pb-12 pt-10 text-center sm:px-0 sm:pb-24 sm:pt-20">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
            Private Escrow for Social Commerce
          </p>
          <h1 className="text-3xl font-bold leading-[1.14] tracking-tight text-white sm:text-5xl md:text-6xl">
            Trade with confidence. <br className="hidden sm:inline" />
            Keep your payment private.
          </h1>
          <p className="mt-5 sm:mt-6 max-w-2xl px-2 text-base leading-relaxed text-slate-300 sm:px-0 sm:text-lg">
            Create a focused Zcash shielded escrow link for every sale. Balances, payments, and addresses
            stay encrypted until delivery is confirmed.
          </p>

          <div className="mt-7 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
            <Badge icon={<Zap className="h-4 w-4 text-amber-500" />}>Shielded Settlement</Badge>
            <Badge icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}>Encrypted Memos</Badge>
            <Badge icon={<Coins className="h-4 w-4 text-amber-500" />}>Private ZEC</Badge>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="group mt-8 sm:mt-10 inline-flex min-h-[50px] sm:min-h-[52px] w-full sm:w-auto max-w-xs items-center justify-center gap-2.5 rounded-xl bg-amber-500 px-8 text-base font-semibold text-[#030712] shadow-xl shadow-amber-500/10 transition hover:bg-amber-400 active:scale-[0.99]"
          >
            Create Escrow Link
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </button>
          <p className="mt-3 text-xs text-slate-400">No account required. Instant seller profile setup.</p>
        </section>

        {/* How It Works Section */}
        <section aria-labelledby="how-it-works" className="mt-4">
          <div className="mb-6 flex items-center justify-between">
            <h2
              id="how-it-works"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
            >
              A Clear Path from Payment to Payout
            </h2>
            <span className="hidden font-mono text-xs text-slate-500 sm:block">01 — 03</span>
          </div>

          <ol className="grid gap-4 sm:grid-cols-3 sm:gap-5">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <li
                key={title}
                className="rounded-2xl border border-slate-800/80 bg-[#0F172A]/90 p-6 shadow-lg shadow-black/20 sm:p-7"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#030712] text-amber-500 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-xs font-semibold text-amber-500">0{index + 1}</span>
                </div>
                <h3 className="text-base sm:text-lg font-semibold tracking-tight text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Recent Deals & Cross-Device Sync Component */}
        <RecentDeals onOpenSellerDashboard={() => setSellerDashOpen(true)} />

        {/* Vault Guarantee Footer Note */}
        <p className="mt-16 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          Funds stay in the {VAULT_NAME} until doorstep delivery is confirmed.
        </p>
      </main>

      <CreateEscrowModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <SellerDashboard open={sellerDashOpen} onClose={() => setSellerDashOpen(false)} />
    </div>
  );
}
