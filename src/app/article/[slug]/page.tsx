import { extractArticle } from "@/lib/reader";
import Link from "next/link";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const url = Buffer.from(slug, "base64url").toString("utf-8");

  const article = await extractArticle(url);

  if (!article) {
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
              Could not load article
            </h1>
            <p className="text-[var(--color-text-secondary)] mb-6">
              The article content could not be extracted. This sometimes happens with
              paywalled or dynamically-loaded content.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-cobalt)] px-6 py-3 text-sm font-medium text-white transition hover:bg-[var(--color-cobalt-dark)]"
            >
              Read on original site
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      {/* Header */}
      <header className="bg-[var(--color-cobalt)] text-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-cobalt-lite)] hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Back to Feed
            </Link>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-cobalt-lite)] hover:text-white transition-colors"
            >
              Original
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Hero image */}
      {article.imageUrl && (
        <div className="relative h-[300px] sm:h-[400px] overflow-hidden bg-[var(--color-cobalt-dark)]">
          <img
            src={article.imageUrl}
            alt=""
            className="h-full w-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      {/* Article */}
      <main className="mx-auto max-w-3xl px-4">
        <div className={`${article.imageUrl ? "-mt-20 relative z-10" : "mt-8"}`}>
          <div className="fs-card p-6 sm:p-10">
            {/* Article meta */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--color-text-muted)] mb-4">
              {article.siteName && (
                <span className="fs-pill bg-[var(--color-sky)] text-[var(--color-cobalt-dark)]">
                  {article.siteName}
                </span>
              )}
              {article.byline && (
                <span>{article.byline}</span>
              )}
            </div>

            {/* Title */}
            <h1 className="font-display text-2xl sm:text-3xl text-[var(--color-cobalt)] mb-4">
              {article.title}
            </h1>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed mb-8 border-l-4 border-[var(--color-sky)] pl-4">
                {article.excerpt}
              </p>
            )}

            {/* Divider */}
            <hr className="border-[var(--color-border)] mb-8" />

            {/* Content */}
            <div
              className="reader-content"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-[var(--color-border)] flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-cobalt)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-cobalt-dark)]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                Back to Feed
              </Link>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-cobalt-lite)] hover:text-[var(--color-cobalt)]"
              >
                Read on original site
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="pb-16" />
      </main>
    </div>
  );
}
