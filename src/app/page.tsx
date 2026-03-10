import { aggregateFeeds, type FeedItem } from "@/lib/aggregator";
import Link from "next/link";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function categoryPill(cat: FeedItem["category"]) {
  const styles: Record<string, string> = {
    basketball: "bg-[var(--color-cobalt)] text-white",
    football: "bg-[var(--color-cobalt-dark)] text-white",
    conference: "bg-[var(--color-cobalt-med)] text-white",
    "all-sports": "bg-[var(--color-sky)] text-[var(--color-cobalt-dark)]",
  };
  const labels: Record<string, string> = {
    basketball: "Basketball",
    football: "Football",
    conference: "ACC",
    "all-sports": "All Sports",
  };
  return { style: styles[cat] ?? styles["all-sports"], label: labels[cat] ?? "All Sports" };
}

function articleSlug(item: FeedItem): string {
  return Buffer.from(item.link).toString("base64url");
}

function ArticleCard({ item }: { item: FeedItem }) {
  const pill = categoryPill(item.category);
  const slug = articleSlug(item);

  return (
    <Link
      href={`/article/${slug}`}
      className="fs-card flex-shrink-0 w-[320px] overflow-hidden cursor-pointer group"
    >
      {/* Image */}
      <div className="relative h-[180px] bg-[var(--color-sky-light)] overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
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
        {/* Category pill overlay */}
        <div className="absolute top-3 left-3">
          <span className={`fs-pill ${pill.style}`}>{pill.label}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-[15px] font-semibold leading-snug text-[var(--color-text-primary)] line-clamp-2 group-hover:text-[var(--color-cobalt)] transition-colors">
          {item.title}
        </h3>
        {item.snippet && (
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)] line-clamp-2">
            {item.snippet}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-[var(--color-text-muted)]">
          <span className="font-mono">{item.source}</span>
          <span className="text-[var(--color-sky)]">·</span>
          <span>{timeAgo(item.pubDate)}</span>
        </div>
      </div>
    </Link>
  );
}

function CategorySection({ title, items }: { title: string; items: FeedItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="font-display text-xl text-[var(--color-cobalt)] mb-4 px-1">
        {title}
      </h2>
      <div className="fs-scroll -mx-4 px-4">
        {items.map((item, i) => (
          <ArticleCard key={`${item.link}-${i}`} item={item} />
        ))}
      </div>
    </section>
  );
}

export const revalidate = 300;

export default async function Home() {
  const { items, sources, lastUpdated } = await aggregateFeeds();

  const activeSources = sources.filter((s) => s.status === "ok" && s.count > 0);

  // Split by category for carousels
  const basketball = items.filter((i) => i.category === "basketball");
  const football = items.filter((i) => i.category === "football");
  const conference = items.filter((i) => i.category === "conference");
  const allSports = items.filter((i) => i.category === "all-sports");

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      {/* Header */}
      <header className="bg-[var(--color-cobalt)] text-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl">
                Duke Sports Feed
              </h1>
              <p className="mt-1 text-sm text-[var(--color-cobalt-lite)] font-medium" style={{ fontFamily: "var(--font-body)" }}>
                All Blue Devils news — one place
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--color-cobalt-lite)]">
                <span className="font-mono">{items.length} articles</span>
                <span>·</span>
                <span>{activeSources.length} sources</span>
              </div>
              <a
                href="/api/rss"
                className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1Z" />
                </svg>
                RSS
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        {items.length === 0 ? (
          <div className="fs-card p-12 text-center">
            <p className="text-lg text-[var(--color-text-secondary)]">
              No articles found. Feeds may be temporarily unavailable.
            </p>
          </div>
        ) : (
          <>
            {/* Latest — all articles carousel */}
            <CategorySection title="Latest" items={items.slice(0, 20)} />

            {/* Category carousels */}
            <CategorySection title="Basketball" items={basketball.slice(0, 15)} />
            <CategorySection title="Football" items={football.slice(0, 15)} />
            <CategorySection title="ACC" items={conference.slice(0, 15)} />
            {allSports.length > 0 && (
              <CategorySection title="All Sports" items={allSports.slice(0, 15)} />
            )}
          </>
        )}

        {/* Sources footer */}
        <footer className="mt-6 border-t border-[var(--color-border)] pt-6 pb-12">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-secondary)]">
            Sources
          </h3>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <span
                key={s.name}
                className={`fs-pill ${
                  s.status === "ok" && s.count > 0
                    ? "bg-[var(--color-sky)] text-[var(--color-cobalt-dark)]"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {s.name} ({s.count})
              </span>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}
