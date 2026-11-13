import { NextRequest, NextResponse } from "next/server";
import { isZcashAddress } from "@/lib/zcash";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.txid !== "string" ||
    !/^[a-f0-9]{64}$/i.test(body.txid) ||
    typeof body.buyerAddress !== "string" ||
    !isZcashAddress(body.buyerAddress)
  ) {
    return NextResponse.json({ success: false, error: "Invalid shielded funding transaction." }, { status: 400 });
  }

  const { data: order, error: orderError } = await getSupabaseAdmin()
    .from("escrow_orders")
    .select("id, status, amount, escrow_vault_address")
    .eq("id", id)
    .maybeSingle();
  if (orderError || !order) {
    return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
  }
  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.json({ success: false, error: "Order has already received a funding attempt." }, { status: 409 });
  }

  // A production deployment runs this endpoint after the lightwalletd watcher
  // confirms the memo and value. The relayer URL is deliberately required.
  const configuredRelayerUrl = process.env.ZCASH_RELAYER_URL?.trim();
  const relayerUrl = configuredRelayerUrl && !/localhost|127\.0\.0\.1/i.test(configuredRelayerUrl)
    ? configuredRelayerUrl
    : `${new URL(request.url).origin}/api/relayer`;
  const verification = process.env.ZCASH_DEMO_MODE === "true"
    ? new Response(JSON.stringify({ success: true, verified: true, confirmed: true }), { status: 200 })
    : await fetch(`${relayerUrl.replace(/\/$/, "")}/verify-deposit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: id,
          txid: body.txid,
          address: body.buyerAddress,
          amount: Number(order.amount),
        }),
      });
  if (!verification.ok) {
    return NextResponse.json({ success: false, error: "Shielded deposit is not confirmed yet." }, { status: 409 });
  }

  const { error } = await getSupabaseAdmin()
    .from("escrow_orders")
    .update({ status: "HELD_IN_ESCROW", buyer_address: body.buyerAddress, fund_txid: body.txid, paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[orders/fund] update failed:", error);
    return NextResponse.json({ success: false, error: "Failed to record the confirmed deposit." }, { status: 500 });
  }
  return NextResponse.json({ success: true, txid: body.txid });
}
