/**
 * Notification abstraction layer.
 * MVP: email via Resend (if configured), otherwise log-only.
 * v2: Add WhatsApp Business API channel.
 */

import { logger } from '@/lib/logger'

export type NotificationType =
  | 'appointment_reminder'
  | 'queue_position_update'
  | 'report_ready'
  | 'prescription_ready'
  | 'payment_confirmed'

interface NotifyPayload {
  title: string
  body: string
  data?: Record<string, unknown>
}

export async function notify(
  patientId: string,
  type: NotificationType,
  payload: NotifyPayload
): Promise<void> {
  logger.info({ patientId, type, title: payload.title }, 'Notification dispatched')

  // MVP: attempt email if Resend is configured
  if (process.env.RESEND_API_KEY) {
    try {
      // v2: look up patient email, send via Resend
      // For now, just log that we would send
      logger.info({ patientId, type }, 'Would send email notification (Resend configured)')
    } catch (err) {
      logger.error({ err, patientId, type }, 'Email notification failed')
    }
  }

  // v2: Add WhatsApp channel here
  // if (process.env.WHATSAPP_API_KEY) { ... }
}
