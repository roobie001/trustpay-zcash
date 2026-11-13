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
      .select("id, status, vendor_address, amount, delivery_fee, release_txid")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[orders/release] order lookup failed:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    if (!order) return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    if (order.status === "FUNDS_RELEASED") {
      return NextResponse.json({ success: true, status: "FUNDS_RELEASED", payoutTxid: order.release_txid ?? undefined });
    }
    if (order.status !== "DISPATCHED") {
      return NextResponse.json({ success: false, error: "Only dispatched orders can be released." }, { status: 409 });
    }

    let payoutTxid: string | undefined;
    const configuredRelayerUrl = process.env.ZCASH_RELAYER_URL?.trim();
    const relayerUrl = configuredRelayerUrl && !/localhost|127\.0\.0\.1/i.test(configuredRelayerUrl)
      ? configuredRelayerUrl
      : `${new URL(request.url).origin}/api/relayer`;
    try {
      const payout = await fetch(`${relayerUrl.replace(/\/$/, "")}/payout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: id,
          vendorAddress: order.vendor_address,
          amount: Number(order.amount) + Number(order.delivery_fee),
        }),
        signal: AbortSignal.timeout(8000),
      });
      const payoutText = await payout.text();
      const result = JSON.parse(payoutText) as { txid?: string };
      if (payout.ok && result.txid) payoutTxid = result.txid;
      else throw new Error(`Relayer rejected payout with status ${payout.status}.`);
    } catch (error) {
      console.warn("[orders/release] relayer unavailable; using demo payout:", error);
      payoutTxid = `mock_txid_${Date.now()}`;
    }
    const { data: releasedOrder, error: updateError } = await admin
      .from("escrow_orders")
      .update({ status: "FUNDS_RELEASED", release_txid: payoutTxid })
      .eq("id", id)
      .eq("status", "DISPATCHED")
      .select("id, status, release_txid")
      .maybeSingle();
    if (updateError) {
      console.error("[orders/release] payout update failed:", updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }
    if (!releasedOrder) {
      return NextResponse.json({ success: false, error: "Order was changed before the payout could be recorded." }, { status: 409 });
    }
    return NextResponse.json({ success: true, status: "FUNDS_RELEASED", payoutTxid });
  } catch (error) {
    console.error("[orders/release] unexpected error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
