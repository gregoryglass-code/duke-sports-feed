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
  fullText?: string;
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
  "News:Source"?: string;
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
      ["News:Source", "News:Source"],
    ],
  },
});

function isDukeRelated(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  return DUKE_KEYWORDS.some((keyword) => text.includes(keyword));
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013");
}

function extractSnippet(content: string, maxLen = 200): string {
  const clean = decodeHtmlEntities(
    content
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
  return clean.length > maxLen ? clean.slice(0, maxLen) + "..." : clean;
}

function extractImageFromRss(item: CustomItem, content: string): string | null {
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image")) {
    return item.enclosure.url;
  }
  const mediaContent = item["media:content"];
  if (mediaContent && typeof mediaContent === "object") {
    const url = (mediaContent as { $?: { url?: string } }).$?.url;
    if (url) return url;
  }
  const mediaThumbnail = item["media:thumbnail"];
  if (mediaThumbnail && typeof mediaThumbnail === "object") {
    const url = (mediaThumbnail as { $?: { url?: string } }).$?.url;
    if (url) return url;
  }
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) return imgMatch[1];
  if (item.enclosure?.url) return item.enclosure.url;
  return null;
}

/**
 * Extract the real article URL from a Bing News redirect link.
 * Bing links look like: http://www.bing.com/news/apiclick.aspx?...&url=https%3a%2f%2fwww.espn.com%2f...
 */
function extractBingUrl(link: string): string {
  try {
    const url = new URL(link);
    const realUrl = url.searchParams.get("url");
    return realUrl || link;
  } catch {
    return link;
  }
}

/**
 * Extract the publisher name from a Bing News item title.
 * Bing appends " - Source Name" to titles; Bing also provides News:Source field.
 */
function extractBingSource(item: CustomItem): string {
  // Bing News provides a News:Source field
  if (item["News:Source"]) return item["News:Source"];

  // Fallback: extract from title suffix " - Publisher"
  const title = item.title ?? "";
  const dashIdx = title.lastIndexOf(" - ");
  if (dashIdx > 0 && dashIdx > title.length - 60) {
    return title.substring(dashIdx + 3).trim();
  }
  return "Unknown";
}

/**
 * Clean Bing News titles that append " - Source Name" at the end.
 */
function cleanBingTitle(title: string): string {
  const dashIdx = title.lastIndexOf(" - ");
  if (dashIdx > 0 && dashIdx > title.length - 60) {
    return title.substring(0, dashIdx).trim();
  }
  return title;
}

async function fetchFeed(source: FeedSource): Promise<FeedItem[]> {
  try {
    const feed = await parser.parseURL(source.url);
    const items: FeedItem[] = [];

    for (const item of feed.items ?? []) {
      let title = item.title ?? "";
      const content = item.contentSnippet ?? item.content ?? "";
      let link = item.link ?? "";
      let sourceName = source.name;

      // Handle Bing News feeds: extract real URL and source name
      if (source.bingNews) {
        link = extractBingUrl(link);
        sourceName = extractBingSource(item);
        title = cleanBingTitle(title);
      }

      if (source.dukeSpecific || isDukeRelated(title, content)) {
        items.push({
          title: decodeHtmlEntities(title),
          link,
          pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
          source: sourceName,
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

  // Deduplicate by normalized title (first 60 chars)
  const seen = new Set<string>();
  const deduped = allItems.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Cap per-source to prevent any single source from drowning out diversity.
  // Bing News articles each have their own source (ESPN, Yahoo, etc.) so they
  // are unaffected. This primarily caps blog feeds like Ball Durham (90+ articles).
  const MAX_PER_SOURCE = 15;
  const sourceCounts = new Map<string, number>();
  const capped = deduped.filter((item) => {
    const count = sourceCounts.get(item.source) ?? 0;
    if (count >= MAX_PER_SOURCE) return false;
    sourceCounts.set(item.source, count + 1);
    return true;
  });

  // Sort newest first
  capped.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  return {
    items: capped,
    sources,
    lastUpdated: new Date().toISOString(),
  };
}
