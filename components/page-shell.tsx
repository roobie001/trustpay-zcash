import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";

/** Brand header shared by the buyer and seller pages. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-3xl items-center border-b border-border-subtle px-1 pb-4 sm:mt-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle text-brand">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight text-primary-text">
            {BRAND_NAME}
          </span>
          <span className="hidden rounded-full border border-border-subtle px-2.5 py-1 text-[11px] font-medium text-muted-text sm:inline-flex">
            Shielded Escrow
          </span>
        </Link>
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
      <div className="text-sm font-medium text-muted-text">{children}</div>
    </div>
  );
}
