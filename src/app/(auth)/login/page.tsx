'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { isValidIndianPhone } from '@/lib/utils'

type AuthStep = 'phone' | 'otp'

export default function LoginPage() {
  const [step, setStep] = useState<AuthStep>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const isDev = process.env.NODE_ENV === 'development'

  const handleSendOTP = useCallback(async () => {
    setError(null)

    const cleanPhone = phone.replace(/\D/g, '')

    if (!isValidIndianPhone(phone)) {
      setError('Please enter a valid 10-digit Indian phone number')
      return
    }

    setLoading(true)
    try {
      if (isDev) {
        // DEV MODE: Skip Supabase phone OTP (provider not needed)
        setStep('otp')
      } else {
        const fullPhone = `+91${cleanPhone}`
        const { error: otpError } = await supabase.auth.signInWithOtp({
          phone: fullPhone,
        })

        if (otpError) {
          if (otpError.message.includes('rate')) {
            setError('Too many attempts. Please wait and try again.')
          } else {
            setError(otpError.message)
          }
          return
        }
        setStep('otp')
      }
    } catch {
      setError('Failed to send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [phone, supabase, isDev])

  const handleVerifyOTP = useCallback(async () => {
    setError(null)

    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP')
      return
    }

    const cleanPhone = phone.replace(/\D/g, '')
    const fullPhone = `+91${cleanPhone}`

    setLoading(true)
    try {
      let signedInUser: User | null = null

      if (isDev) {
        // DEV MODE: Accept "111111" as valid OTP, sign in via email workaround
        if (otp !== '111111') {
          setError('Dev mode: use OTP 111111')
          return
        }
        // Use dev login API to create session
        const res = await fetch('/api/auth/dev-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: fullPhone }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Dev login failed')
          return
        }
        // Sign in with the returned email credentials
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })
        if (signInError) {
          setError(signInError.message)
          return
        }
        signedInUser = signInData.user
      } else {
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          phone: fullPhone,
          token: otp,
          type: 'sms',
        })
        if (verifyError) {
          setError('Invalid OTP. Please try again.')
          return
        }
        signedInUser = verifyData.user
      }

      // Redirect based on role
      let user = signedInUser
      if (!user) {
        const { data } = await supabase.auth.getUser()
        user = data.user
      }

      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()

        switch (roleData?.role) {
          case 'doctor':
            router.push('/queue')
            break
          case 'admin':
            router.push('/dashboard')
            break
          default:
            router.push('/home')
        }
      }
    } catch {
      setError('Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [otp, phone, supabase, router, isDev])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white">
            H
          </div>
          <h1 className="text-2xl font-bold text-text">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Log in to HealthBridge</p>
        </div>

        {/* Form */}
        <div className="card">
          {step === 'phone' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-text">
                  Phone Number
                </label>
                <div className="flex">
                  <span className="flex items-center rounded-l-lg border border-r-0 border-border bg-bg px-3 text-sm text-muted">
                    +91
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    className="input !rounded-l-none"
                    maxLength={10}
                    autoComplete="tel"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-danger">{error}</p>
              )}

              <button
                onClick={handleSendOTP}
                disabled={loading || phone.length !== 10}
                className="btn-primary w-full"
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-text">
                  Enter OTP
                </label>
                <p className="mb-3 text-xs text-muted">
                  {isDev ? (
                    <>Dev mode — use OTP: <strong>111111</strong></>
                  ) : (
                    <>Sent to +91 {phone.slice(0, 5)} {phone.slice(5)}</>
                  )}
                </p>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="input text-center text-xl tracking-[0.5em]"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>

              {error && (
                <p className="text-xs text-danger">{error}</p>
              )}

              <button
                onClick={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
                className="btn-primary w-full"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                onClick={() => { setStep('phone'); setOtp(''); setError(null) }}
                className="w-full text-center text-sm text-primary"
              >
                Change phone number
              </button>
            </div>
          )}
        </div>

        {/* Register link */}
        <p className="mt-6 text-center text-sm text-muted">
          New to HealthBridge?{' '}
          <Link href="/register" className="font-medium text-primary">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
