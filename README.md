# Fanstake Sports Feed

AI-powered sports news aggregator that clusters articles from multiple sources into unified stories with grounded summaries and inline citations. Think Perplexity for sports news — users get synthesized briefings instead of a list of links.

**Live prototype (Duke):** [duke-sports-feed.vercel.app](https://duke-sports-feed.vercel.app)

## How It Works

```
RSS Feeds (Bing News + direct)
  → Aggregate & deduplicate articles
  → AI clusters related articles into stories
  → Fetch full article text for top sources
  → AI generates grounded summary with [1][2] citations
  → Cache in Redis (shared across all serverless isolates)
  → Render as browsable feed with story detail pages
```

Users stay on-site reading synthesized content. Source links open externally to keep content holders happy.

## Quick Start

```bash
git clone https://github.com/gregoryglass-code/duke-sports-feed.git
cd duke-sports-feed
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key — used for article clustering and summarization (Haiku 4.5) |
| `KV_REST_API_URL` | No* | Upstash Redis REST endpoint for shared caching across serverless isolates |
| `KV_REST_API_TOKEN` | No* | Upstash Redis auth token |

*Without Redis credentials the app runs fine but uses in-memory caching only. This means different serverless instances may produce different story IDs, causing "Story not found" errors under load. **Required for production.**

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router, ISR) | Server components, incremental static regeneration, Vercel-native |
| AI | Claude Haiku 4.5 (`@anthropic-ai/sdk`) | Fast + cheap for clustering and summarization (~$0.01/pipeline run) |
| Caching | Upstash Redis (`@upstash/redis`) | Sub-10ms shared cache with TTL, distributed locking |
| RSS | `rss-parser` | Reliable RSS/Atom parsing with custom field support |
| Article extraction | `@mozilla/readability` + `linkedom` | Mozilla's Readability algorithm with lightweight DOM (no JSDOM — critical for serverless) |
| Styling | Tailwind CSS 4 + Fanstake design tokens | CSS variables for easy theming per school |

## Project Structure

```
src/
  lib/
    feeds.ts            # Feed source definitions (URLs, categories, keywords)
    aggregator.ts       # RSS fetching, deduplication, per-source capping
    clusterer.ts        # AI clustering — groups related articles into stories
    summarizer.ts       # AI summarization — generates grounded narratives with citations
    reader.ts           # Full article text extraction via Readability
    story-pipeline.ts   # Orchestrator — runs the full pipeline with 2-tier caching
    feed-cache.ts       # Redis caching layer with distributed lock
    ai-client.ts        # Anthropic SDK client singleton
    types.ts            # TypeScript interfaces (Story, StoryFeed)
  app/
    page.tsx            # Homepage — Top Stories, More Stories, Latest
    story/[id]/page.tsx # Story detail — summary, citations, source list, navigation
    layout.tsx          # Root layout with NavBar, fonts, metadata
    globals.css         # Fanstake design tokens, utility classes, font faces
  components/
    NavBar.tsx          # Top navigation bar
```

## Deployment (Vercel)

1. Push repo to GitHub
2. Import project in Vercel dashboard
3. Add environment variables (Settings > Environment Variables):
   - `ANTHROPIC_API_KEY`
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN` (create an Upstash Redis store via Vercel Storage or [upstash.com](https://upstash.com))
4. Deploy — pages are statically generated at build time, then revalidated every 10 minutes via ISR

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical deep-dive: pipeline flow, AI prompt design, caching strategy, design decisions, and lessons learned.

## Generalizing to Other Schools

See [GENERALIZATION.md](./GENERALIZATION.md) for the roadmap on adapting this to any program — feed configuration, prompt parameterization, theming, and multi-tenant options.
