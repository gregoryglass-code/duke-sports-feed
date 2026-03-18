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

  // Use all items (already capped at ~30-40 by aggregator's per-source limit)
  const capped = items.slice(0, 40);

  // Include source name so the AI can see cross-source coverage
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
        content: `You are a news editor clustering articles for a Duke sports news briefing.

Group articles that cover the SAME TOPIC into clusters. Be aggressive about grouping — articles don't need identical titles. Group them if they cover:
- The same game or matchup (previews, recaps, odds, analysis all belong together)
- The same player story (injury updates, milestones, reactions from different outlets)
- The same news event (coaching news, recruiting, rankings from multiple angles)
- The same broader narrative (March Madness preparation, tournament path, bracket analysis)

Articles from DIFFERENT sources about the same topic are the most valuable clusters.

${articleLines}

Return JSON: {"clusters":[{"headline":"A specific headline","articleIndices":[0,3,7]}]}

Rules:
- Cluster 2+ articles covering the same topic, even if from different angles
- Prioritize grouping articles from DIFFERENT sources over same-source clusters
- Headlines should be specific (e.g., "Duke Defeats Virginia to Win ACC Championship")
- Return ONLY valid JSON, no other text`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  console.log("[Clusterer] Raw AI response:", text.substring(0, 500));

  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[Clusterer] No JSON found in response");
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      clusters: StoryCluster[];
    };

    const valid = parsed.clusters
      .map((c) => ({
        headline: c.headline,
        articleIndices: c.articleIndices.filter(
          (i) => i >= 0 && i < capped.length
        ),
      }))
      .filter((c) => c.articleIndices.length >= 2);

    console.log(`[Clusterer] Found ${valid.length} clusters:`, valid.map((c) => `"${c.headline}" (${c.articleIndices.length} articles)`).join(", "));
    return valid;
  } catch (err) {
    console.error("[Clusterer] Failed to parse:", err, "Text:", text.substring(0, 200));
    return [];
  }
}
