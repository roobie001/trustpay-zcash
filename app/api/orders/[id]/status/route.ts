import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const allowed = new Set(["DISPATCHED", "DISPUTED"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await getSupabaseAdmin()
    .from("escrow_orders")
    .select("id, status, fund_txid, release_txid")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true, ...data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.status !== "string" || !allowed.has(body.status)) {
    return NextResponse.json({ success: false, error: "Invalid order status." }, { status: 400 });
  }
  const { error } = await getSupabaseAdmin()
    .from("escrow_orders")
    .update({ status: body.status })
    .eq("id", id);
  if (error) return NextResponse.json({ success: false, error: "Failed to update order status." }, { status: 500 });
  return NextResponse.json({ success: true });
}
