import { aggregateFeeds } from "@/lib/aggregator";

export const revalidate = 300;

export async function GET() {
  const { items } = await aggregateFeeds();

  const rssItems = items
    .slice(0, 50)
    .map(
      (item) => `    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <description><![CDATA[${item.snippet}]]></description>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
      <source>${item.source}</source>
      <category>${item.category}</category>
    </item>`
    )
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Duke Sports News Aggregator</title>
    <description>All Duke Blue Devils sports news from across the internet</description>
    <link>https://duke-sports-feed.vercel.app</link>
    <atom:link href="https://duke-sports-feed.vercel.app/api/rss" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
