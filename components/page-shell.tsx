import type { ReactNode } from "react";
import { BrandLockup } from "@/components/BrandLogo";

/** Brand header shared by the buyer checkout and order tracker pages. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#030712] text-slate-100">
      <header className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-5xl items-center justify-between border-b border-slate-800/80 px-2 pb-4 sm:mt-5">
        <BrandLockup href="/" subtitle="Shielded Escrow" />
      </header>

      <main className="relative flex flex-1 flex-col items-center px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}

/** Centered full-height message used for loading / not-found / error states. */
export function PageMessage({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3.5 py-28 text-center">
      {icon}
      <div className="text-sm sm:text-base font-medium text-slate-400">{children}</div>
    </div>
  );
}
