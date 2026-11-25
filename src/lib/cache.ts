/**
 * Cache-through helper.
 * MVP: no cache layer (returns fn() directly).
 * v2: Add Redis/Upstash backing store.
 */

import { logger } from '@/lib/logger'

export async function getCachedOrGenerate<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  // MVP: no cache, just execute
  // v2: check Redis first, return cached if fresh, else generate + store
  logger.debug({ key, ttlSeconds }, 'Cache miss (no cache layer in MVP)')
  return fn()
}
