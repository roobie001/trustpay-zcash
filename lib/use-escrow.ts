"use client";

import { useState } from "react";
import {
  createOrderMemo,
  isZcashAddress,
  type ShieldedPaymentRequest,
  type ZcashAddress,
} from "@/lib/zcash";

export type EscrowStatus =
  | "PENDING_PAYMENT"
  | "HELD_IN_ESCROW"
  | "DISPATCHED"
  | "FUNDS_RELEASED"
  | "DISPUTED";

export type TxPhase = "connecting" | "signing" | "confirming";

export const TX_PHASE_LABELS: Record<TxPhase, string> = {
  connecting: "Connecting Zcash wallet...",
  signing: "Confirm in your wallet...",
  confirming: "Confirming shielded payment...",
};

function getWallet() {
  if (typeof window === "undefined" || !window.zcash) {
    throw new Error(
      "No Zcash wallet found. Install a wallet that exposes the Zcash shielded payment API."
    );
  }
  return window.zcash;
}

export function describeTxError(error: unknown): string {
  return error instanceof Error ? error.message : "Shielded transaction failed.";
}

export function useZcashWallet() {
  const [address, setAddress] = useState<ZcashAddress | null>(null);
  const [phase, setPhase] = useState<TxPhase | null>(null);

  async function connect() {
    setPhase("connecting");
    try {
      const result = await getWallet().connect();
      if (!isZcashAddress(result.address)) {
        throw new Error("The connected wallet returned an invalid Zcash shielded address.");
      }
      setAddress(result.address);
      return result.address;
    } finally {
      setPhase(null);
    }
  }

  async function sendShieldedPayment(request: ShieldedPaymentRequest) {
    if (!isZcashAddress(request.recipient)) {
      throw new Error("The escrow vault does not have a valid Zcash shielded address.");
    }
    if (!Number.isFinite(request.amount) || request.amount <= 0) {
      throw new Error("The shielded payment amount must be positive.");
    }

    setPhase("connecting");
    try {
      const wallet = getWallet();
      if (!address) {
        const result = await wallet.connect();
        if (!isZcashAddress(result.address)) {
          throw new Error("The connected wallet returned an invalid Zcash shielded address.");
        }
        setAddress(result.address);
      }
      setPhase("signing");
      const result = await wallet.sendShieldedPayment(request);
      setPhase("confirming");
      return result;
    } finally {
      setPhase(null);
    }
  }

  async function disconnect() {
    await window.zcash?.disconnect?.();
    setAddress(null);
  }

  return {
    address,
    isConnected: Boolean(address),
    connect,
    disconnect,
    sendShieldedPayment,
    pending: phase !== null,
    phase,
  };
}

export function buildFundingMemo(orderId: string, buyerAddress: string, amount: number): string {
  return createOrderMemo(orderId, {
    type: "trustpay-funding",
    buyerAddress,
    amount: amount.toFixed(8),
  });
}
