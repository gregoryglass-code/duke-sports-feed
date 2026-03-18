import { createHash } from "crypto";
import type { FeedItem } from "./aggregator";
import { getClient } from "./ai-client";

export interface StoryCluster {
  headline: string;
  articleIndices: number[];
}

export function generateStoryId(articles: FeedItem[]): string {
  const sorted = articles.map((a) => a.link).sort();
  const hash = createHash("sha256").update(sorted.join("|")).digest("hex");
  return `s-${hash.slice(0, 8)}`;
}

export async function clusterStories(
  items: FeedItem[]
): Promise<StoryCluster[]> {
  if (items.length === 0) return [];

  // Limit to 30 most recent articles to stay within token limits
  const capped = items.slice(0, 30);

  // Compact format: index|title|source (skip snippets to reduce tokens)
  const articleLines = capped
    .map((item, i) => `${i}. [${item.source}] ${item.title}`)
    .join("\n");

  const client = getClient();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Group these sports news articles into story clusters. Articles about the same event, game, player, or topic belong together.

${articleLines}

Return JSON: {"clusters":[{"headline":"...","articleIndices":[0,3]}]}

Rules: Only cluster 2+ articles about the same specific story. Be specific in headlines. Return ONLY JSON.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as {
      clusters: StoryCluster[];
    };

    // Validate: filter out invalid indices and clusters with < 2 articles
    return parsed.clusters
      .map((c) => ({
        headline: c.headline,
        articleIndices: c.articleIndices.filter(
          (i) => i >= 0 && i < capped.length
        ),
      }))
      .filter((c) => c.articleIndices.length >= 2);
  } catch (err) {
    console.error("Failed to parse clustering response:", err);
    return [];
  }
}
