import { NextResponse } from "next/server";
import { getStoryFeed } from "@/lib/story-pipeline";

export const revalidate = 600;

export async function GET() {
  const feed = await getStoryFeed();
  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
    },
  });
}
