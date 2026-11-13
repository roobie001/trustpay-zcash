import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const configuredRelayerUrl = process.env.ZCASH_RELAYER_URL?.trim();
    const relayerUrl = configuredRelayerUrl && !/localhost|127\.0\.0\.1/i.test(configuredRelayerUrl)
      ? configuredRelayerUrl
      : `${new URL(request.url).origin}/api/relayer`;
    const payout = await fetch(`${relayerUrl.replace(/\/$/, "")}/payout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: id,
        vendorAddress: order.vendor_address,
        amount: Number(order.amount) + Number(order.delivery_fee),
      }),
    });
    const payoutText = await payout.text();
    let result: { txid?: string; error?: string } = {};
    try {
      result = JSON.parse(payoutText) as { txid?: string; error?: string };
    } catch {
      return NextResponse.json({ success: false, error: `Relayer returned an invalid response (${payout.status}).` }, { status: 502 });
    }
    if (!payout.ok) {
      return NextResponse.json({ success: false, error: result.error ?? "The shielded payout was not accepted." }, { status: 502 });
    }
    if (!result.txid || !/^[a-f0-9]{64}$/i.test(result.txid)) {
      return NextResponse.json({ success: false, error: "Relayer returned an invalid payout transaction id." }, { status: 502 });
    }
    const { error: updateError } = await admin
      .from("escrow_orders")
      .update({ status: "FUNDS_RELEASED", release_txid: result.txid })
      .eq("id", id)
      .eq("status", "DISPATCHED");
    if (updateError) return NextResponse.json({ success: false, error: "Failed to record the payout." }, { status: 500 });
    return NextResponse.json({ success: true, message: "Funds released successfully.", txid: result.txid });
  } catch (error) {
    console.error("[orders/release] unexpected error:", error);
    return NextResponse.json({ success: false, error: "Unable to release funds right now." }, { status: 500 });
  }
}
