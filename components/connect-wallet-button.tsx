"use client";

import { Loader2, LogOut, Shield } from "lucide-react";
import { useZcashWallet } from "@/lib/use-escrow";
import { shortZcashAddress } from "@/lib/zcash";

export function ConnectWalletButton() {
  const { address, isConnected, connect, disconnect, pending } = useZcashWallet();

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => void disconnect()}
        title="Disconnect wallet"
        className="group inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-slate-200 backdrop-blur transition hover:border-red-500/40 hover:text-red-300"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500 group-hover:hidden" />
        <LogOut className="hidden h-3.5 w-3.5 group-hover:block" />
        <span className="font-mono text-xs">{shortZcashAddress(address)}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={() => void connect()}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:border-[#00F59B]/30 hover:bg-[#00F59B]/[0.08] disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Shield className="h-4 w-4" />
        )}
        Connect Zcash Wallet
      </button>
    </div>
  );
}
