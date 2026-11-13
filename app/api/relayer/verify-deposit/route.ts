import { NextRequest, NextResponse } from "next/server";
import { isTestnetZcashAddress } from "@/lib/zcash";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (process.env.ZCASH_DEMO_MODE !== "true") {
    return NextResponse.json(
      { success: false, error: "Demo deposit verification is disabled." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null) as {
    txid?: unknown;
    address?: unknown;
    buyerAddress?: unknown;
    amount?: unknown;
  } | null;
  const address = typeof body?.address === "string"
    ? body.address
    : body?.buyerAddress;
  const amount = typeof body?.amount === "number" ? body.amount : NaN;

  if (
    typeof body?.txid !== "string" ||
    !body.txid.trim() ||
    typeof address !== "string" ||
    !isTestnetZcashAddress(address) ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return NextResponse.json(
      { success: false, error: "txid, a valid utest1 testnet address, and a positive amount are required." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    verified: true,
    txid: "mock_demo_txid_verified",
    confirmed: true,
  });
}
