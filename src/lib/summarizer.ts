import type { FeedItem } from "./aggregator";
import { getClient } from "./ai-client";
import { extractArticle } from "./reader";

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
    // Use RSS titles and snippets for fast summarization (no article fetching)
    const sorted = [...articles].sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    const articleContents = sorted.map((article) => ({
      source: article.source,
      title: article.title,
      content: article.snippet,
    }));

    const client = getClient();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a sports journalist writing a comprehensive news briefing. Synthesize these ${articles.length} articles from different sources into a single authoritative summary.

Topic: ${clusterHeadline}

Sources:
${articleContents
  .map(
    (a, i) => `--- Source ${i + 1}: ${a.source} ---
Title: ${a.title}
${a.content}`
  )
  .join("\n\n")}

Write a JSON response with this exact structure:
{
  "headline": "A specific, engaging headline (max 100 chars)",
  "summary": "A comprehensive 2-4 paragraph synthesis that draws from all sources. Mention sources by name when attributing specific facts or quotes (e.g., 'According to ESPN...'). Write in a neutral, informative tone. Use plain text, no markdown.",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
}

Rules:
- Synthesize, don't just concatenate — create a unified narrative
- Attribute key facts to their sources by name
- Include 3-5 key points as concise bullet strings
- Keep the summary focused and scannable
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
