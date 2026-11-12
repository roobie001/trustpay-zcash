import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ success: false, error: "orderId is required." }, { status: 400 });
  const baseUrl = request.nextUrl.origin;
  const response = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderId)}/status`, {
    headers: { cookie: request.headers.get("cookie") ?? "" },
    cache: "no-store",
  });
  return new NextResponse(response.body, { status: response.status, headers: response.headers });
}
