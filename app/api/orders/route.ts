import { NextRequest, NextResponse } from "next/server";
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
  delivery_notes?: string;
  seller_id?: string;
  seller_secret_token?: string;
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
    delivery_notes,
    seller_id,
    seller_secret_token,
    seller_name,
    seller_phone = "",
    vendor_address,
    escrow_vault_address: requestedVaultAddress,
  } = body;
  const escrow_vault_address = typeof requestedVaultAddress === "string" && requestedVaultAddress.trim()
    ? requestedVaultAddress.trim()
    : process.env.NEXT_PUBLIC_ZCASH_ESCROW_VAULT_ADDRESS?.trim();

  if (
    typeof item_title !== "string" ||
    (seller_name !== undefined && typeof seller_name !== "string") ||
    (vendor_address !== undefined && typeof vendor_address !== "string") ||
    typeof escrow_vault_address !== "string" ||
    !item_title.trim() ||
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

  if ((vendor_address && !isZcashAddress(vendor_address)) || !isZcashAddress(escrow_vault_address)) {
    return NextResponse.json(
      { success: false, error: "vendor_address and escrow_vault_address must be valid shielded Zcash addresses." },
      { status: 400 }
    );
  }

  try {
    const admin = getSupabaseAdmin();
    if (typeof seller_secret_token !== "string" || !/^[a-f0-9]{64}$/i.test(seller_secret_token)) {
      return NextResponse.json({ success: false, error: "Save a seller profile before creating an order." }, { status: 400 });
    }
    const { data: seller } = await admin.from("sellers").select("id, store_name, payout_address")
      .eq("seller_secret_token", seller_secret_token).maybeSingle();
    if (!seller || (seller_id && seller.id !== seller_id)) {
      return NextResponse.json({ success: false, error: "Seller profile not found. Sync the profile and try again." }, { status: 403 });
    }
    const payoutAddress = typeof vendor_address === "string" && vendor_address.trim()
      ? vendor_address.trim()
      : seller.payout_address;
    if (!isZcashAddress(payoutAddress)) {
      return NextResponse.json({ success: false, error: "The payout address must be shielded Zcash." }, { status: 400 });
    }

    const { data: order, error: insertError } = await admin
      .from("escrow_orders")
      .insert({
        item_title: item_title.trim(),
        amount,
        delivery_fee,
        seller_name: seller_name?.trim() || seller.store_name,
        seller_phone: seller_phone.trim(),
        delivery_notes: delivery_notes?.trim() || null,
        seller_id: seller.id,
        vendor_address: payoutAddress,
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

    return NextResponse.json({ success: true, id: order.id, sellerKey: seller_secret_token });
  } catch (error) {
    console.error("[orders] server error:", error);
    return NextResponse.json(
      { success: false, error: "Server is not configured to create orders yet." },
      { status: 500 }
    );
  }
}
