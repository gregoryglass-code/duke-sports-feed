import type { FeedItem } from "./aggregator";
import { getClient } from "./ai-client";
import { extractArticle } from "./reader";

interface SummaryResult {
  headline: string;
  summary: string;
  keyPoints: string[];
}

export async function summarizeStory(
  clusterHeadline: string,
  articles: FeedItem[]
): Promise<SummaryResult> {
  // Extract full content from up to 3 articles (most recent first)
  const sorted = [...articles].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );
  const toExtract = sorted.slice(0, 3);

  const extracted = await Promise.allSettled(
    toExtract.map((a) => extractArticle(a.link))
  );

  const articleContents = sorted.map((article, i) => {
    const result = i < extracted.length ? extracted[i] : undefined;
    const fullContent =
      result?.status === "fulfilled" && result.value
        ? result.value.content
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 3000)
        : null;

    return {
      source: article.source,
      title: article.title,
      content: fullContent ?? article.snippet,
    };
  });

  const client = getClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
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

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]) as SummaryResult;
    return {
      headline: parsed.headline || clusterHeadline,
      summary: parsed.summary || "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    };
  } catch (err) {
    console.error("Failed to parse summary response:", err);
    return {
      headline: clusterHeadline,
      summary: articles.map((a) => a.snippet).join(" "),
      keyPoints: [],
    };
  }
}
