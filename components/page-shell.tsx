import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

/** Background, brand header and wallet button shared by the buyer and seller pages. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#07080B]/80">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10"
      />

      <header className="relative mx-auto mt-5 flex w-[calc(100%-2rem)] max-w-5xl items-center justify-between gap-3 rounded-full border border-white/[0.08] bg-[#0E121A]/80 px-4 py-3 backdrop-blur-xl sm:mt-6 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00F59B1A] text-[#00F59B]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            {BRAND_NAME}
          </span>
        </Link>
        <ConnectWalletButton />
      </header>

      <main className="relative flex flex-1 flex-col items-center px-4 pb-16 pt-4 sm:pt-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

/** Centered full-height message used for loading / not-found / already-paid states. */
export function PageMessage({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      {icon}
      <div className="text-sm font-medium text-slate-600 dark:text-slate-400">{children}</div>
    </div>
  );
}
