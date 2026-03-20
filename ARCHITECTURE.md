# Architecture

## System Overview

```
                                    ┌─────────────────────────┐
                                    │     Feed Sources        │
                                    │  Bing News RSS (3)      │
                                    │  Direct RSS feeds (3)   │
                                    └────────────┬────────────┘
                                                 │
                                    ┌────────────▼────────────┐
                                    │     1. Aggregate        │
                                    │  aggregator.ts          │
                                    │  Parse, filter, dedup   │
                                    │  Cap 15/source          │
                                    └────────────┬────────────┘
                                                 │  ~30-40 FeedItems
                                    ┌────────────▼────────────┐
                                    │     2. Cluster (AI)     │
                                    │  clusterer.ts           │
                                    │  Haiku 4.5 groups       │
                                    │  related articles       │
                                    └────────────┬────────────┘
                                                 │  3-8 clusters + unclustered
                                    ┌────────────▼────────────┐
                                    │     3. Enrich           │
                                    │  reader.ts              │
                                    │  Fetch full text for    │
                                    │  top 2 articles/cluster │
                                    └────────────┬────────────┘
                                                 │  fullText attached to FeedItems
                                    ┌────────────▼────────────┐
                                    │     4. Summarize (AI)   │
                                    │  summarizer.ts          │
                                    │  Haiku 4.5 generates    │
                                    │  grounded narrative     │
                                    └────────────┬────────────┘
                                                 │  Story objects
                                    ┌────────────▼────────────┐
                                    │     5. Cache & Serve    │
                                    │  story-pipeline.ts      │
                                    │  feed-cache.ts          │
                                    │  L1 memory + L2 Redis   │
                                    └────────────┬────────────┘
                                                 │
                              ┌───────────────────┴───────────────────┐
                              │                                       │
                    ┌─────────▼─────────┐                   ┌─────────▼─────────┐
                    │   Homepage        │                   │   Story Page      │
                    │   page.tsx        │                   │   story/[id]      │
                    │   ISR 10min       │                   │   ISR 10min       │
                    └───────────────────┘                   └───────────────────┘
```

## Data Flow: RSS Item → Story

1. **Fetch**: `rss-parser` hits 6 feed URLs in parallel with 8s timeout
2. **Filter**: Non-Duke articles dropped (Bing feeds checked against keyword list)
3. **Normalize**: Bing redirect URLs → real article URLs; HTML entities decoded; source names extracted
4. **Deduplicate**: First 60 chars of lowercase alphanumeric title → `Set` check
5. **Cap**: Max 15 articles per source name (prevents blog firehoses)
6. **Cluster**: First 40 articles sent to Claude Haiku with title + 120-char snippet per article
7. **Enrich**: Top 2 most recent articles per cluster fetched via Readability (max 10 total fetches)
8. **Summarize**: Each cluster sent to Claude Haiku with full text (or snippet fallback) + grounding rules
9. **Filter standalones**: Unclustered articles with >60% keyword overlap with cluster headlines are dropped
10. **Assemble**: Stories sorted by date, related stories linked by category, story IDs generated as `s-{sha256[:8]}`

## File Map

| File | Purpose |
|------|---------|
| `feeds.ts` | Feed source definitions — URLs, categories, `bingNews` flag, Duke keywords |
| `aggregator.ts` | RSS parsing, Bing URL extraction, dedup, per-source cap, image extraction |
| `clusterer.ts` | AI clustering prompt, response parsing, story ID generation (SHA-256) |
| `summarizer.ts` | AI summarization prompt, grounding rules, citation format, fallback handling |
| `reader.ts` | Article text extraction via Readability + linkedom, 3000-char truncation |
| `story-pipeline.ts` | Pipeline orchestrator — aggregate → cluster → enrich → summarize → cache |
| `feed-cache.ts` | Redis L2 cache — read/write/lock with soft/hard TTLs, previous feed storage |
| `ai-client.ts` | Anthropic SDK singleton with 1 retry |
| `types.ts` | `Story` and `StoryFeed` interfaces |

## AI Prompts

### Clustering Prompt

**Model**: `claude-haiku-4-5-20251001` | **Max tokens**: 1024

**Input format** (one line per article):
```
0. [ESPN] Duke survives Siena scare — Duke barely escaped a 16-seed upset in the first round of the NCAA Tournament...
1. [Ball Durham] Siena debacle exposes Duke's weaknesses — The Blue Devils trailed by 11 at halftime against...
```

**Prompt design decisions**:
- "CLUSTER AGGRESSIVELY" + concrete example ("Duke vs Siena prediction + Duke debacle vs Siena + Duke survives Siena = ONE cluster") — without this, the AI creates too many small clusters and standalone articles
- Includes 120-char snippet alongside title — title alone was insufficient for the AI to detect same-game coverage across different angles (preview vs recap vs odds)
- "Standalone articles should be rare" — explicitly sets the threshold for what warrants its own cluster
- Returns JSON with `articleIndices` referencing the input list position — avoids string matching ambiguity

**Validation**: Clusters with <2 articles are discarded. Invalid indices filtered. Markdown fences stripped before JSON parse.

### Summarization Prompt

**Model**: `claude-haiku-4-5-20251001` | **Max tokens**: 2000

**Input format** (per source):
```
[1] ESPN: "Duke survives Siena scare"
Full article text here, up to 3000 chars...

[2] Ball Durham: "Siena debacle exposes Duke's weaknesses"
Full article text here...
```

**Prompt design decisions**:
- **Grounding rule** is the single most important line: *"You may ONLY state facts that are EXPLICITLY present in the source text above."* Without this, Haiku hallucinates plausible-sounding details (dates, venues, stats) not in the sources.
- **"Do not pad with invented details"** — prevents the AI from filling gaps when sources are thin
- **Citation format `[1][2]`** — inline numbers after key facts, rendered as clickable superscript badges in the UI
- **"NEVER mention source names in the text"** — forces citations instead of "According to ESPN..." style attribution, which felt too RSS-reader-ish
- **Key points only for single-source stories** — multi-source stories have rich summaries; single-source stories get bullet points since the summary is just the snippet
- **Dynamic paragraph length** — "1-3 paragraphs if fullText present, else 1-2" — adapts to available content depth

**Fallback**: On any AI error, returns cluster headline + concatenated snippets. The app never breaks.

## Caching Architecture

```
Request hits Vercel serverless function
         │
         ▼
    L1: In-memory cache (same isolate)
    cachedFeed variable
         │ miss
         ▼
    L2: Upstash Redis (shared across all isolates)
    GET "story-feed" → check storedAt < 10 min ago
         │ miss or stale
         ▼
    Distributed Lock (Redis SET NX)
    ┌─────────────────────────────┐
    │ Lock acquired?              │
    │  YES → Run pipeline         │
    │        Write to Redis       │
    │        Release lock         │
    │  NO  → Wait 3s             │
    │        Retry Redis read     │
    │        Still empty? Run     │
    │        pipeline as fallback │
    └─────────────────────────────┘
```

### TTL Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| Soft TTL | 10 min | Returns null from Redis → triggers pipeline re-run |
| Hard TTL | 30 min | Redis auto-expiry — absolute safety net |
| Previous feed TTL | 2 hours | Old story IDs stay resolvable during cache transitions |
| Lock TTL | 60 sec | Auto-releases if process crashes mid-pipeline |

### Why this design

The core problem: AI clustering is non-deterministic. Two serverless instances running the pipeline independently will produce different clusters → different story IDs → "Story not found" errors. The shared Redis cache ensures all isolates see the same story IDs for any given 10-minute window.

The distributed lock prevents thundering herd — when the cache expires, only one isolate runs the expensive pipeline (~20s with enrichment + AI calls). Others wait and read the result.

The previous feed fallback handles the transition window: when a new pipeline run produces new story IDs, users with links to old IDs can still access those stories for up to 2 hours.

### Critical Next.js compatibility note

`@upstash/redis` defaults to `cache: "no-store"` on its internal fetch calls. This triggers Next.js's `DYNAMIC_SERVER_USAGE` error on ISR/static routes. **Fix**: Initialize Redis with `cache: "default"`:

```typescript
redis = new Redis({ url, token, cache: "default" });
```

## Key Constants (Tuning Guide)

| Constant | File | Value | What it controls |
|----------|------|-------|------------------|
| `MAX_PER_SOURCE` | aggregator.ts | 15 | Articles per RSS source before capping |
| Clustering cap | clusterer.ts | 40 | Max articles sent to clustering AI |
| `ARTICLES_PER_CLUSTER` | story-pipeline.ts | 2 | Articles enriched with full text per cluster |
| `MAX_FETCHES` | story-pipeline.ts | 10 | Total article text fetches per pipeline run |
| Text truncation | reader.ts / summarizer.ts | 3000 chars | Full text cap per article (at sentence boundary) |
| Snippet length | aggregator.ts | 200 chars | RSS snippet length |
| Snippet in clustering | clusterer.ts | 120 chars | Snippet length sent to clustering AI |
| Redundancy threshold | story-pipeline.ts | 60% | Keyword overlap to filter standalone articles |
| ISR revalidation | page.tsx / story page | 600s (10 min) | How often pages re-render |
| RSS timeout | aggregator.ts | 8000ms | Per-feed fetch timeout |
| Article fetch timeout | reader.ts | 8000ms | Per-article text extraction timeout |

## Design Decisions & Lessons Learned

### JSDOM → linkedom
**Problem**: JSDOM exceeded Vercel's serverless function memory limit (500 Internal Server Error on article pages).
**Fix**: Replaced with `linkedom` — lighter DOM implementation that works with Readability in serverless.

### AI hallucination → grounded prompt + enrichment
**Problem**: With only 200-char RSS snippets, Haiku invented plausible details (wrong venues, stats, game details).
**Fix**: Two-pronged: (1) Added strict grounding rule to prompt, (2) Fetch actual article text (up to 3000 chars) for top sources via Readability before summarization.

### Beat writer voice → straight news
**Problem**: Initial prompt asked for "beat writer" personality. Output felt like AI trying to fake a personality — obvious and off-putting.
**Fix**: Switched to Perplexity-style straight news synthesis with inline citations. No personality, just facts.

### Source attribution → inline citations
**Problem**: Summary text was full of "According to ESPN..." and "as reported by Yahoo Sports..." — felt like an RSS reader, not a briefing.
**Fix**: Replaced with `[1][2]` inline citations rendered as clickable superscript badges linking to original articles.

### `unstable_cache` → Upstash Redis
**Problem**: Next.js `unstable_cache` persisted stale data across deployments and had unpredictable timer sync across serverless isolates.
**Fix**: External Redis with explicit soft/hard TTLs and distributed locking. Graceful fallback if Redis is down.

### Redundant standalone filtering
**Problem**: After clustering, many standalone articles rehashed the same topics already covered in clusters.
**Fix**: Check keyword overlap between standalone article titles and cluster headlines. >60% overlap = redundant, filtered out.

## Design System

### Colors (CSS variables in `globals.css`)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-cobalt` | `#00059F` | Primary brand, headlines, links |
| `--color-cobalt-dark` | `#272968` | Dark accents, hover states |
| `--color-cobalt-med` | `#696CC3` | Medium accents |
| `--color-cobalt-lite` | `#999BD9` | Light accents, focus rings |
| `--color-sky` | `#D0D2FB` | Secondary brand, badges, borders |
| `--color-sky-light` | `#F0F0FC` | Light backgrounds |
| `--color-buzzer` | `#F94B4B` | Alert/error red |
| `--color-bg-page` | `#FDFDFE` | Page background |
| `--color-bg-card` | `#FFFFFF` | Card background |

### Typography

| Stack | Fonts | Usage |
|-------|-------|-------|
| Display | Stout-Condensed → Stout → Chakra Petch | Headlines, section titles (uppercase, bold) |
| Body | Apercu → Poppins | Body text, UI elements |
| Mono | Apercu-Mono → Courier New | Source labels, metadata |

### Component Classes

| Class | Description |
|-------|-------------|
| `.fs-card` | Card with offset shadow, hover lift animation |
| `.fs-pill` | Small rounded badge (category labels, source counts) |
| `.fs-scroll` | Horizontal scroll container with hidden scrollbar |
| `.font-display` | Display font stack + uppercase + letter-spacing |
