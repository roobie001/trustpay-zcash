import type { Metadata } from "next";
import Link from "next/link";
import { Home, PackageSearch, RefreshCw } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { supabase, type EscrowOrder } from "@/lib/supabase";
import { PageShell } from "@/components/page-shell";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/ui";
import { PayClient } from "./pay-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getOrder(id: string): Promise<EscrowOrder | null> {
  if (!id || typeof id !== "string") return null;
  const cleanId = id.trim();

  // Validate UUID format to prevent database syntax errors or crashes
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
  if (!isUuid) return null;

  try {
    let client: SupabaseClient;
    try {
      client = getSupabaseAdmin();
    } catch {
      client = supabase;
    }

    const { data, error } = await client
      .from("escrow_orders")
      .select("*")
      .eq("id", cleanId)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.warn("[PayPage:Server] Supabase query error:", error.message);
      }
      return null;
    }

    return data as EscrowOrder;
  } catch (err) {
    console.error("[PayPage:Server] Failed to fetch order:", err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const order = await getOrder(id);
    if (order) {
      return {
        title: `Pay for ${order.item_title} | TrustPay Zcash Escrow`,
        description: `Secure shielded payment for ${order.item_title} (${order.amount} ZEC). Sold by ${order.seller_name} via TrustPay.`,
      };
    }
  } catch {
    // Fallback to default
  }
  return {
    title: "Protected Escrow Checkout | TrustPay",
    description: "Private shielded Zcash P2P escrow payment checkout on TrustPay.",
  };
}

export default async function PayPage({ params }: PageProps) {
  let id = "";
  try {
    const resolved = await params;
    id = resolved?.id ?? "";
  } catch (err) {
    console.warn("[PayPage:Server] Error resolving params:", err);
    id = "";
  }

  let order: EscrowOrder | null = null;
  try {
    order = await getOrder(id);
  } catch (err) {
    console.error("[PayPage:Server] Unhandled getOrder error:", err);
    order = null;
  }

  if (!order) {
    return (
      <PageShell role="buyer">
        <div className="mx-auto max-w-md text-center py-12 px-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-[#0F172A] text-slate-400">
            <PackageSearch className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Escrow Order Not Found or Unavailable
          </h2>
          <p className="mt-2.5 text-xs sm:text-sm text-slate-400 leading-relaxed">
            This payment link may have expired, contains an invalid reference, or the escrow was already fulfilled.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`/pay/${encodeURIComponent(id)}`}
              className={`${primaryButtonClass} w-full sm:w-auto px-6 py-3 text-xs`}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry</span>
            </a>
            <Link
              href="/"
              className={`${secondaryButtonClass} w-full sm:w-auto px-6 py-3 text-xs`}
            >
              <Home className="h-4 w-4" />
              <span>TrustPay Home</span>
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return <PayClient initialOrder={order} />;
}
