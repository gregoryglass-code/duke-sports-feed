import type { FeedItem } from "./aggregator";
import { getClient } from "./ai-client";

interface SummaryResult {
  headline: string;
  summary: string;
  keyPoints: string[];
}

function fallbackSummary(
  clusterHeadline: string,
  articles: FeedItem[]
): SummaryResult {
  return {
    headline: clusterHeadline,
    summary: articles.map((a) => a.snippet).join(" "),
    keyPoints: [],
  };
}

export async function summarizeStory(
  clusterHeadline: string,
  articles: FeedItem[]
): Promise<SummaryResult> {
  try {
    const sorted = [...articles].sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    // Number sources so the AI can use inline citations [1][2]
    const sourceList = sorted
      .map((a, i) => `[${i + 1}] ${a.source}: "${a.title}" — ${a.snippet}`)
      .join("\n\n");

    const client = getClient();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a thorough, authoritative sports news summarizer. Write a comprehensive synthesis of these ${articles.length} sources about Duke athletics.

Sources:
${sourceList}

Return JSON:
{
  "headline": "A clear, specific, factual headline (max 90 chars). Straight news — no clickbait, no opinion.",
  "summary": "A thorough 2-4 paragraph synthesis that covers all the key facts, context, and developments. Write in a clear, direct, informative style — like a well-written news briefing. Use inline citation numbers [1] or [2][3] after specific facts to reference the numbered sources above. DO NOT mention source names anywhere in the text — no 'According to ESPN', 'Ball Durham reports', etc. Just state the facts and cite with numbers. Plain text only, no markdown.",
  "keyPoints": ["Clear factual point 1", "Key development 2", "Important detail 3"]
}

Rules:
- NEVER mention source names in the summary. Use [1], [2], etc. only.
- Be thorough and informative — cover all significant details from across sources
- Write with clarity and confidence, straight news tone
- Synthesize into a unified narrative, not a list of what each source said
- 3-5 key points, each one concise sentence
- Return ONLY the JSON object`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]) as SummaryResult;
    return {
      headline: parsed.headline || clusterHeadline,
      summary: parsed.summary || "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    };
  } catch (err) {
    console.error(`[Summarizer] Failed for "${clusterHeadline}":`, err instanceof Error ? err.message : err);
    return fallbackSummary(clusterHeadline, articles);
  }
}
