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
  articles: FeedItem[],
  isMultiSource: boolean
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

    const keyPointsInstruction = isMultiSource
      ? '"keyPoints": []'
      : '"keyPoints": ["Concise factual point 1", "Key detail 2", "Important context 3"]';

    const keyPointsRule = isMultiSource
      ? "- keyPoints MUST be an empty array [] for multi-source stories"
      : "- Include 3-5 key points, each one concise sentence with specific facts";

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are a thorough, substantive sports journalist writing about Duke athletics. Your writing style:
- Smart, specific, and grounded in facts — like The Athletic, not a wire service
- Every claim includes concrete details: full names, stats, dates, game scores, record numbers
- You explain the WHY behind developments, not just the WHAT
- Accessible and polished prose, conversational but clearly edited
- You NEVER hedge or say "details are unknown" when the sources contain those details — extract every specific fact available
- You synthesize across sources to build a complete picture a knowledgeable fan would want

Synthesize these ${articles.length} sources:

${sourceList}

CRITICAL: Extract and include EVERY specific detail from the sources — names, numbers, dates, stats, records, quotes. If a source mentions a person's name, use it. If it has a stat line, include it. Never generalize when specifics are available.

Return JSON:
{
  "headline": "A specific, factual headline (max 90 chars). Include names/numbers when relevant.",
  "summary": "A thorough 2-4 paragraph synthesis. Write with clarity and substance. Use inline citation numbers [1] or [2][3] after key facts to reference the numbered sources. DO NOT mention source names in the text — no 'According to ESPN', 'Ball Durham reports', etc. State facts directly and cite with numbers. The reader should come away fully informed on this story. Plain text only, no markdown.",
  ${keyPointsInstruction}
}

Rules:
- NEVER mention source names in the summary. Use [1], [2], etc. only.
- NEVER say "details are not yet known" or "it remains unclear" if the sources contain those details
- Include ALL specific names, numbers, stats, dates, and quotes from the sources
- Write with substance — a knowledgeable Duke fan should learn something
- Synthesize into a unified narrative, not a list of source-by-source facts
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
