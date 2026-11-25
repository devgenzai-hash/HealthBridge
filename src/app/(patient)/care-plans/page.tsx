'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Salad, Dumbbell, Droplets, Moon, Calendar, Sparkles } from 'lucide-react'
import type { Json } from '@/types/database'

interface CarePlan {
  id: string
  diet_plan: Json
  exercise_plan: Json
  hydration: string | null
  sleep_recommendation: string | null
  valid_from: string
  valid_until: string | null
  doctor_name: string | null
}

export default function CarePlansPage() {
  const { patientId } = useAuth()
  const supabase = createClient()
  const [plans, setPlans] = useState<CarePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!patientId) return

    async function fetchPlans() {
      const { data } = await supabase
        .from('care_plans')
        .select('id, diet_plan, exercise_plan, hydration, sleep_recommendation, valid_from, valid_until, doctors(name)')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('valid_from', { ascending: false })
        .limit(5)

      if (data) {
        setPlans(data.map((p: Record<string, unknown>) => ({
          ...p,
          doctor_name: (p.doctors as { name: string } | null)?.name || null,
        })) as CarePlan[])
      }
      setLoading(false)
    }

    fetchPlans()
  }, [patientId, supabase])

  const generateAIPlan = async () => {
    if (!patientId) return
    setGenerating(true)

    try {
      const res = await fetch('/api/ai/care-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })

      if (res.ok) {
        const data = await res.json()
        setPlans((prev) => [data.plan, ...prev])
      }
    } catch {
      // handled silently
    } finally {
      setGenerating(false)
    }
  }

  const activePlan = plans.find((p) => {
    if (!p.valid_until) return true
    return new Date(p.valid_until) >= new Date()
  })

  if (loading) {
    return (
      <div className="px-4 pt-12">
        <h1 className="mb-6 text-xl font-bold text-text">Care Plans</h1>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-text">Care Plans</h1>
        <button
          onClick={generateAIPlan}
          disabled={generating}
          className="btn-primary !min-h-[36px] !px-3 gap-1.5"
        >
          <Sparkles size={14} />
          {generating ? 'Generating...' : 'AI Plan'}
        </button>
      </div>

      {/* Active Plan */}
      {activePlan && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">Active Plan</h2>
          <PlanCard plan={activePlan} isActive />
        </div>
      )}

      {/* Past Plans */}
      {plans.filter((p) => p !== activePlan).length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted">Past Plans</h2>
          <div className="space-y-3">
            {plans
              .filter((p) => p !== activePlan)
              .map((plan) => (
                <PlanCard key={plan.id} plan={plan} isActive={false} />
              ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {plans.length === 0 && (
        <div className="pt-16 text-center">
          <Salad size={40} className="mx-auto mb-3 text-muted" />
          <p className="text-sm font-medium text-text">No care plans yet</p>
          <p className="mt-1 text-xs text-muted">
            Ask your doctor or generate an AI-powered plan based on your health data.
          </p>
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan, isActive }: { plan: CarePlan; isActive: boolean }) {
  const dietItems = Array.isArray(plan.diet_plan) ? plan.diet_plan : []
  const exerciseItems = Array.isArray(plan.exercise_plan) ? plan.exercise_plan : []

  return (
    <div className={`card ${isActive ? 'border-primary/30' : ''}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-muted" />
          <span className="text-[10px] text-muted">
            {new Date(plan.valid_from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {plan.valid_until && ` — ${new Date(plan.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
          </span>
        </div>
        {plan.doctor_name && (
          <span className="text-[10px] text-muted">Dr. {plan.doctor_name}</span>
        )}
      </div>

      {/* Diet */}
      {dietItems.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center gap-1.5">
            <Salad size={12} className="text-success" />
            <span className="text-xs font-medium text-text">Diet</span>
          </div>
          <ul className="space-y-0.5 pl-5">
            {(dietItems as string[]).slice(0, 3).map((item, i) => (
              <li key={i} className="text-xs text-muted list-disc">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Exercise */}
      {exerciseItems.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center gap-1.5">
            <Dumbbell size={12} className="text-primary" />
            <span className="text-xs font-medium text-text">Exercise</span>
          </div>
          <ul className="space-y-0.5 pl-5">
            {(exerciseItems as string[]).slice(0, 3).map((item, i) => (
              <li key={i} className="text-xs text-muted list-disc">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Hydration & Sleep */}
      <div className="flex gap-4">
        {plan.hydration && (
          <div className="flex items-center gap-1.5">
            <Droplets size={12} className="text-blue-400" />
            <span className="text-xs text-muted">{plan.hydration}</span>
          </div>
        )}
        {plan.sleep_recommendation && (
          <div className="flex items-center gap-1.5">
            <Moon size={12} className="text-purple-400" />
            <span className="text-xs text-muted">{plan.sleep_recommendation}</span>
          </div>
        )}
      </div>
    </div>
  )
}
