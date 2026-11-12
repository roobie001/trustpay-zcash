import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isZcashAddress } from "@/lib/zcash";

type SellerBody = {
  seller_secret_token?: string;
  store_name?: string;
  social_handle?: string;
  payout_address?: string;
};

function isToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!isToken(token)) {
    return NextResponse.json({ success: false, error: "A valid seller token is required." }, { status: 400 });
  }
  const { data, error } = await getSupabaseAdmin()
    .from("sellers")
    .select("id, seller_secret_token, store_name, social_handle, payout_address, created_at, updated_at")
    .eq("seller_secret_token", token)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ success: false, error: "Seller profile not found." }, { status: 404 });
  return NextResponse.json({ success: true, seller: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as SellerBody | null;
  if (!body || typeof body.store_name !== "string" || !body.store_name.trim() ||
      typeof body.payout_address !== "string" || !body.payout_address.trim()) {
    return NextResponse.json({ success: false, error: "Store name and payout address are required." }, { status: 400 });
  }
  const payoutAddress = body.payout_address.trim();
  if (payoutAddress.startsWith("t1") || payoutAddress.startsWith("t3")) {
    return NextResponse.json({ success: false, error: "Transparent Zcash addresses are not supported. Use a shielded Unified or Sapling address." }, { status: 400 });
  }
  if (!isZcashAddress(payoutAddress)) {
    return NextResponse.json({ success: false, error: "Use a valid shielded Zcash Unified (u1...) or Sapling (zs1...) address." }, { status: 400 });
  }
  const token = isToken(body.seller_secret_token) ? body.seller_secret_token : randomBytes(32).toString("hex");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("sellers").upsert({
    seller_secret_token: token,
    store_name: body.store_name.trim(),
    social_handle: body.social_handle?.trim() || null,
    payout_address: payoutAddress,
    updated_at: new Date().toISOString(),
  }, { onConflict: "seller_secret_token" })
    .select("id, seller_secret_token, store_name, social_handle, payout_address, created_at, updated_at")
    .single();
  if (error || !data) {
    console.error("[seller] profile save failed:", error);
    return NextResponse.json({ success: false, error: "Failed to save seller profile." }, { status: 500 });
  }
  return NextResponse.json({ success: true, seller: data });
}
