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

/**
 * Build the source block for each article.
 * Prefers fullText (from article enrichment) over RSS snippet.
 */
function buildSourceEntry(article: FeedItem, index: number): string {
  const num = index + 1;
  if (article.fullText) {
    // Truncate full text to ~3000 chars at a sentence boundary
    let text = article.fullText;
    if (text.length > 3000) {
      const cutoff = text.lastIndexOf(".", 3000);
      text = cutoff > 2000 ? text.slice(0, cutoff + 1) : text.slice(0, 3000);
    }
    return `[${num}] ${article.source}: "${article.title}"\n${text}`;
  }
  return `[${num}] ${article.source}: "${article.title}" — ${article.snippet}`;
}

export async function summarizeStory(
  clusterHeadline: string,
  articles: FeedItem[],
  isMultiSource: boolean
): Promise<SummaryResult> {
  try {
    const sorted = [...articles].sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    const sourceList = sorted
      .map((a, i) => buildSourceEntry(a, i))
      .join("\n\n");

    const hasFullText = sorted.some((a) => a.fullText);

    const client = getClient();

    const keyPointsInstruction = isMultiSource
      ? '"keyPoints": []'
      : '"keyPoints": ["Concise factual point 1", "Key detail 2", "Important context 3"]';

    const keyPointsRule = isMultiSource
      ? "- keyPoints MUST be an empty array [] for multi-source stories"
      : "- Include 3-5 key points, each one concise sentence";

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are a sports journalist synthesizing ${articles.length} sources about Duke athletics into a single briefing.

Sources:

${sourceList}

GROUNDING RULE: You may ONLY state facts that are EXPLICITLY present in the source text above. Do not infer, assume, or fabricate any details — no dates, locations, scores, statistics, or names that are not directly stated in the sources. If the sources lack detail on a point, simply omit it. Never fill gaps with plausible-sounding information.

Return JSON:
{
  "headline": "A specific, factual headline (max 90 chars). Only reference details present in the sources.",
  "summary": "${hasFullText ? "A thorough 1-3 paragraph synthesis" : "A concise 1-2 paragraph synthesis"} based on the source text provided. Write with clarity and substance — polished prose, not a wire service recap. Use inline citation numbers [1] or [2][3] after key facts. DO NOT mention source names in the text. Plain text only, no markdown.",
  ${keyPointsInstruction}
}

Rules:
- ONLY include facts explicitly stated in the sources above — nothing else
- Do not invent dates, venues, opponents, stats, or context not in the text
- NEVER mention source names in the summary — use [1], [2], etc. only
- Synthesize into a unified narrative, not a per-source summary
- If sources are brief, write a shorter summary — do not pad with invented details
${keyPointsRule}
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
