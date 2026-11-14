import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (process.env.ZCASH_DEMO_MODE !== "true") {
    return NextResponse.json(
      { success: false, error: "Demo deposit verification is disabled." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null) as {
    orderId?: unknown;
    txid?: unknown;
    simulation?: unknown;
  } | null;

  const isSimulation = body?.simulation === true && typeof body?.txid === "string" && /^txid_sim_\d+$/.test(body.txid);
  if (
    typeof body?.orderId !== "string" ||
    !body.orderId.trim() ||
    typeof body?.txid !== "string" ||
    (!/^[a-f0-9]{64}$/i.test(body.txid) && !isSimulation)
  ) {
    return NextResponse.json(
      { success: false, error: "orderId and a valid 64-character transaction ID are required." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const orderId = body.orderId.trim();
  const txid = isSimulation ? body.txid : body.txid.toLowerCase();
  const { data: updatedOrder, error: updateError } = await admin
    .from("escrow_orders")
    .update({
      status: "HELD_IN_ESCROW",
      fund_txid: txid,
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "PENDING_PAYMENT")
    .select("id, status, fund_txid")
    .maybeSingle();

  if (updateError) {
    console.error("[relayer] manual deposit verification failed:", updateError);
    return NextResponse.json(
      { success: false, error: "Failed to record the verified payment." },
      { status: 500 }
    );
  }

  if (!updatedOrder) {
    const { data: existingOrder } = await admin
      .from("escrow_orders")
      .select("status, fund_txid")
      .eq("id", orderId)
      .maybeSingle();
    if (existingOrder?.status === "HELD_IN_ESCROW" && existingOrder.fund_txid === txid) {
      return NextResponse.json({ success: true, verified: true, txid });
    }
    return NextResponse.json(
      { success: false, error: "Order is not awaiting payment or was not found." },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { success: true, verified: true, txid },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
