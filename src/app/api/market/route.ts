import { NextResponse } from "next/server";

import { getBtcKesMarketState } from "@/lib/market-state";

export const dynamic = "force-dynamic";

/** Read-only normalized market state; this route has no transaction capability. */
export async function GET() {
  const state = await getBtcKesMarketState();
  const status = state.status === "available" ? 200 : state.status === "invalid_response" ? 502 : 503;
  return NextResponse.json(state, { status });
}
