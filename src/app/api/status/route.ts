import { NextResponse } from "next/server";

import { getProjectStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getProjectStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
