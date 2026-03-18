import { getStoryFeed } from "@/lib/story-pipeline";
import Link from "next/link";

export const revalidate = 600;

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
        <header className="bg-[var(--color-cobalt)] text-white">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-cobalt-lite)] hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Back to Feed
            </Link>
          </div>
        </header>
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

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      {/* Header */}
      <header className="bg-[var(--color-cobalt)] text-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-cobalt-lite)] hover:text-white transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back to Feed
          </Link>
        </div>
      </header>

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

            {/* Source pills */}
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
                    <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                    {article.source}
                  </a>
                ))}
              </div>
            )}

            {/* Key Points */}
            {story.keyPoints.length > 0 && (
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

            {/* Summary */}
            <div className="text-[var(--color-text-primary)] text-base sm:text-lg leading-relaxed whitespace-pre-line">
              {story.summary}
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

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-cobalt)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-cobalt-dark)]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                Back to Feed
              </Link>
            </div>
          </div>
        </div>

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
