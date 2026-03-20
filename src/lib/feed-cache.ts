import { Redis } from "@upstash/redis";
import type { StoryFeed } from "./types";

const FEED_KEY = "story-feed";
const PREV_FEED_KEY = "story-feed-prev";
const LOCK_KEY = "story-feed-lock";

const SOFT_TTL_MS = 10 * 60 * 1000; // 10 minutes — triggers re-run
const HARD_TTL_S = 30 * 60; // 30 minutes — KV auto-expiry
const PREV_TTL_S = 2 * 60 * 60; // 2 hours — keeps old story IDs resolvable
const LOCK_TTL_S = 60; // 1 minute — auto-release if process crashes

interface CachedEntry {
  feed: StoryFeed;
  storedAt: number; // epoch ms
}

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.warn("[FeedCache] No KV credentials found — running without shared cache");
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

/**
 * Read the current feed from KV. Returns null if missing or stale (>10 min old).
 */
export async function getCachedFeed(): Promise<StoryFeed | null> {
  const kv = getRedis();
  if (!kv) return null;

  try {
    const entry = await kv.get<CachedEntry>(FEED_KEY);
    if (!entry) return null;

    const age = Date.now() - entry.storedAt;
    if (age > SOFT_TTL_MS) {
      console.log(`[FeedCache] Cache stale (${Math.round(age / 1000)}s old)`);
      return null;
    }

    console.log(`[FeedCache] Cache hit (${Math.round(age / 1000)}s old, ${entry.feed.stories.length} stories)`);
    return entry.feed;
  } catch (err) {
    console.error("[FeedCache] Read error:", err);
    return null;
  }
}

/**
 * Write the current feed to KV. Also saves the previous feed for graceful transitions.
 */
export async function setCachedFeed(feed: StoryFeed): Promise<void> {
  const kv = getRedis();
  if (!kv) return;

  try {
    // Save current feed as "previous" before overwriting
    const existing = await kv.get<CachedEntry>(FEED_KEY);
    if (existing) {
      await kv.set(PREV_FEED_KEY, existing, { ex: PREV_TTL_S });
    }

    // Write new feed
    const entry: CachedEntry = { feed, storedAt: Date.now() };
    await kv.set(FEED_KEY, entry, { ex: HARD_TTL_S });

    console.log(`[FeedCache] Cached ${feed.stories.length} stories`);
  } catch (err) {
    console.error("[FeedCache] Write error:", err);
  }
}

/**
 * Read the previous pipeline run's feed (for resolving old story IDs).
 */
export async function getPreviousFeed(): Promise<StoryFeed | null> {
  const kv = getRedis();
  if (!kv) return null;

  try {
    const entry = await kv.get<CachedEntry>(PREV_FEED_KEY);
    return entry?.feed ?? null;
  } catch (err) {
    console.error("[FeedCache] Previous feed read error:", err);
    return null;
  }
}

/**
 * Try to acquire a distributed lock. Returns true if acquired.
 */
export async function acquireLock(): Promise<boolean> {
  const kv = getRedis();
  if (!kv) return true; // No KV = always "acquire" (run locally)

  try {
    const result = await kv.set(LOCK_KEY, Date.now(), { nx: true, ex: LOCK_TTL_S });
    return result === "OK";
  } catch (err) {
    console.error("[FeedCache] Lock error:", err);
    return true; // On error, proceed anyway
  }
}

/**
 * Release the distributed lock.
 */
export async function releaseLock(): Promise<void> {
  const kv = getRedis();
  if (!kv) return;

  try {
    await kv.del(LOCK_KEY);
  } catch {
    // Non-critical — lock will auto-expire
  }
}
