import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// Checks `key` query param (order dashboard secret) or `token` query param (seller profile token).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const key = request.nextUrl.searchParams.get("key");
  const token = request.nextUrl.searchParams.get("token");

  if (!key && !token) {
    return NextResponse.json({ isSeller: false });
  }

  try {
    const admin = getSupabaseAdmin();

    // Check order-specific seller key
    if (key) {
      const { data: secret } = await admin
        .from("escrow_order_secrets")
        .select("seller_secret_key")
        .eq("order_id", id)
        .maybeSingle();

      if (secret && safeEqual(key, secret.seller_secret_key)) {
        return NextResponse.json({ isSeller: true, method: "key" });
      }
    }

    // Check persistent seller profile token
    if (token) {
      const { data: order } = await admin
        .from("escrow_orders")
        .select("seller_id")
        .eq("id", id)
        .maybeSingle();

      if (order?.seller_id) {
        const { data: seller } = await admin
          .from("sellers")
          .select("seller_secret_token")
          .eq("id", order.seller_id)
          .maybeSingle();

        if (seller && safeEqual(token, seller.seller_secret_token)) {
          return NextResponse.json({ isSeller: true, method: "token" });
        }
      }
    }

    return NextResponse.json({ isSeller: false });
  } catch (error) {
    console.error("[verify-seller] server error:", error);
    return NextResponse.json({ isSeller: false }, { status: 500 });
  }
}
