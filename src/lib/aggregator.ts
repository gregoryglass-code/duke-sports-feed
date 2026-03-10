import Parser from "rss-parser";
import { FEED_SOURCES, DUKE_KEYWORDS, type FeedSource } from "./feeds";

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  category: FeedSource["category"];
  snippet: string;
  imageUrl: string | null;
}

type CustomItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
  enclosure?: { url?: string; type?: string };
  "media:content"?: { $?: { url?: string } };
  "media:thumbnail"?: { $?: { url?: string } };
};

const parser = new Parser<Record<string, unknown>, CustomItem>({
  timeout: 8000,
  headers: {
    "User-Agent": "DukeSportsFeed/1.0",
    Accept: "application/rss+xml, application/xml, text/xml",
  },
  customFields: {
    item: [
      ["media:content", "media:content"],
      ["media:thumbnail", "media:thumbnail"],
    ],
  },
});

function isDukeRelated(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  return DUKE_KEYWORDS.some((keyword) => text.includes(keyword));
}

function extractSnippet(content: string, maxLen = 200): string {
  const clean = content
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) + "..." : clean;
}

function extractImageFromRss(item: CustomItem, content: string): string | null {
  // 1. enclosure with image type
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image")) {
    return item.enclosure.url;
  }
  // 2. media:content
  const mediaContent = item["media:content"];
  if (mediaContent && typeof mediaContent === "object") {
    const url = (mediaContent as { $?: { url?: string } }).$?.url;
    if (url) return url;
  }
  // 3. media:thumbnail
  const mediaThumbnail = item["media:thumbnail"];
  if (mediaThumbnail && typeof mediaThumbnail === "object") {
    const url = (mediaThumbnail as { $?: { url?: string } }).$?.url;
    if (url) return url;
  }
  // 4. First <img> in content
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) return imgMatch[1];
  // 5. enclosure without type check (some feeds don't set type)
  if (item.enclosure?.url) return item.enclosure.url;

  return null;
}

async function fetchFeed(source: FeedSource): Promise<FeedItem[]> {
  try {
    const feed = await parser.parseURL(source.url);
    const items: FeedItem[] = [];

    for (const item of feed.items ?? []) {
      const title = item.title ?? "";
      const content = item.contentSnippet ?? item.content ?? "";

      if (source.dukeSpecific || isDukeRelated(title, content)) {
        items.push({
          title,
          link: item.link ?? "",
          pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
          source: source.name,
          category: source.category,
          snippet: extractSnippet(content),
          imageUrl: extractImageFromRss(item, item.content ?? ""),
        });
      }
    }
    return items;
  } catch (err) {
    console.error(`Failed to fetch ${source.name}: ${err}`);
    return [];
  }
}

export async function aggregateFeeds(): Promise<{
  items: FeedItem[];
  sources: { name: string; status: "ok" | "error"; count: number }[];
  lastUpdated: string;
}> {
  const results = await Promise.allSettled(
    FEED_SOURCES.map(async (source) => {
      const items = await fetchFeed(source);
      return { source, items };
    })
  );

  const allItems: FeedItem[] = [];
  const sources: { name: string; status: "ok" | "error"; count: number }[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value.items);
      sources.push({
        name: result.value.source.name,
        status: result.value.items.length >= 0 ? "ok" : "error",
        count: result.value.items.length,
      });
    } else {
      sources.push({ name: "Unknown", status: "error", count: 0 });
    }
  }

  // Deduplicate by title similarity
  const seen = new Set<string>();
  const unique = allItems.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort newest first
  unique.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  return {
    items: unique,
    sources,
    lastUpdated: new Date().toISOString(),
  };
}
