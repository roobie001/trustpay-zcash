import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const transitions: Record<string, Set<string>> = {
  HELD_IN_ESCROW: new Set(["DISPATCHED", "DISPUTED"]),
  DISPATCHED: new Set(["DISPUTED"]),
};
const allowed = new Set(["DISPATCHED", "DISPUTED"]);

function matchesSecret(value: unknown, expected: string): boolean {
  if (typeof value !== "string") return false;
  const actual = Buffer.from(value, "utf8");
  const target = Buffer.from(expected, "utf8");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

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
  return NextResponse.json({ success: true, ...data }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
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
  const admin = getSupabaseAdmin();
  const { data: order, error: readError } = await admin
    .from("escrow_orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (readError || !order) {
    return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
  }
  if (!transitions[order.status]?.has(body.status)) {
    return NextResponse.json(
      { success: false, error: `Cannot move an order from ${order.status} to ${body.status}.` },
      { status: 409 }
    );
  }
  if (body.status === "DISPATCHED") {
    const { data: secret } = await admin
      .from("escrow_order_secrets")
      .select("seller_secret_key")
      .eq("order_id", id)
      .maybeSingle();
    if (!secret || !matchesSecret(body.key, secret.seller_secret_key)) {
      return NextResponse.json({ success: false, error: "Seller authorization is required." }, { status: 403 });
    }
  }
  const { error } = await admin
    .from("escrow_orders")
    .update({ status: body.status })
    .eq("id", id)
    .eq("status", order.status);
  if (error) return NextResponse.json({ success: false, error: "Failed to update order status." }, { status: 500 });
  return NextResponse.json({ success: true });
}
