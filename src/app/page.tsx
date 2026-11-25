/**
 * Marketing Landing Page
 */

import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white text-sm font-bold">
              H
            </div>
            <span className="text-lg font-bold text-text">HealthBridge</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary !min-h-[36px] !px-3 !py-1.5 text-sm">
              Log in
            </Link>
            <Link href="/register" className="btn-primary !min-h-[36px] !px-3 !py-1.5 text-sm">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-text sm:text-5xl">
          Your health record,
          <br />
          <span className="text-primary">always with you</span>
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-base text-muted">
          AI-powered clinic management for small Indian clinics. Patients get plain-language report explanations. Doctors get AI briefings before every consultation.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/register" className="btn-primary w-full sm:w-auto">
            Start Free Trial
          </Link>
          <Link href="#features" className="btn-secondary w-full sm:w-auto">
            See How It Works
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-card py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold text-text">Built for Indian Clinics</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-border p-6">
                <div className="mb-3 text-2xl">{feature.emoji}</div>
                <h3 className="mb-2 text-lg font-semibold text-text">{feature.title}</h3>
                <p className="text-sm text-muted">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="mb-4 text-2xl font-bold text-text">Simple Pricing</h2>
          <p className="mb-8 text-muted">One plan. All features. No per-patient charges.</p>
          <div className="mx-auto max-w-sm rounded-2xl border-2 border-primary bg-card p-8">
            <p className="text-sm font-medium text-primary">Clinic Plan</p>
            <p className="mt-2 text-4xl font-extrabold text-text">
              ₹2,500<span className="text-base font-normal text-muted">/month</span>
            </p>
            <ul className="mt-6 space-y-3 text-left text-sm text-text">
              <li className="flex items-center gap-2">✓ Unlimited patients</li>
              <li className="flex items-center gap-2">✓ AI report analysis</li>
              <li className="flex items-center gap-2">✓ Doctor AI briefings</li>
              <li className="flex items-center gap-2">✓ Digital queue management</li>
              <li className="flex items-center gap-2">✓ E-prescriptions</li>
              <li className="flex items-center gap-2">✓ Patient health journal</li>
              <li className="flex items-center gap-2">✓ Analytics dashboard</li>
            </ul>
            <Link href="/register" className="btn-primary mt-8 w-full">
              Start 14-Day Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted">
          <p>© {new Date().getFullYear()} HealthBridge. Made in India 🇮🇳</p>
          <p className="mt-1">DPDP Act 2023 compliant. Data stored in Mumbai (ap-south-1).</p>
        </div>
      </footer>
    </div>
  )
}

const FEATURES = [
  {
    emoji: '🤖',
    title: 'AI Report Analysis',
    description: 'Upload any lab report — get an instant plain-language explanation with color-coded test values.',
  },
  {
    emoji: '👨‍⚕️',
    title: 'Doctor AI Briefings',
    description: 'AI-generated patient summary before every consultation. Key metrics, trends, and suggested questions.',
  },
  {
    emoji: '📋',
    title: 'Digital Queue',
    description: 'No more chaos. Patients see their position in real-time. Doctors manage walk-ins with one tap.',
  },
  {
    emoji: '📊',
    title: 'Health Trends',
    description: 'Track HbA1c, blood sugar, BP over time. Beautiful charts that patients actually understand.',
  },
  {
    emoji: '💊',
    title: 'E-Prescriptions',
    description: 'Write prescriptions digitally. Generic alternatives suggested. Patients never lose their prescriptions.',
  },
  {
    emoji: '📱',
    title: 'Works Offline',
    description: 'Install on any phone — works like a native app. Cached reports available even without internet.',
  },
]
