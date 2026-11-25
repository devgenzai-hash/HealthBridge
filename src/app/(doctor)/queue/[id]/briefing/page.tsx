'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Brain, AlertTriangle, TrendingUp, Pill, HelpCircle, Loader2 } from 'lucide-react'

interface Briefing {
  briefing: string
  key_metrics: Record<string, string | null>
  recent_visits: string[]
  current_medications: string[]
  suggested_questions: string[]
  flags: string[]
  positive_trends: string[]
}

export default function DoctorBriefingPage() {
  const params = useParams()
  const router = useRouter()
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBriefing() {
      try {
        const response = await fetch(`/api/ai/briefing/${params.id}`)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to generate briefing')
        }
        const data = await response.json()
        setBriefing(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load briefing')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) fetchBriefing()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-primary" />
        <p className="text-sm text-muted">Generating AI briefing...</p>
      </div>
    )
  }

  if (error || !briefing) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-danger">{error || 'Briefing not available'}</p>
        <button onClick={() => router.back()} className="text-sm text-primary">Go back</button>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-card">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-primary" />
          <h1 className="text-lg font-bold text-text">AI Briefing</h1>
        </div>
      </div>

      {/* Briefing Text */}
      <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm leading-relaxed text-text">{briefing.briefing}</p>
      </div>

      {/* Key Metrics Grid */}
      {Object.entries(briefing.key_metrics).some(([, v]) => v) && (
        <div className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase text-muted">Key Metrics</h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(briefing.key_metrics)
              .filter(([, value]) => value)
              .map(([key, value]) => (
                <div key={key} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[10px] uppercase text-muted">{key.replace('_', ' ')}</p>
                  <p className="mt-0.5 text-sm font-bold text-text">{value}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Flags */}
      {briefing.flags.length > 0 && (
        <div className="mb-4 rounded-xl bg-danger/5 border border-danger/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={14} className="text-danger" />
            <span className="text-xs font-semibold text-danger">Flags</span>
          </div>
          <ul className="space-y-1">
            {briefing.flags.map((flag, i) => (
              <li key={i} className="text-xs text-text">• {flag}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Positive Trends */}
      {briefing.positive_trends.length > 0 && (
        <div className="mb-4 rounded-xl bg-success/5 border border-success/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp size={14} className="text-success" />
            <span className="text-xs font-semibold text-success">Positive Trends</span>
          </div>
          <ul className="space-y-1">
            {briefing.positive_trends.map((trend, i) => (
              <li key={i} className="text-xs text-text">• {trend}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Current Medications */}
      {briefing.current_medications.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <Pill size={14} className="text-muted" />
            <span className="text-xs font-semibold text-muted">Current Medications</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {briefing.current_medications.map((med, i) => (
              <span key={i} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-text">
                {med}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Questions */}
      {briefing.suggested_questions.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <HelpCircle size={14} className="text-primary" />
            <span className="text-xs font-semibold text-primary">Suggested Questions</span>
          </div>
          <ul className="space-y-2">
            {briefing.suggested_questions.map((q, i) => (
              <li key={i} className="rounded-lg border border-border bg-card p-3 text-xs text-text">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent Visits */}
      {briefing.recent_visits.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted">Recent Visits</h2>
          <ul className="space-y-2">
            {briefing.recent_visits.map((visit, i) => (
              <li key={i} className="rounded-lg border border-border bg-card p-3 text-xs text-text">
                {visit}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
