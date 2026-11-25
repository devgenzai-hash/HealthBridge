/**
 * Payment processing abstraction.
 * MVP: Manual UPI screenshot verification only.
 * v2: Integrate Razorpay/PhonePe payment gateway.
 */

import { logger } from '@/lib/logger'

export type PaymentMethod = 'upi_manual' | 'razorpay' | 'phonepe' | 'cash'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

interface PaymentResult {
  success: boolean
  status: PaymentStatus
  transactionId?: string
  error?: string
}

/**
 * Process a payment for an appointment.
 * MVP: UPI screenshot upload only — admin manually verifies.
 * v2: Gateway integration with automatic verification.
 */
export async function processPayment(
  appointmentId: string,
  method: PaymentMethod,
  metadata?: { screenshotUrl?: string; amount?: number }
): Promise<PaymentResult> {
  logger.info({ appointmentId, method }, 'Processing payment')

  switch (method) {
    case 'upi_manual':
      // MVP: just mark as pending for admin review
      return {
        success: true,
        status: 'pending',
      }

    case 'cash':
      return {
        success: true,
        status: 'paid',
        transactionId: `cash_${Date.now()}`,
      }

    case 'razorpay':
    case 'phonepe':
      // v2: integrate with payment gateway SDK
      logger.warn({ method }, 'Payment gateway not yet integrated')
      return {
        success: false,
        status: 'failed',
        error: 'Payment gateway not available in MVP',
      }

    default:
      return { success: false, status: 'failed', error: 'Unknown payment method' }
  }
}
