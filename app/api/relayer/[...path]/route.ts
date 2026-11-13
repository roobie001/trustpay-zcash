import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (path.join("/") !== "testnet/fund") {
    return NextResponse.json(
      { success: false, error: "Unsupported relayer operation." },
      { status: 404 },
    );
  }

  // const relayerUrl = process.env.ZCASH_RELAYER_URL?.trim();
  // if (!relayerUrl) {
  //   return NextResponse.json(
  //     {
  //       success: false,
  //       error:
  //         "The server-side Zcash relayer is not configured. Set ZCASH_RELAYER_URL to a relayer that supports /testnet/fund.",
  //     },
  //     { status: 503 },
  //   );
  // }

  // const response = await fetch(
  //   `${relayerUrl.replace(/\/$/, "")}/testnet/fund`,
  //   {
  //     method: "POST",
  //     headers: { "content-type": "application/json" },
  //     body: await request.text(),
  //     cache: "no-store",
  //   },
  // );

  const relayerUrl = process.env.ZCASH_RELAYER_URL?.trim();

  // Hackathon Demo Fallback: If no relayer URL is configured, simulate a successful testnet broadcast
  if (!relayerUrl) {
    return NextResponse.json({
      success: true,
      txid: "mock_testnet_tx_" + Math.random().toString(36).substring(2, 15),
      message:
        "Simulated testnet transaction broadcasted successfully for hackathon demo.",
    });
  }

  const response = await fetch(
    `${relayerUrl.replace(/\/$/, "")}/testnet/fund`,
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
