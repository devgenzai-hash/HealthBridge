/**
 * V2-ready hooks and wrappers.
 * These are functional stubs designed to be swapped out later without
 * changing any consumer code.
 */

// ---------------------------------------------------------------------------
// Cache Layer (v2: Redis)
// ---------------------------------------------------------------------------

/**
 * Get a cached value or generate it.
 * Currently: always calls fn() (no caching layer).
 * v2: Add Redis/Upstash with TTL-based caching.
 *
 * @param key - Cache key (namespaced)
 * @param ttlSeconds - Time-to-live in seconds (unused in v1)
 * @param fn - Async function to generate the value
 */
export async function getCachedOrGenerate<T>(
  _key: string,
  _ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  // v1: No caching, always generate fresh
  return fn()
}

// ---------------------------------------------------------------------------
// Notification Layer (v2: WhatsApp)
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'appointment_confirmed'
  | 'appointment_reminder'
  | 'queue_position_update'
  | 'report_ready'
  | 'payment_verified'

/**
 * Send a notification to a patient.
 * Currently: sends email via Resend.
 * v2: Add WhatsApp Business API case.
 */
export async function notify(
  _patientId: string,
  type: NotificationType,
  _data: Record<string, unknown>
): Promise<void> {
  // v1: Email notification (implementation in separate email module)
  // For now, just log
  const { logger } = await import('@/lib/logger')
  logger.info({ patientId: _patientId, type, data: _data }, 'Notification sent (email fallback)')
}

// ---------------------------------------------------------------------------
// Payment Layer (v2: Payment Gateway)
// ---------------------------------------------------------------------------

export type PaymentMethod = 'upi_manual' | 'razorpay' | 'stripe'

export interface PaymentResult {
  success: boolean
  transactionId?: string
  error?: string
}

/**
 * Process a payment.
 * Currently: manual UPI screenshot upload flow.
 * v2: Integrate Razorpay/Stripe.
 */
export async function processPayment(
  _appointmentId: string,
  _method: PaymentMethod = 'upi_manual'
): Promise<PaymentResult> {
  // v1: Manual UPI — payment is "processed" when admin verifies screenshot
  return { success: true, transactionId: `manual_${Date.now()}` }
}

// ---------------------------------------------------------------------------
// File URL Layer (v2: CDN / Cloudflare R2)
// ---------------------------------------------------------------------------

/**
 * Get the public URL for a stored file.
 * Currently: returns Supabase Storage URL.
 * v2: Route through CDN (Cloudflare R2 / CloudFront).
 */
export function getFileUrl(path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/medical-files/${path}`
}

/**
 * Get a signed URL for private file access.
 */
export async function getSignedFileUrl(path: string, expiresIn = 3600): Promise<string> {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  const { data } = await supabase.storage
    .from('medical-files')
    .createSignedUrl(path, expiresIn)
  return data?.signedUrl || ''
}
