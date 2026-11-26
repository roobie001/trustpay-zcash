"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Coins, Menu, PlusCircle, ShieldCheck, X } from "lucide-react";
import { BrandLockup } from "@/components/BrandLogo";

interface PageShellProps {
  children: ReactNode;
  /** Role context: 'buyer' checkout hides seller link-creation controls */
  role?: "buyer" | "tracker" | "general";
  /** Optional custom right-side badge or action (e.g. network indicator) */
  rightSlot?: ReactNode;
}

/** Brand header shared by the buyer checkout and order tracker pages. */
export function PageShell({ children, role = "general", rightSlot }: PageShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isGeneral = role === "general";

  // Close mobile drawer when resizing to desktop
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 640px)");
    function handleResize(e: MediaQueryListEvent) {
      if (e.matches) setMenuOpen(false);
    }
    mql.addEventListener("change", handleResize);
    return () => mql.removeEventListener("change", handleResize);
  }, []);

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#030712] text-slate-100 overflow-x-hidden w-full">
      <header className="mx-auto w-full max-w-5xl border-b border-slate-800/80 px-4 pt-3 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
        {/* Top Bar: Brand Lockup on Left, Contextual Right Slot / Controls */}
        <div className="flex items-center justify-between gap-3">
          <BrandLockup href="/" subtitle="Shielded Escrow" />

          {/* Buyer Checkout or Order Tracker: Strictly role-specific controls (no vendor creation clutter) */}
          {!isGeneral ? (
            <div className="flex shrink-0 items-center gap-2">
              {rightSlot ?? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 sm:px-3 py-1 text-xs font-semibold text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>{role === "tracker" ? "Shielded Escrow" : "Shielded Vault"}</span>
                </span>
              )}
            </div>
          ) : (
            <>
              {/* General view: Desktop Navigation Links (sm: and up) */}
              <div className="hidden sm:flex shrink-0 items-center gap-2.5">
                {rightSlot}
                <Link
                  href="/"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-800 bg-[#0F172A] px-3.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  <PlusCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span>Create Escrow</span>
                </Link>
                <Link
                  href="/#recent-deals-heading"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-800 bg-[#0F172A] px-3.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  <Coins className="h-3.5 w-3.5 text-amber-500" />
                  <span>Recent Deals</span>
                </Link>
              </div>

              {/* Mobile Hamburger Button (< 640px / sm:) */}
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-label="Toggle navigation menu"
                className="flex sm:hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-800 bg-[#0F172A] p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 shrink-0"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          )}
        </div>

        {/* Collapsible Mobile Menu Drawer (only for general, never for buyer or tracker) */}
        {isGeneral && menuOpen && (
          <div className="mt-3 block sm:hidden rounded-2xl border border-slate-800/90 bg-[#0F172A]/95 p-4 shadow-2xl backdrop-blur-md transition-all">
            <div className="space-y-2.5">
              <span className="block mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Navigation &amp; Escrow
              </span>

              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-800 bg-[#030712] px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
              >
                <div className="flex items-center gap-2.5">
                  <PlusCircle className="h-4 w-4 text-amber-500" />
                  <span>Create New Escrow Link</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
              </Link>

              <Link
                href="/#recent-deals-heading"
                onClick={() => setMenuOpen(false)}
                className="flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-800 bg-[#030712] px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
              >
                <div className="flex items-center gap-2.5">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span>Recent Escrow Deals</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
              </Link>

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Shielded Zcash Escrow Active</span>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="relative flex flex-1 flex-col items-center px-4 pb-20 pt-6 sm:px-6 sm:pt-10 w-full overflow-x-hidden">
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
