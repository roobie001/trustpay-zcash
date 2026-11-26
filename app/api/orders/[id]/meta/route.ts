import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { mergeOrderMetadata, parseOrderMetadata, type OrderMetadata, type DisputeMessage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MetaRequestBody {
  patch?: Partial<OrderMetadata>;
  disputeMessage?: DisputeMessage;
  payout_status?: "PROCESSING" | "SETTLED" | "FAILED";
  settled_at?: string;
  payout_error?: string;
  doorstep_address?: string;
  landmark?: string;
  rider_phone?: string;
  waybill_notes?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: MetaRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: order, error: readError } = await admin
    .from("escrow_orders")
    .select("id, delivery_notes, buyer_address")
    .eq("id", id)
    .maybeSingle();

  if (readError || !order) {
    return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
  }

  const { metadata } = parseOrderMetadata(order.delivery_notes);

  const patch: Partial<OrderMetadata> = { ...(body.patch || {}) };

  if (body.payout_status) patch.payout_status = body.payout_status;
  if (body.settled_at) patch.settled_at = body.settled_at;
  if (body.payout_error !== undefined) patch.payout_error = body.payout_error;
  if (body.doorstep_address) patch.doorstep_address = body.doorstep_address;
  if (body.landmark) patch.landmark = body.landmark;
  if (body.rider_phone) patch.rider_phone = body.rider_phone;
  if (body.waybill_notes) patch.waybill_notes = body.waybill_notes;

  if (body.disputeMessage) {
    const thread = Array.isArray(metadata.dispute_thread) ? [...metadata.dispute_thread] : [];
    thread.push(body.disputeMessage);
    patch.dispute_thread = thread;
  }

  const updatedDeliveryNotes = mergeOrderMetadata(order.delivery_notes, patch);

  const updatePayload: Record<string, unknown> = {
    delivery_notes: updatedDeliveryNotes,
  };

  // If doorstep address is provided and buyer_address is empty or needs updating, update buyer_address safely too
  if (patch.doorstep_address) {
    const formattedAddress = patch.landmark
      ? `${patch.doorstep_address} (Near: ${patch.landmark})`
      : patch.doorstep_address;
    if (!order.buyer_address || order.buyer_address.trim() === "") {
      updatePayload.buyer_address = formattedAddress;
    }
  }

  const { error: updateError } = await admin
    .from("escrow_orders")
    .update(updatePayload)
    .eq("id", id);

  if (updateError) {
    console.error("[meta] update failed:", updateError);
    return NextResponse.json({ success: false, error: "Failed to persist order metadata." }, { status: 500 });
  }

  const { metadata: finalMeta } = parseOrderMetadata(updatedDeliveryNotes);
  return NextResponse.json({ success: true, metadata: finalMeta });
}
