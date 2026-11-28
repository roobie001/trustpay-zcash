import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  detectNetworkFromVaultAddress,
  isValidZcashTxid,
  scanViewingKeyForOrder,
  verifyOnChainTx,
} from "@/lib/zcash-verifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing order ID." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("escrow_orders")
    .select("id, status, amount, delivery_fee, escrow_vault_address, deposit_txid, fund_txid, funded_at, confirmations")
    .eq("id", id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
  }

  // If already confirmed in escrow or further
  if (
    order.status === "HELD_IN_ESCROW" ||
    order.status === "DISPATCHED" ||
    order.status === "FUNDS_RELEASED"
  ) {
    return NextResponse.json({
      success: true,
      verified: true,
      status: order.status,
      txid: order.deposit_txid || order.fund_txid,
      confirmations: order.confirmations ?? 1,
    });
  }

  const network = detectNetworkFromVaultAddress(order.escrow_vault_address);
  const totalAmount = Number(order.amount) + Number(order.delivery_fee || 0);

  // Check if viewing key or indexer picked up the deposit
  const scan = await scanViewingKeyForOrder(order.id, totalAmount, network);
  if (scan.found && scan.txid) {
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("escrow_orders")
      .update({
        status: "HELD_IN_ESCROW",
        deposit_txid: scan.txid,
        fund_txid: scan.txid,
        funded_at: now,
        paid_at: now,
        confirmations: scan.confirmations ?? 1,
      })
      .eq("id", id)
      .eq("status", "PENDING_PAYMENT");

    if (!updateError) {
      return NextResponse.json({
        success: true,
        verified: true,
        status: "HELD_IN_ESCROW",
        txid: scan.txid,
        confirmations: scan.confirmations ?? 1,
        network,
      });
    }
  }

  return NextResponse.json(
    {
      success: true,
      verified: false,
      status: order.status,
      listening: true,
      network,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing order ID." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { txid?: string } | null;
  const rawTxid = body?.txid?.trim();

  if (!rawTxid || !isValidZcashTxid(rawTxid)) {
    return NextResponse.json(
      { success: false, error: "Please enter a valid 64-character hexadecimal Zcash transaction hash." },
      { status: 400 }
    );
  }

  const txid = rawTxid.toLowerCase();
  const admin = getSupabaseAdmin();

  // 1. Fetch current order
  const { data: order, error: fetchError } = await admin
    .from("escrow_orders")
    .select("id, status, amount, delivery_fee, escrow_vault_address, deposit_txid, fund_txid")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !order) {
    return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
  }

  // If already paid with this exact txid, return success idempotently
  if (
    order.status === "HELD_IN_ESCROW" ||
    order.status === "DISPATCHED" ||
    order.status === "FUNDS_RELEASED"
  ) {
    if (order.deposit_txid === txid || order.fund_txid === txid) {
      return NextResponse.json({
        success: true,
        verified: true,
        status: order.status,
        txid,
      });
    }
    return NextResponse.json(
      { success: false, error: "This order is already funded with a different transaction hash." },
      { status: 409 }
    );
  }

  // 2. Anti-Replay Guard: check if this txid was already used by any other order
  const { data: existingUsage } = await admin
    .from("escrow_orders")
    .select("id")
    .or(`deposit_txid.eq.${txid},fund_txid.eq.${txid}`)
    .neq("id", id)
    .limit(1);

  if (existingUsage && existingUsage.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: "This transaction hash has already been used for another escrow deposit (replay attack prevented).",
      },
      { status: 409 }
    );
  }

  // 3. Network Detection & On-Chain Verification
  const network = detectNetworkFromVaultAddress(order.escrow_vault_address);
  const verifyResult = await verifyOnChainTx(txid, network);

  if (!verifyResult.verified) {
    return NextResponse.json(
      {
        success: false,
        error: verifyResult.error || "Unable to verify this transaction hash on the Zcash network.",
      },
      { status: 400 }
    );
  }

  // 4. Atomically transition to HELD_IN_ESCROW
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("escrow_orders")
    .update({
      status: "HELD_IN_ESCROW",
      deposit_txid: txid,
      fund_txid: txid,
      funded_at: now,
      paid_at: now,
      confirmations: verifyResult.confirmations ?? 0,
    })
    .eq("id", id)
    .eq("status", "PENDING_PAYMENT")
    .select("id, status, deposit_txid")
    .maybeSingle();

  if (updateError || !updated) {
    console.error("[verify-payment] update error:", updateError);
    return NextResponse.json(
      { success: false, error: "Failed to record verified on-chain deposit in escrow." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    verified: true,
    status: "HELD_IN_ESCROW",
    txid,
    confirmations: verifyResult.confirmations ?? 0,
    network,
  });
}
