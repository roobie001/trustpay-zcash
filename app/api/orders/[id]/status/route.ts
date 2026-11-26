import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { mergeOrderMetadata, parseOrderMetadata, type DisputeMessage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const transitions: Record<string, Set<string>> = {
  PENDING_PAYMENT: new Set(["DISPUTED"]),
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
    .select("id, status, fund_txid, release_txid, delivery_notes")
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
  const body = (await request.json().catch(() => null)) as {
    status?: string;
    key?: string;
    rider_phone?: string;
    waybill_notes?: string;
    dispute_category?: string;
    message?: string;
    photoUrl?: string;
    sender?: "buyer" | "seller";
  } | null;

  if (!body || typeof body.status !== "string" || !allowed.has(body.status)) {
    return NextResponse.json({ success: false, error: "Invalid order status." }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { data: order, error: readError } = await admin
    .from("escrow_orders")
    .select("status, delivery_notes")
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

  const patch: Record<string, unknown> = {};

  if (body.status === "DISPATCHED") {
    // 1. Mandatory seller authorization
    const { data: secret } = await admin
      .from("escrow_order_secrets")
      .select("seller_secret_key")
      .eq("order_id", id)
      .maybeSingle();
    if (!secret || !matchesSecret(body.key, secret.seller_secret_key)) {
      return NextResponse.json({ success: false, error: "Seller authorization is required." }, { status: 403 });
    }

    // 2. Mandatory Dispatch Rider Phone Number
    if (!body.rider_phone || typeof body.rider_phone !== "string" || !body.rider_phone.trim()) {
      return NextResponse.json(
        { success: false, error: "Dispatch rider phone number is mandatory before marking order as dispatched." },
        { status: 400 }
      );
    }

    patch.rider_phone = body.rider_phone.trim();
    if (body.waybill_notes) patch.waybill_notes = body.waybill_notes.trim();
    patch.dispatched_at = new Date().toISOString();
  }

  if (body.status === "DISPUTED") {
    const category = body.dispute_category?.trim() || "Item not delivered";
    patch.dispute_category = category;

    if (body.message) {
      const { metadata } = parseOrderMetadata(order.delivery_notes);
      const thread = Array.isArray(metadata.dispute_thread) ? [...metadata.dispute_thread] : [];
      const newMsg: DisputeMessage = {
        id: `msg_${Date.now()}`,
        sender: body.sender === "seller" ? "seller" : "buyer",
        text: body.message.trim(),
        photoUrl: body.photoUrl,
        createdAt: new Date().toISOString(),
      };
      thread.push(newMsg);
      patch.dispute_thread = thread;
    }
  }

  const updatedDeliveryNotes = mergeOrderMetadata(order.delivery_notes, patch);

  const { error } = await admin
    .from("escrow_orders")
    .update({
      status: body.status,
      delivery_notes: updatedDeliveryNotes,
    })
    .eq("id", id)
    .eq("status", order.status);

  if (error) {
    console.error("[orders/status] update error:", error);
    return NextResponse.json({ success: false, error: "Failed to update order status." }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: body.status });
}
