import { getStoryFeed } from "@/lib/story-pipeline";
import type { FeedItem } from "@/lib/aggregator";
import Link from "next/link";

export const revalidate = 600;

export async function generateStaticParams() {
  const feed = await getStoryFeed();
  return feed.stories.map((story) => ({ id: story.id }));
}

/**
 * Render summary text with [1], [2] etc. as clickable superscript citation badges
 * linking to the corresponding source article.
 */
function renderSummaryWithCitations(summary: string, articles: FeedItem[]) {
  // Split on citation patterns like [1], [2][3], [1][2][3]
  const parts = summary.split(/(\[\d+\](?:\[\d+\])*)/g);

  return parts.map((part, i) => {
    // Check if this part is a citation group like [1] or [2][3]
    const citationMatch = part.match(/\[(\d+)\]/g);
    if (citationMatch) {
      return (
        <span key={i} className="inline-flex gap-0.5 mx-0.5">
          {citationMatch.map((cite, j) => {
            const num = parseInt(cite.replace(/[\[\]]/g, ""), 10);
            const article = articles[num - 1];
            if (!article) return null;
            return (
              <a
                key={j}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                title={`${article.source}: ${article.title}`}
                className="inline-flex items-center justify-center h-[17px] min-w-[17px] px-1 rounded-full bg-[var(--color-sky)] text-[var(--color-cobalt-med)] text-[10px] font-bold no-underline hover:bg-[var(--color-cobalt-lite)] hover:text-white transition-colors align-super -translate-y-0.5"
              >
                {num}
              </a>
            );
          })}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function StoryPage({ params }: PageProps) {
  const { id } = await params;
  const feed = await getStoryFeed();
  const story = feed.stories.find((s) => s.id === id);

  if (!story) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)]">
        <main className="mx-auto max-w-3xl px-4 py-12 text-center">
          <div className="fs-card p-12">
            <h1 className="font-display text-2xl text-[var(--color-cobalt)] mb-4">
              Story not found
            </h1>
            <p className="text-[var(--color-text-secondary)] mb-6">
              This story may have been updated. Check the latest feed.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-cobalt)] px-6 py-3 text-sm font-medium text-white transition hover:bg-[var(--color-cobalt-dark)]"
            >
              Go to Feed
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const related = feed.stories.filter((s) =>
    story.relatedStoryIds.includes(s.id)
  );

  // Find prev/next stories for pagination
  const storyIndex = feed.stories.findIndex((s) => s.id === id);
  const prevStory = storyIndex > 0 ? feed.stories[storyIndex - 1] : null;
  const nextStory = storyIndex < feed.stories.length - 1 ? feed.stories[storyIndex + 1] : null;

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      {/* Breadcrumb */}
      <div className="bg-[var(--color-sky-light)] border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-3xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Link href="/" className="hover:text-[var(--color-cobalt)] transition-colors">Home</Link>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-[var(--color-text-secondary)] truncate max-w-[300px]">
              {story.headline}
            </span>
          </div>
        </div>
      </div>

      {/* Hero image */}
      {story.imageUrl && (
        <div className="relative h-[300px] sm:h-[400px] overflow-hidden bg-[var(--color-cobalt-dark)]">
          <img
            src={story.imageUrl}
            alt=""
            className="h-full w-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      {/* Story content */}
      <main className="mx-auto max-w-3xl px-4">
        <div className={`${story.imageUrl ? "-mt-20 relative z-10" : "mt-8"}`}>
          <div className="fs-card p-6 sm:p-10">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="fs-pill bg-[var(--color-sky)] text-[var(--color-cobalt-dark)]">
                {story.category}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {timeAgo(story.latestDate)}
              </span>
              {story.sourceCount > 1 && (
                <span className="fs-pill bg-[var(--color-cobalt)] text-white">
                  {story.sourceCount} sources
                </span>
              )}
            </div>

            {/* Headline */}
            <h1 className="font-display text-2xl sm:text-3xl text-[var(--color-cobalt)] mb-6">
              {story.headline}
            </h1>

            {/* Source pills with citation numbers */}
            {story.sourceCount > 1 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {story.articles.map((article, i) => (
                  <a
                    key={i}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-cobalt-lite)] hover:text-[var(--color-cobalt)]"
                  >
                    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[var(--color-sky)] text-[var(--color-cobalt-med)] text-[10px] font-bold">
                      {i + 1}
                    </span>
                    {article.source}
                  </a>
                ))}
              </div>
            )}

            {/* Key Points — only for single-source stories */}
            {story.sourceCount <= 1 && story.keyPoints.length > 0 && (
              <div className="rounded-xl bg-[var(--color-sky-light)] border border-[var(--color-border)] p-5 mb-8">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-cobalt-dark)] mb-3">
                  Key Points
                </h2>
                <ul className="space-y-2">
                  {story.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cobalt)]" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary with inline citations */}
            <div className="text-[var(--color-text-primary)] text-base sm:text-lg leading-relaxed whitespace-pre-line">
              {renderSummaryWithCitations(story.summary, story.articles)}
            </div>

            {/* Divider */}
            <hr className="border-[var(--color-border)] my-8" />

            {/* Sources section */}
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
              Sources ({story.articles.length})
            </h2>
            <div className="space-y-3">
              {story.articles.map((article, i) => {
                const slug = Buffer.from(article.link).toString("base64url");
                return (
                  <Link
                    key={i}
                    href={`/article/${slug}`}
                    className="block rounded-xl border border-[var(--color-border)] p-4 transition hover:border-[var(--color-cobalt-lite)] hover:bg-[var(--color-sky-light)]"
                  >
                    <div className="flex items-start gap-3">
                      {article.imageUrl && (
                        <img
                          src={article.imageUrl}
                          alt=""
                          className="h-16 w-24 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-cobalt-med)]">
                            {article.source}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {timeAgo(article.pubDate)}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2">
                          {article.title}
                        </h3>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

          </div>
        </div>

        {/* Prev / Next navigation */}
        {(prevStory || nextStory) && (
          <div className="mt-8 grid grid-cols-2 gap-4">
            {prevStory ? (
              <Link
                href={`/story/${prevStory.id}`}
                className="fs-card p-4 group flex items-start gap-3 col-start-1"
              >
                <svg className="h-5 w-5 mt-0.5 shrink-0 text-[var(--color-cobalt-lite)] group-hover:text-[var(--color-cobalt)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Previous
                  </span>
                  <h4 className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 group-hover:text-[var(--color-cobalt)] transition-colors mt-0.5">
                    {prevStory.headline}
                  </h4>
                </div>
              </Link>
            ) : (
              <div />
            )}
            {nextStory ? (
              <Link
                href={`/story/${nextStory.id}`}
                className="fs-card p-4 group flex items-start gap-3 text-right flex-row-reverse col-start-2"
              >
                <svg className="h-5 w-5 mt-0.5 shrink-0 text-[var(--color-cobalt-lite)] group-hover:text-[var(--color-cobalt)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Next
                  </span>
                  <h4 className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 group-hover:text-[var(--color-cobalt)] transition-colors mt-0.5">
                    {nextStory.headline}
                  </h4>
                </div>
              </Link>
            ) : (
              <div />
            )}
          </div>
        )}

        {/* Related Stories */}
        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display text-lg text-[var(--color-cobalt)] mb-4">
              Related
            </h2>
            <div className="fs-scroll pb-4">
              {related.map((s) => (
                <Link
                  key={s.id}
                  href={`/story/${s.id}`}
                  className="fs-card flex-shrink-0 w-[280px] overflow-hidden"
                >
                  {s.imageUrl && (
                    <div className="h-[140px] overflow-hidden">
                      <img
                        src={s.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="fs-pill bg-[var(--color-sky)] text-[var(--color-cobalt-dark)] text-[10px]">
                        {s.category}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {timeAgo(s.latestDate)}
                      </span>
                      {s.sourceCount > 1 && (
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {s.sourceCount} sources
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2">
                      {s.headline}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="pb-16" />
      </main>
    </div>
  );
}
