import { unstable_cache } from "next/cache";
import { aggregateFeeds, type FeedItem } from "./aggregator";
import { clusterStories, generateStoryId } from "./clusterer";
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
    summary = await summarizeStory(headline, articles);
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

  // Unclustered articles become standalone
  const unclustered = items.filter((_, i) => !clusteredIndices.has(i));

  // Build standalone stories for unclustered articles
  const standaloneStories = unclustered.map((item) => {
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

/**
 * Cached version of the pipeline. Uses Next.js persistent data cache
 * so the same story data is shared across all serverless invocations
 * (homepage ISR, story pages, API routes) on Vercel.
 */
export const getStoryFeed = unstable_cache(
  runPipeline,
  ["story-feed"],
  { revalidate: 600 } // 10 minutes
);
