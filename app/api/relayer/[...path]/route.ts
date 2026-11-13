import { NextRequest, NextResponse } from "next/server";
import { isZcashAddress } from "@/lib/zcash";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const operation = path.join("/");
  if (!["testnet/fund", "payout"].includes(operation)) {
    return NextResponse.json(
      { success: false, error: "Unsupported relayer operation." },
      { status: 404 },
    );
  }

  if (process.env.ZCASH_DEMO_MODE === "true") {
    const body = await request.json().catch(() => null) as {
      amount?: unknown;
      recipient?: unknown;
      vendorAddress?: unknown;
    } | null;
    const address = operation === "payout" ? body?.vendorAddress : body?.recipient;
    if (
      typeof address !== "string" ||
      !isZcashAddress(address) ||
      typeof body?.amount !== "number" ||
      !Number.isFinite(body.amount) ||
      body.amount <= 0
    ) {
      return NextResponse.json(
        { success: false, error: "A valid shielded address and positive amount are required." },
        { status: 400 },
      );
    }
    return NextResponse.json({
      success: true,
      txid: operation === "payout"
        ? "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        : "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
  }

  const relayerUrl = process.env.ZCASH_RELAYER_URL?.trim();
  if (!relayerUrl || relayerUrl.includes("/api/relayer")) {
    return NextResponse.json(
      { success: false, error: "A real external Zcash relayer is not configured." },
      { status: 503 },
    );
  }
  const response = await fetch(
    `${relayerUrl.replace(/\/$/, "")}/${operation}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
      cache: "no-store",
    },
  );
  const responseBody = await response.text();
  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  });
}
