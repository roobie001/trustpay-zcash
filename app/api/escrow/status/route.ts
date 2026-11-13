import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ success: false, error: "orderId is required." }, { status: 400 });
  const baseUrl = request.nextUrl.origin;
  const response = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderId)}/status`, {
    headers: { cookie: request.headers.get("cookie") ?? "" },
    cache: "no-store",
  });
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return new NextResponse(response.body, { status: response.status, headers });
}
