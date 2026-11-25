'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shield, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { clientLogger } from '@/lib/logger'

const OTP_LENGTH = 6

export default function OtpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const phone = searchParams.get('phone') || ''
  const email = searchParams.get('email') || ''
  const type = phone ? 'phone' : 'email'
  const identifier = phone || email

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(30)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Resend countdown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    setError('')

    // Auto-focus next input
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all digits entered
    if (newOtp.every((d) => d !== '') && newOtp.join('').length === OTP_LENGTH) {
      verifyOtp(newOtp.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (pasted.length === OTP_LENGTH) {
      const digits = pasted.split('')
      setOtp(digits)
      verifyOtp(pasted)
    }
  }

  const verifyOtp = async (code: string) => {
    setLoading(true)
    setError('')

    try {
      const verifyPayload = type === 'phone'
        ? { phone, token: code, type: 'sms' as const }
        : { email, token: code, type: 'email' as const }

      const { error: verifyError } = await supabase.auth.verifyOtp(verifyPayload)

      if (verifyError) {
        setError(verifyError.message === 'Token has expired or is invalid'
          ? 'Invalid or expired code. Please try again.'
          : verifyError.message
        )
        setOtp(Array(OTP_LENGTH).fill(''))
        inputRefs.current[0]?.focus()
        return
      }

      // Success — redirect based on role
      router.push('/home')
    } catch (err) {
      clientLogger.error({ err }, 'OTP verification failed')
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setResendCooldown(30)
    setError('')

    try {
      if (type === 'phone') {
        await supabase.auth.signInWithOtp({ phone })
      } else {
        await supabase.auth.signInWithOtp({ email })
      }
    } catch (err) {
      clientLogger.error({ err }, 'OTP resend failed')
      setError('Failed to resend code.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-6 pt-12">
      <Link href="/login" className="mb-8 flex items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} /> Back to login
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Shield size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">Verify OTP</h1>
          <p className="text-xs text-muted">
            Sent to {type === 'phone' ? `+91 ${phone.slice(-10)}` : email}
          </p>
        </div>
      </div>

      {/* OTP Input Boxes */}
      <div className="mb-6 flex justify-center gap-2" onPaste={handlePaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={loading}
            className="h-12 w-12 rounded-lg border border-border bg-card text-center text-lg font-bold text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="mb-4 text-center text-xs text-error">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="mb-4 flex items-center justify-center gap-2 text-xs text-muted">
          <Loader2 size={14} className="animate-spin" /> Verifying...
        </div>
      )}

      {/* Resend */}
      <div className="text-center">
        {resendCooldown > 0 ? (
          <p className="text-xs text-muted">Resend code in {resendCooldown}s</p>
        ) : (
          <button
            onClick={handleResend}
            className="text-xs font-medium text-primary hover:underline"
          >
            Resend OTP
          </button>
        )}
      </div>
    </div>
  )
}
