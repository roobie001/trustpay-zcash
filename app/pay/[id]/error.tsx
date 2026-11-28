"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

export default function PayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PayError:ClientBoundary] Caught error:", error);
  }, [error]);

  return (
    <PageShell role="buyer">
      <div className="mx-auto max-w-md text-center py-12 px-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 shadow-sm shadow-red-500/10">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Unable to Load Checkout
        </h2>
        <p className="mt-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
          An unexpected error occurred while loading this escrow checkout. Your funds and order records remain completely secure.
        </p>

        {process.env.NODE_ENV !== "production" && error?.message && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-[#030712] p-3 text-left font-mono text-[11px] text-red-300 overflow-x-auto">
            {error.message}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className={`${primaryButtonClass} w-full sm:w-auto px-6 py-3 text-xs`}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            className={`${secondaryButtonClass} w-full sm:w-auto px-6 py-3 text-xs`}
          >
            <Home className="h-4 w-4" />
            <span>TrustPay Home</span>
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
