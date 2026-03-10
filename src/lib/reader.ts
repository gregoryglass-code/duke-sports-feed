import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export interface ArticleContent {
  title: string;
  content: string;
  excerpt: string;
  byline: string | null;
  siteName: string | null;
  imageUrl: string | null;
  url: string;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; DukeSportsFeed/1.0; +https://duke-sports-feed.vercel.app)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch article: ${res.status}`);
  }

  return res.text();
}

function extractOgImage(doc: Document): string | null {
  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) return ogImage.getAttribute("content");

  const twitterImage = doc.querySelector('meta[name="twitter:image"]');
  if (twitterImage) return twitterImage.getAttribute("content");

  return null;
}

export async function extractArticle(url: string): Promise<ArticleContent | null> {
  try {
    const html = await fetchHtml(url);
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    const ogImage = extractOgImage(doc);

    const reader = new Readability(doc);
    const article = reader.parse();

    if (!article) return null;

    // Try to get the lead image from the article content if no og:image
    let imageUrl = ogImage;
    if (!imageUrl && article.content) {
      const imgMatch = article.content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch?.[1]) imageUrl = imgMatch[1];
    }

    return {
      title: article.title ?? "",
      content: article.content ?? "",
      excerpt: article.excerpt ?? "",
      byline: article.byline ?? null,
      siteName: article.siteName ?? null,
      imageUrl,
      url,
    };
  } catch (err) {
    console.error(`Failed to extract article from ${url}:`, err);
    return null;
  }
}
