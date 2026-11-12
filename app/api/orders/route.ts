import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { E164_PATTERN } from "@/lib/phone";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isZcashAddress } from "@/lib/zcash";

export const runtime = "nodejs";

function hasZecPrecision(value: number): boolean {
  return /^\d+(\.\d{1,8})?$/.test(String(value));
}

interface CreateOrderBody {
  item_title?: string;
  amount?: number;
  delivery_fee?: number;
  seller_name?: string;
  seller_phone?: string;
  vendor_address?: string;
  escrow_vault_address?: string;
}

export async function POST(request: NextRequest) {
  let body: CreateOrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    item_title,
    amount,
    delivery_fee = 0,
    seller_name,
    seller_phone,
    vendor_address,
    escrow_vault_address,
  } = body;

  if (
    typeof item_title !== "string" ||
    typeof seller_name !== "string" ||
    typeof seller_phone !== "string" ||
    typeof vendor_address !== "string" ||
    typeof escrow_vault_address !== "string" ||
    !item_title.trim() ||
    !seller_name.trim() ||
    !seller_phone.trim() ||
    !vendor_address.trim() ||
    !escrow_vault_address.trim()
  ) {
    return NextResponse.json(
      { success: false, error: "Missing required order fields." },
      { status: 400 }
    );
  }

  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !hasZecPrecision(amount)
  ) {
    return NextResponse.json(
      { success: false, error: "amount must be a positive ZEC amount with at most 8 decimals." },
      { status: 400 }
    );
  }

  if (
    typeof delivery_fee !== "number" ||
    !Number.isFinite(delivery_fee) ||
    delivery_fee < 0 ||
    !hasZecPrecision(delivery_fee)
  ) {
    return NextResponse.json(
      { success: false, error: "delivery_fee must be a non-negative ZEC amount with at most 8 decimals." },
      { status: 400 }
    );
  }

  if (!E164_PATTERN.test(seller_phone.trim())) {
    return NextResponse.json(
      { success: false, error: "seller_phone must be in E.164 format, e.g. +2348012345678." },
      { status: 400 }
    );
  }

  if (!isZcashAddress(vendor_address) || !isZcashAddress(escrow_vault_address)) {
    return NextResponse.json(
      { success: false, error: "vendor_address and escrow_vault_address must be valid shielded Zcash addresses." },
      { status: 400 }
    );
  }

  try {
    const admin = getSupabaseAdmin();

    const { data: order, error: insertError } = await admin
      .from("escrow_orders")
      .insert({
        item_title: item_title.trim(),
        amount,
        delivery_fee,
        seller_name: seller_name.trim(),
        seller_phone: seller_phone.trim(),
        vendor_address: vendor_address.trim(),
        escrow_vault_address: escrow_vault_address.trim(),
      })
      .select("id")
      .single();

    if (insertError || !order) {
      return NextResponse.json(
        { success: false, error: insertError?.message ?? "Failed to create order." },
        { status: 500 }
      );
    }

    const sellerSecretKey = randomUUID();

    const { error: secretError } = await admin
      .from("escrow_order_secrets")
      .insert({ order_id: order.id, seller_secret_key: sellerSecretKey });

    if (secretError) {
      // Don't leave an order behind that the seller can never manage.
      await admin.from("escrow_orders").delete().eq("id", order.id);
      return NextResponse.json(
        { success: false, error: "Failed to secure the new order. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: order.id, sellerKey: sellerSecretKey });
  } catch (error) {
    console.error("[orders] server error:", error);
    return NextResponse.json(
      { success: false, error: "Server is not configured to create orders yet." },
      { status: 500 }
    );
  }
}
