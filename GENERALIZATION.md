# Generalizing to Any School

This prototype is built for Duke. Here's how to adapt it for any program.

## What's School-Specific

| Component | Duke-specific content | Where it lives |
|-----------|----------------------|----------------|
| Feed URLs | Bing queries for "Duke Blue Devils", direct Duke blog RSS | `src/lib/feeds.ts` |
| Keywords | "duke", "blue devils", "cameron indoor", "jon scheyer", etc. | `src/lib/feeds.ts` |
| AI prompts | "Duke sports news briefing", "Duke athletics" | `clusterer.ts`, `summarizer.ts` |
| Colors | Cobalt `#00059F`, Sky `#D0D2FB` | `globals.css` `:root` |
| Metadata | "Duke Sports Feed", "Blue Devils" | `layout.tsx` |
| Logo | Fanstake logo (shared) | `NavBar.tsx` |

Everything else — the pipeline, caching, article extraction, UI components — is school-agnostic.

## Suggested Config Structure

Create a `program-config.ts` that drives everything:

```typescript
interface ProgramConfig {
  school: {
    name: string;           // "Duke"
    mascot: string;         // "Blue Devils"
    shortName: string;      // "Duke"
  };

  feeds: {
    name: string;
    url: string;
    category: "basketball" | "football" | "all-sports" | "conference";
    bingNews?: boolean;
    schoolSpecific?: boolean;
  }[];

  keywords: string[];       // ["duke", "blue devils", "cameron indoor", ...]

  theme: {
    primary: string;        // "#00059F"
    primaryDark: string;    // "#272968"
    primaryMed: string;     // "#696CC3"
    primaryLite: string;    // "#999BD9"
    secondary: string;      // "#D0D2FB"
    secondaryLight: string; // "#F0F0FC"
  };

  meta: {
    title: string;
    description: string;
  };
}
```

## Feed Strategy

### Bing News (works for any school)

Bing News RSS is the primary discovery mechanism. Query pattern:

```
https://www.bing.com/news/search?q={school}+{sport}&format=rss&count=30
```

Examples:
- `Duke+Blue+Devils+basketball` → ESPN, Yahoo, CBS, local outlets
- `North+Carolina+Tar+Heels+football` → same broad coverage
- `%22Alabama+Crimson+Tide%22+sports` → quoted for precision

Bing returns articles from dozens of sources with their real URLs — no fixed RSS list needed.

### Direct RSS (school-specific, optional)

Some schools have insider blogs with RSS feeds worth adding:
- Fan blogs (e.g., Ball Durham for Duke, Tar Heel Blog for UNC)
- Official athletic sites (e.g., goduke.com)
- SB Nation team sites

These require manual discovery per school. They add depth but aren't required — Bing covers the major outlets.

## Prompt Adaptation

### Clustering prompt

Replace these Duke-specific strings:
```diff
- "You are a news editor clustering articles for a Duke sports news briefing"
+ "You are a news editor clustering articles for a {school.name} sports news briefing"

- "These are all about Duke sports"
+ "These are all about {school.name} sports"

- Example: "Duke vs Siena prediction"
+ Example: "{school.name} vs {opponent} prediction"
```

### Summarization prompt

```diff
- "synthesizing sources about Duke athletics"
+ "synthesizing sources about {school.name} athletics"
```

The grounding rule, citation format, and key points logic are school-agnostic — no changes needed.

## Theming

The design system uses CSS variables in `globals.css`. To theme for a new school:

1. Replace the `:root` color values:
```css
:root {
  --color-cobalt: {primary};        /* School primary color */
  --color-cobalt-dark: {dark};      /* Darker shade */
  --color-cobalt-med: {medium};     /* Medium shade */
  --color-cobalt-lite: {light};     /* Light shade */
  --color-sky: {secondary};         /* Secondary / accent */
  --color-sky-light: {secondaryLight}; /* Light accent for backgrounds */
}
```

2. Shadows and borders reference `--color-sky` — they'll adapt automatically.

3. For dynamic theming (multi-tenant), inject CSS variables at runtime from config instead of hardcoding in `:root`.

## Multi-Tenant Architecture Options

### Option A: Separate deployments per school (simplest)

- One repo, one config file per school
- Deploy as separate Vercel projects: `duke-feed.vercel.app`, `unc-feed.vercel.app`
- Each gets its own Redis cache, env vars, domain
- **Pros**: Zero cross-contamination, independent scaling, simple
- **Cons**: More deployments to manage, duplicated infra

### Option B: Single app with route params

- URL pattern: `/duke/`, `/unc/`, `/alabama/`
- Config loaded from `program-configs/{slug}.ts`
- Single Redis cache with namespaced keys: `duke:story-feed`, `unc:story-feed`
- CSS variables injected per-route
- **Pros**: Single deployment, shared infra
- **Cons**: More complex routing, shared failure domain

### Option C: Config-driven build (recommended for Fanstake)

- Single codebase, build-time config injection via env var: `PROGRAM=duke`
- `next.config.ts` reads program config and sets metadata, rewrites, etc.
- Deploy one Vercel project per school, each with different `PROGRAM` env var
- **Pros**: Clean separation at build time, each deploy is optimized for one school, simple codebase
- **Cons**: Still multiple deployments (but automated via CI)

### Recommendation

Start with **Option A** (separate deploys) to validate across 3-5 schools. Migrate to **Option C** once the config structure stabilizes. Option B only makes sense at 50+ schools where deployment count becomes a management burden.

## Implementation Checklist

- [ ] Extract Duke-specific values from `feeds.ts` into a config file
- [ ] Parameterize AI prompts with school name from config
- [ ] Create CSS variable injection from config theme colors
- [ ] Update `layout.tsx` metadata from config
- [ ] Add `PROGRAM` env var and config loader to `next.config.ts`
- [ ] Test with a second school (e.g., UNC, Alabama) to validate generalization
- [ ] Set up CI/CD to deploy multiple school configs from one repo
