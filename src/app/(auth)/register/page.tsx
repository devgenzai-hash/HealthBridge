'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isValidIndianPhone } from '@/lib/utils'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    dob: '',
    language: 'en',
  })
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'info' | 'otp'>('info')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = useCallback(async () => {
    setError(null)

    if (!form.name.trim()) {
      setError('Please enter your name')
      return
    }
    if (!isValidIndianPhone(form.phone)) {
      setError('Please enter a valid 10-digit phone number')
      return
    }

    const fullPhone = `+91${form.phone.replace(/\D/g, '')}`

    setLoading(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      })

      if (otpError) {
        setError(otpError.message)
        return
      }

      setStep('otp')
    } catch {
      setError('Failed to send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [form, supabase])

  const handleVerifyAndCreate = useCallback(async () => {
    setError(null)

    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP')
      return
    }

    const fullPhone = `+91${form.phone.replace(/\D/g, '')}`

    setLoading(true)
    try {
      const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otp,
        type: 'sms',
      })

      if (verifyError || !authData.user) {
        setError('Invalid OTP. Please try again.')
        return
      }

      // Create patient profile
      const { error: patientError } = await supabase.from('patients').insert({
        user_id: authData.user.id,
        name: form.name.trim(),
        phone: form.phone.replace(/\D/g, ''),
        date_of_birth: form.dob || null,
        language_pref: form.language,
      })

      if (patientError && !patientError.message.includes('duplicate')) {
        setError('Failed to create profile. Please try again.')
        return
      }

      // Set role
      await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: 'patient',
      })

      router.push('/home')
    } catch {
      setError('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [otp, form, supabase, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white">
            H
          </div>
          <h1 className="text-2xl font-bold text-text">Create Account</h1>
          <p className="mt-1 text-sm text-muted">Your health records, always with you</p>
        </div>

        {/* Form */}
        <div className="card">
          {step === 'info' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-text">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Enter your full name"
                  className="input"
                  autoComplete="name"
                />
              </div>

              <div>
                <label htmlFor="reg-phone" className="mb-1.5 block text-sm font-medium text-text">
                  Phone Number
                </label>
                <div className="flex">
                  <span className="flex items-center rounded-l-lg border border-r-0 border-border bg-bg px-3 text-sm text-muted">
                    +91
                  </span>
                  <input
                    id="reg-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    placeholder="98765 43210"
                    className="input !rounded-l-none"
                    maxLength={10}
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="dob" className="mb-1.5 block text-sm font-medium text-text">
                  Date of Birth <span className="text-muted">(optional)</span>
                </label>
                <input
                  id="dob"
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="language" className="mb-1.5 block text-sm font-medium text-text">
                  Preferred Language
                </label>
                <select
                  id="language"
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  className="input"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.nativeName} ({lang.name})
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}

              <button
                onClick={handleRegister}
                disabled={loading || !form.name || form.phone.length !== 10}
                className="btn-primary w-full"
              >
                {loading ? 'Sending OTP...' : 'Continue'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="reg-otp" className="mb-1.5 block text-sm font-medium text-text">
                  Enter OTP
                </label>
                <p className="mb-3 text-xs text-muted">
                  Sent to +91 {form.phone.slice(0, 5)} {form.phone.slice(5)}
                </p>
                <input
                  id="reg-otp"
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

              {error && <p className="text-xs text-danger">{error}</p>}

              <button
                onClick={handleVerifyAndCreate}
                disabled={loading || otp.length !== 6}
                className="btn-primary w-full"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <button
                onClick={() => { setStep('info'); setOtp(''); setError(null) }}
                className="w-full text-center text-sm text-primary"
              >
                Back to registration
              </button>
            </div>
          )}
        </div>

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
