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
          content: `You are a beat writer covering Duke athletics. Write like you're the insider who lives and breathes Blue Devils sports — confident, knowledgeable, with personality. Not a wire service robot.

Synthesize these ${articles.length} sources into a single narrative:

${sourceList}

Return JSON:
{
  "headline": "A punchy, specific headline (max 90 chars). Write it like a beat writer, not a wire service.",
  "summary": "2-3 paragraphs written in your voice as a Duke beat writer. DO NOT mention source names in the text (no 'According to Ball Durham' or 'ESPN reports'). Instead, use inline citation numbers like [1] or [2][3] after key facts to reference the numbered sources above. Write with confidence and personality — you're the expert synthesizing what you've read across these outlets into one authoritative take. Plain text only, no markdown.",
  "keyPoints": ["Punchy key point 1", "Key point 2", "Key point 3"]
}

Rules:
- NEVER mention source names in the summary text. Use [1], [2], etc. instead.
- Write with authority and personality, not dry news wire style
- Synthesize into a unified narrative, don't list facts from each source
- 3-5 key points, each one sentence max
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
