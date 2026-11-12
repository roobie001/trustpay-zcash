import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in .env.local"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Shielded escrow state is verified by the backend against lightwalletd. The
// browser only stores the transaction ids and public order metadata.
export type EscrowOrder = {
  id: string;
  item_title: string;
  amount: number; // ZEC
  delivery_fee: number; // ZEC
  seller_name: string;
  seller_phone: string;
  vendor_address: string;
  escrow_vault_address: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  fund_txid: string | null;
  release_txid: string | null;
  status: "PENDING_PAYMENT" | "HELD_IN_ESCROW" | "DISPATCHED" | "FUNDS_RELEASED" | "DISPUTED";
  created_at: string;
};
