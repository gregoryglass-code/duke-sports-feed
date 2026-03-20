import { aggregateFeeds, type FeedItem } from "./aggregator";
import { clusterStories, generateStoryId } from "./clusterer";
import { extractArticleText } from "./reader";
import { summarizeStory } from "./summarizer";
import type { Story, StoryFeed } from "./types";

// In-memory caches (for dev mode / same-process dedup)
const storyCache = new Map<string, Story>();

function pickBestImage(articles: FeedItem[]): string | null {
  return articles.find((a) => a.imageUrl)?.imageUrl ?? null;
}

function pickCategory(articles: FeedItem[]): FeedItem["category"] {
  const counts: Record<string, number> = {};
  for (const a of articles) {
    counts[a.category] = (counts[a.category] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as FeedItem["category"];
}

async function buildStory(
  headline: string,
  articles: FeedItem[]
): Promise<Story> {
  const id = generateStoryId(articles);

  // Check cache
  const cached = storyCache.get(id);
  if (cached) return cached;

  const uniqueSources = new Set(articles.map((a) => a.source));
  const latestDate = articles
    .map((a) => new Date(a.pubDate).getTime())
    .sort((a, b) => b - a)[0];

  let summary: { headline: string; summary: string; keyPoints: string[] };

  if (articles.length >= 2) {
    summary = await summarizeStory(headline, articles, uniqueSources.size > 1);
  } else {
    // Standalone article — skip AI
    summary = {
      headline: articles[0].title,
      summary: articles[0].snippet,
      keyPoints: [],
    };
  }

  const story: Story = {
    id,
    headline: summary.headline,
    summary: summary.summary,
    keyPoints: summary.keyPoints,
    category: pickCategory(articles),
    articles,
    sourceCount: uniqueSources.size,
    latestDate: new Date(latestDate).toISOString(),
    imageUrl: pickBestImage(articles),
    relatedStoryIds: [],
  };

  storyCache.set(id, story);
  return story;
}

/**
 * Fetch full article text for the 2 most recent articles in each multi-article cluster.
 * Capped at 10 total fetches, all run in parallel. Failures are silently ignored.
 */
async function enrichClusterArticles(
  clusters: Awaited<ReturnType<typeof clusterStories>>,
  items: FeedItem[]
): Promise<void> {
  const MAX_FETCHES = 10;
  const ARTICLES_PER_CLUSTER = 2;

  // Collect (articleIndex, FeedItem) pairs to enrich
  const toFetch: { idx: number; item: FeedItem }[] = [];

  for (const cluster of clusters) {
    if (cluster.articleIndices.length < 2) continue;

    // Sort by date descending, pick top N
    const sorted = [...cluster.articleIndices]
      .map((i) => ({ idx: i, item: items[i] }))
      .sort((a, b) => new Date(b.item.pubDate).getTime() - new Date(a.item.pubDate).getTime());

    for (const entry of sorted.slice(0, ARTICLES_PER_CLUSTER)) {
      // Deduplicate by URL
      if (!toFetch.some((f) => f.item.link === entry.item.link)) {
        toFetch.push(entry);
      }
    }

    if (toFetch.length >= MAX_FETCHES) break;
  }

  const capped = toFetch.slice(0, MAX_FETCHES);
  if (capped.length === 0) return;

  console.log(`[Enricher] Fetching full text for ${capped.length} articles...`);

  const results = await Promise.allSettled(
    capped.map(async ({ idx, item }) => {
      const text = await extractArticleText(item.link);
      if (text) {
        items[idx].fullText = text;
        console.log(`[Enricher] Got ${text.length} chars from ${item.source}: "${item.title.slice(0, 60)}"`);
      }
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  console.log(`[Enricher] Done: ${succeeded}/${capped.length} succeeded`);
}

async function runPipeline(): Promise<StoryFeed> {
  const { items, sources, lastUpdated } = await aggregateFeeds();

  // Cluster articles using AI
  let clusters: Awaited<ReturnType<typeof clusterStories>> = [];
  try {
    clusters = await clusterStories(items);
  } catch (err) {
    console.error("Clustering failed, falling back to no clusters:", err);
    clusters = [];
  }

  // Enrich clustered articles with full text before summarization
  try {
    await enrichClusterArticles(clusters, items);
  } catch (err) {
    console.error("[Enricher] Failed, continuing with snippets only:", err);
  }

  // Track which articles are clustered
  const clusteredIndices = new Set<number>();
  for (const cluster of clusters) {
    for (const idx of cluster.articleIndices) {
      clusteredIndices.add(idx);
    }
  }

  // Build stories from clusters sequentially to avoid rate limits on Sonnet
  const stories: Story[] = [];
  for (const cluster of clusters) {
    const articles = cluster.articleIndices.map((i) => items[i]);
    try {
      const story = await buildStory(cluster.headline, articles);
      stories.push(story);
    } catch (err) {
      console.error(`[Pipeline] Failed to build story "${cluster.headline}":`, err instanceof Error ? err.message : err);
    }
  }

  // Unclustered articles — filter out low-value ones that rehash clustered content
  const unclustered = items.filter((_, i) => !clusteredIndices.has(i));

  // Collect keywords from clustered story headlines for overlap detection
  const clusteredKeywords = new Set<string>();
  for (const story of stories) {
    const words = story.headline.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
    for (const w of words) {
      if (w.length > 3) clusteredKeywords.add(w);
    }
  }

  // Filter: keep standalone articles that bring something new
  const filteredUnclustered = unclustered.filter((item) => {
    const titleWords = item.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
    const significantWords = titleWords.filter((w) => w.length > 3);
    if (significantWords.length === 0) return true;
    const overlapCount = significantWords.filter((w) => clusteredKeywords.has(w)).length;
    const overlapRatio = overlapCount / significantWords.length;
    // If >60% of the title words overlap with clustered stories, it's redundant
    if (overlapRatio > 0.6) {
      console.log(`[Pipeline] Filtering redundant standalone: "${item.title}"`);
      return false;
    }
    return true;
  });

  // Build standalone stories for remaining unclustered articles
  const standaloneStories = filteredUnclustered.map((item) => {
    const id = generateStoryId([item]);
    return {
      id,
      headline: item.title,
      summary: item.snippet,
      keyPoints: [],
      category: item.category,
      articles: [item],
      sourceCount: 1,
      latestDate: item.pubDate,
      imageUrl: item.imageUrl,
      relatedStoryIds: [],
    } satisfies Story;
  });

  // Combine: multi-source stories first, then standalone
  const allStories = [...stories, ...standaloneStories];

  // Sort all by latest date
  allStories.sort(
    (a, b) =>
      new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
  );

  // Link related stories (same category)
  for (const story of allStories) {
    story.relatedStoryIds = allStories
      .filter((s) => s.id !== story.id && s.category === story.category)
      .slice(0, 6)
      .map((s) => s.id);
  }

  return {
    stories: allStories,
    unclustered,
    sources,
    lastUpdated,
  };
}

import { unstable_cache } from "next/cache";

/**
 * Persistent cache via Vercel's data cache. Ensures the homepage and ALL
 * story pages see the exact same StoryFeed for the entire revalidation
 * window — even across different serverless invocations.
 *
 * Without this, each serverless instance re-runs the pipeline, producing
 * different clusters with different IDs, causing "Story not found" errors
 * when the homepage links to IDs the story page has never seen.
 */
const getCachedStoryFeed = unstable_cache(
  async () => runPipeline(),
  ["story-feed-v2"],
  { revalidate: 3600 } // 1 hour — outlives ISR (600s) so story IDs remain valid
);

// In-process fallback for local dev (unstable_cache works in prod on Vercel)
let localCache: StoryFeed | null = null;

export async function getStoryFeed(): Promise<StoryFeed> {
  // In development, use in-process cache for speed
  if (process.env.NODE_ENV === "development") {
    if (localCache) return localCache;
    localCache = await runPipeline();
    return localCache;
  }
  return getCachedStoryFeed();
}
