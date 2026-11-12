import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("escrow_orders")
    .select("id, status, vendor_address, amount, delivery_fee")
    .eq("id", id)
    .maybeSingle();
  if (error || !order) return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
  if (order.status !== "DISPATCHED") {
    return NextResponse.json({ success: false, error: "Only dispatched orders can be released." }, { status: 409 });
  }

  const relayerUrl = process.env.ZCASH_RELAYER_URL;
  if (!relayerUrl) {
    return NextResponse.json({ success: false, error: "Zcash relayer is not configured." }, { status: 503 });
  }
  const payout = await fetch(`${relayerUrl.replace(/\/$/, "")}/payout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderId: id,
      vendorAddress: order.vendor_address,
      amount: Number(order.amount) + Number(order.delivery_fee),
    }),
  });
  if (!payout.ok) return NextResponse.json({ success: false, error: "The shielded payout was not accepted." }, { status: 502 });
  const result = await payout.json() as { txid?: string };
  if (!result.txid || !/^[a-f0-9]{64}$/i.test(result.txid)) {
    return NextResponse.json({ success: false, error: "Relayer returned an invalid payout transaction id." }, { status: 502 });
  }
  const { error: updateError } = await admin
    .from("escrow_orders")
    .update({ status: "FUNDS_RELEASED", release_txid: result.txid })
    .eq("id", id);
  if (updateError) return NextResponse.json({ success: false, error: "Failed to record the payout." }, { status: 500 });
  return NextResponse.json({ success: true, txid: result.txid });
}
