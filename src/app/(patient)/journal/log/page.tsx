'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Check } from 'lucide-react'

const CATEGORY_CONFIG: Record<string, { label: string; unit: string; placeholder: string; contexts: string[] }> = {
  blood_sugar: { label: 'Blood Sugar', unit: 'mg/dL', placeholder: '120', contexts: ['Fasting', 'Post-meal (2hr)', 'Random', 'Before bed'] },
  bp: { label: 'Blood Pressure', unit: 'mmHg', placeholder: '120/80', contexts: ['Morning', 'Evening', 'After rest', 'After exercise'] },
  weight: { label: 'Weight', unit: 'kg', placeholder: '68.5', contexts: ['Morning (empty stomach)', 'Evening'] },
  steps: { label: 'Steps', unit: 'steps', placeholder: '5000', contexts: ['Daily total', 'Morning walk', 'Evening walk'] },
  sleep: { label: 'Sleep', unit: 'hours', placeholder: '7.5', contexts: ['Night sleep', 'Including nap'] },
  water: { label: 'Water', unit: 'glasses', placeholder: '8', contexts: ['Full day', 'Until now'] },
  mood: { label: 'Mood', unit: '', placeholder: 'Good', contexts: ['Morning', 'Afternoon', 'Evening'] },
  symptom: { label: 'Symptoms', unit: '', placeholder: 'Headache, mild', contexts: ['New symptom', 'Ongoing', 'Improving', 'Worsening'] },
}

function getConfigForCategory(category: string) {
  if (CATEGORY_CONFIG[category]) return CATEGORY_CONFIG[category]
  // Check localStorage for custom vitals
  try {
    const stored = localStorage.getItem('hb_custom_vitals')
    if (stored) {
      const customs = JSON.parse(stored)
      const custom = customs.find((c: { id: string }) => c.id === category)
      if (custom) {
        return { label: custom.label, unit: custom.unit || '', placeholder: '0', contexts: ['Morning', 'Evening', 'Random'] }
      }
    }
  } catch { /* ignore */ }
  // Fallback for unknown categories
  return { label: category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), unit: '', placeholder: '0', contexts: ['Morning', 'Evening'] }
}

export default function JournalLogPage() {
  const searchParams = useSearchParams()
  const category = searchParams.get('category') || 'blood_sugar'
  const config = getConfigForCategory(category)

  const { patientId } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [value, setValue] = useState('')
  const [context, setContext] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!value.trim() || !patientId) return

    setLoading(true)
    setError(null)

    try {
      const { data: inserted, error: insertError } = await supabase.from('health_journal_entries').insert({
        patient_id: patientId,
        category,
        value: value.trim(),
        unit: config.unit || null,
        context: context || null,
        notes: notes.trim() || null,
        recorded_at: new Date().toISOString(),
      }).select('id').single()

      if (insertError) throw insertError

      // Trigger embedding in background (fire and forget)
      if (inserted?.id) {
        fetch('/api/embeddings/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId: inserted.id }),
        }).catch(() => { /* non-critical */ })
      }

      router.push('/journal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry')
    } finally {
      setLoading(false)
    }
  }, [value, context, notes, patientId, category, config, supabase, router])

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-bg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-text">Log {config.label}</h1>
      </div>

      <div className="space-y-5">
        {/* Value Input */}
        <div>
          <label htmlFor="value" className="mb-1.5 block text-sm font-medium text-text">
            Value {config.unit && <span className="text-muted">({config.unit})</span>}
          </label>
          <input
            id="value"
            type="text"
            inputMode={['mood', 'symptom'].includes(category) ? 'text' : 'decimal'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={config.placeholder}
            className="input text-lg"
            autoFocus
          />
        </div>

        {/* Context Chips */}
        <div>
          <label className="mb-2 block text-sm font-medium text-text">Context</label>
          <div className="flex flex-wrap gap-2">
            {config.contexts.map((ctx) => (
              <button
                key={ctx}
                onClick={() => setContext(context === ctx ? '' : ctx)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  context === ctx
                    ? 'bg-primary text-white'
                    : 'border border-border bg-card text-muted'
                }`}
              >
                {ctx}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-text">
            Notes <span className="text-muted">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            className="input min-h-[80px] resize-none"
            rows={3}
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !value.trim()}
          className="btn-primary w-full gap-2"
        >
          <Check size={16} />
          {loading ? 'Saving...' : 'Save Entry'}
        </button>
      </div>
    </div>
  )
}
