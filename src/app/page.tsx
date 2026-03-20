import { getStoryFeed } from "@/lib/story-pipeline";
import type { Story } from "@/lib/types";
import Link from "next/link";

export const revalidate = 600;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const categoryLabels: Record<string, string> = {
  basketball: "NCAAM",
  football: "NCAAF",
  conference: "ACC",
  "all-sports": "All Sports",
};

const categoryStyles: Record<string, string> = {
  basketball: "bg-[var(--color-cobalt)] text-white",
  football: "bg-[var(--color-cobalt-dark)] text-white",
  conference: "bg-[var(--color-cobalt-med)] text-white",
  "all-sports": "bg-[var(--color-sky)] text-[var(--color-cobalt-dark)]",
};

function StoryCard({ story }: { story: Story }) {
  return (
    <Link
      href={`/story/${story.id}`}
      className="fs-card flex-shrink-0 w-[360px] overflow-hidden cursor-pointer group"
    >
      {/* Image */}
      <div className="relative h-[200px] bg-[var(--color-sky-light)] overflow-hidden">
        {story.imageUrl ? (
          <img
            src={story.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--color-cobalt)] to-[var(--color-cobalt-dark)]">
            <svg className="h-12 w-12 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5" />
            </svg>
          </div>
        )}
        {/* Category pill */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={`fs-pill ${categoryStyles[story.category] ?? categoryStyles["all-sports"]}`}>
            {categoryLabels[story.category] ?? "All Sports"}
          </span>
          {story.sourceCount > 1 && (
            <span className="fs-pill bg-black/50 text-white backdrop-blur-sm">
              {story.sourceCount} sources
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)] mb-2">
          {story.articles.length > 0 && (
            <span className="font-mono">{story.articles[0].source}</span>
          )}
          {story.sourceCount > 1 && (
            <>
              <span className="text-[var(--color-sky)]">+{story.sourceCount - 1}</span>
            </>
          )}
          <span className="text-[var(--color-sky)]">·</span>
          <span>{timeAgo(story.latestDate)}</span>
        </div>
        <h3 className="text-[15px] font-semibold leading-snug text-[var(--color-text-primary)] line-clamp-2 group-hover:text-[var(--color-cobalt)] transition-colors">
          {story.headline}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)] line-clamp-2">
          {story.summary.slice(0, 160)}
          {story.summary.length > 160 ? "..." : ""}
        </p>
      </div>
    </Link>
  );
}

function HeroStoryCard({ story }: { story: Story }) {
  return (
    <Link
      href={`/story/${story.id}`}
      className="fs-card overflow-hidden cursor-pointer group"
    >
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        <div className="relative h-[200px] sm:h-auto sm:w-[400px] shrink-0 bg-[var(--color-sky-light)] overflow-hidden">
          {story.imageUrl ? (
            <img
              src={story.imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--color-cobalt)] to-[var(--color-cobalt-dark)]">
              <svg className="h-16 w-16 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`fs-pill ${categoryStyles[story.category] ?? categoryStyles["all-sports"]}`}>
              {categoryLabels[story.category] ?? "All Sports"}
            </span>
            {story.sourceCount > 1 && (
              <span className="fs-pill bg-[var(--color-sky)] text-[var(--color-cobalt-dark)]">
                {story.sourceCount} sources
              </span>
            )}
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {timeAgo(story.latestDate)}
            </span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl text-[var(--color-cobalt)] mb-3 group-hover:text-[var(--color-cobalt-dark)] transition-colors">
            {story.headline}
          </h2>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">
            {story.summary.slice(0, 250)}
            {story.summary.length > 250 ? "..." : ""}
          </p>
          {/* Source attribution */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {story.articles.slice(0, 4).map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]"
              >
                {a.source}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

function StorySection({ title, stories }: { title: string; stories: Story[] }) {
  if (stories.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="font-display text-xl text-[var(--color-cobalt)] mb-4 px-1">
        {title}
      </h2>
      <div className="fs-scroll -mx-4 px-4">
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const feed = await getStoryFeed();
  const { stories } = feed;

  // Split stories: clustered (2+ articles, AI-summarized) vs standalone
  const clustered = stories.filter((s) => s.articles.length > 1);
  const standalone = stories.filter((s) => s.articles.length === 1);

  // Top stories = clustered stories first (most articles = most coverage)
  const heroStories = clustered
    .sort((a, b) => b.articles.length - a.articles.length)
    .slice(0, 3);
  const remainingMulti = clustered
    .sort((a, b) => b.articles.length - a.articles.length)
    .slice(3);

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        {stories.length === 0 ? (
          <div className="fs-card p-12 text-center">
            <p className="text-lg text-[var(--color-text-secondary)]">
              No stories found. Feeds may be temporarily unavailable.
            </p>
          </div>
        ) : (
          <>
            {/* Hero: Top multi-source stories */}
            {heroStories.length > 0 && (
              <section className="mb-10">
                <h2 className="font-display text-xl text-[var(--color-cobalt)] mb-4 px-1">
                  Top Stories
                </h2>
                <div className="space-y-4">
                  {heroStories.map((story) => (
                    <HeroStoryCard key={story.id} story={story} />
                  ))}
                </div>
              </section>
            )}

            {/* More multi-source stories */}
            {remainingMulti.length > 0 && (
              <StorySection title="More Stories" stories={remainingMulti} />
            )}

            {/* Latest standalone articles */}
            {standalone.length > 0 && (
              <StorySection title="Latest" stories={standalone.slice(0, 6)} />
            )}
          </>
        )}

        {/* Bottom spacing */}
        <div className="pb-12" />
      </main>
    </div>
  );
}
