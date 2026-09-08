import { NextResponse } from "next/server";

import { getFoundationStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getFoundationStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
