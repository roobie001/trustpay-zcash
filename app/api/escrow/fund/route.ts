import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    orderId?: string;
    txid?: string;
    buyerAddress?: string;
  } | null;
  if (!body?.orderId) {
    return NextResponse.json({ success: false, error: "orderId is required." }, { status: 400 });
  }

  const response = await fetch(
    `${request.nextUrl.origin}/api/orders/${encodeURIComponent(body.orderId)}/fund`,
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "" },
      body: JSON.stringify({
        txid: body.txid,
        buyerAddress: body.buyerAddress,
      }),
      cache: "no-store",
    }
  );
  return new NextResponse(response.body, { status: response.status, headers: response.headers });
}
