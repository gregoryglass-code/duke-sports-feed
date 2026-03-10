import { NextResponse } from "next/server";
import { aggregateFeeds } from "@/lib/aggregator";

export const revalidate = 300; // cache for 5 minutes

export async function GET() {
  const data = await aggregateFeeds();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
