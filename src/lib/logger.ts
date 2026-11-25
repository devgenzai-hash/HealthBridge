/**
 * Structured logger for HealthBridge.
 * Uses pino for structured JSON logging in production,
 * pino-pretty for readable dev output.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info({ userId, action: 'report_upload' }, 'Patient uploaded report')
 *   logger.error({ err, appointmentId }, 'Failed to generate briefing')
 */

import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'
const isServer = typeof window === 'undefined'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {
        // Production: structured JSON for log aggregation
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        // Development: human-readable (transport disabled in Next.js due to worker thread incompatibility)
        // Use browser: { write } for basic formatting instead
      }),
  browser: !isServer ? { write: (o: object) => console.log(o) } : undefined,
  base: {
    service: 'healthbridge',
    env: process.env.NODE_ENV || 'development',
  },
})

/**
 * Create a child logger with bound context fields.
 * Useful for request-scoped logging.
 *
 * @example
 * const reqLogger = createChildLogger({ requestId, userId })
 * reqLogger.info('Processing report upload')
 */
export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings)
}

/**
 * Browser-safe logger for client components.
 * Sends structured logs that can be captured by error reporting tools.
 */
export const clientLogger = {
  info: (data: Record<string, unknown>, msg?: string) => {
    if (!isProduction) console.info(`[HealthBridge] ${msg || ''}`, data)
  },
  warn: (data: Record<string, unknown>, msg?: string) => {
    console.warn(`[HealthBridge] ${msg || ''}`, data)
  },
  error: (data: Record<string, unknown>, msg?: string) => {
    console.error(`[HealthBridge] ${msg || ''}`, data)
  },
}
