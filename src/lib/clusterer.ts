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

  // Include source name and snippet so the AI can see cross-source coverage
  const articleLines = capped
    .map((item, i) => `${i}. [${item.source}] ${item.title} — ${item.snippet.slice(0, 120)}`)
    .join("\n");

  const client = getClient();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a news editor clustering articles for a Duke sports news briefing. Your job is to group articles covering the SAME story from DIFFERENT news outlets.

CLUSTER AGGRESSIVELY. These are all about Duke sports — most articles will relate to each other. Group articles if they cover:
- The same game (previews, odds, recaps, reactions, analysis — ALL belong in one cluster)
- The same player (injury reports, profiles, stats discussions across outlets)
- The same news event (coaching hires, recruiting, rankings from any angle)
- The same narrative (tournament path, title odds, team concerns)

Example: "Duke vs Siena prediction" (Covers.com) + "Duke debacle vs Siena" (Ball Durham) + "Duke survives Siena" (ESPN) = ONE cluster about the Duke-Siena game.

Articles:
${articleLines}

Return JSON: {"clusters":[{"headline":"A specific headline","articleIndices":[0,3,7]}]}

Rules:
- MOST articles should end up in a cluster. Standalone articles should be rare — only if truly unique topic.
- Articles about the same game from different sources MUST be in the same cluster, even if one is a preview and another is a recap
- Group broadly: odds articles, injury reports, and game previews for the same matchup all go together
- Headlines should be specific (e.g., "Duke Survives Siena 71-65 in NCAA Tournament Opener")
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
