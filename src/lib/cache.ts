/**
 * cache.ts — Upstash Redis Semantic Cache
 *
 * Uses cosine similarity on query embeddings to intercept near-duplicate
 * spectator questions (e.g. "Where's the restroom?" ≈ "Where is the bathroom?").
 *
 * Setup:
 *   UPSTASH_REDIS_REST_URL=https://....upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=...
 *
 * Cache key format: `vf:cache:{prefix}:{hash}`
 * TTL: 5 minutes (venue context changes frequently during events)
 */

// Lazy-import Upstash Redis to avoid breaking SSR when env vars are absent
let _redis: import('@upstash/redis').Redis | null = null;

async function getRedis(): Promise<import('@upstash/redis').Redis | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!_redis) {
    const { Redis } = await import('@upstash/redis');
    _redis = new Redis({
      url  : process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

// ── Configuration ─────────────────────────────────────────────────────────────
const TTL_SECONDS          = 300;   // 5 minutes
const SIMILARITY_THRESHOLD = 0.92;  // cosine similarity threshold for cache hit
const MAX_CACHE_SCAN       = 50;    // max keys to scan per lookup

// ── Cosine similarity ─────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot  = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ── Cache interface ───────────────────────────────────────────────────────────

interface CacheEntry {
  embedding: number[];
  response : string;
  createdAt: number;
}

/**
 * Try to find a semantically equivalent cached response.
 *
 * @param embedding  Query embedding vector (from Gemini text-embedding-004)
 * @param prefix     Namespace prefix (e.g. 'chat', 'route')
 */
export async function getCachedResponse(
  embedding: number[],
  prefix   : string,
): Promise<string | null> {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const pattern = `vf:cache:${prefix}:*`;
    const keys    = await redis.keys(pattern);

    for (const key of keys.slice(0, MAX_CACHE_SCAN)) {
      const entry = await redis.get<CacheEntry>(key);
      if (entry && cosineSimilarity(embedding, entry.embedding) >= SIMILARITY_THRESHOLD) {
        return entry.response;
      }
    }
  } catch (err) {
    console.warn('[Cache] Redis lookup failed:', err);
  }

  return null;
}

/**
 * Store a response in the semantic cache.
 *
 * @param prefix    Namespace prefix
 * @param key       Unique key for this query (hash or UUID)
 * @param embedding The query's embedding vector
 * @param response  The LLM response text to cache
 */
export async function setCachedResponse(
  prefix   : string,
  key      : string,
  embedding: number[],
  response : string,
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  try {
    const entry: CacheEntry = { embedding, response, createdAt: Date.now() };
    await redis.set(`vf:cache:${prefix}:${key}`, JSON.stringify(entry), { ex: TTL_SECONDS });
  } catch (err) {
    console.warn('[Cache] Redis set failed:', err);
  }
}

/**
 * Generate a simple hash key for a query string (for cache key storage).
 */
export function hashQuery(query: string): string {
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    hash = ((hash << 5) - hash) + query.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
