/**
 * In-memory rate limiter for API routes.
 * No Redis required — uses a simple Map with sliding window.
 *
 * Limitations:
 * - Resets on server restart (acceptable for MVP)
 * - Per-instance only (not shared across Vercel serverless instances)
 * - v2: Replace with Redis-based rate limiter (Upstash)
 */

import { logger } from '@/lib/logger'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number
  /** Window size in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check if a request is within rate limits.
 *
 * @param identifier - Unique key (e.g., userId, IP, phone number)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed + remaining quota
 *
 * @example
 * const result = checkRateLimit(userId, { maxRequests: 10, windowSeconds: 60 })
 * if (!result.allowed) {
 *   return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
 * }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const entry = rateLimitStore.get(identifier)

  // No entry or window expired — allow and reset
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + windowMs }
  }

  // Within window — check count
  if (entry.count >= config.maxRequests) {
    logger.warn(
      { identifier, count: entry.count, maxRequests: config.maxRequests },
      'Rate limit exceeded'
    )
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  // Increment and allow
  entry.count++
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

/**
 * AI-specific rate limiter.
 * Default: 10 AI calls per minute per user.
 */
export function checkAIRateLimit(userId: string): RateLimitResult {
  const maxRequests = parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE || '10', 10)
  return checkRateLimit(`ai:${userId}`, { maxRequests, windowSeconds: 60 })
}

/**
 * OTP rate limiter.
 * Max 5 attempts per phone per hour. Lock 1 hour after 5 failures.
 */
export function checkOTPRateLimit(phone: string): RateLimitResult {
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10)
  const lockoutMinutes = parseInt(process.env.OTP_LOCKOUT_MINUTES || '60', 10)
  return checkRateLimit(`otp:${phone}`, { maxRequests: maxAttempts, windowSeconds: lockoutMinutes * 60 })
}
