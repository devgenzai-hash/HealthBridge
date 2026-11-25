'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, TrendingDown, Minus, Activity, Droplets, Weight, Heart } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts'

interface VitalRecord {
  id: string
  recorded_at: string
  bp_systolic: number | null
  bp_diastolic: number | null
  pulse: number | null
  weight: number | null
  spo2: number | null
  temperature: number | null
}

interface JournalTrend {
  category: string
  values: { date: string; value: number }[]
  latestValue: string
  trend: 'up' | 'down' | 'stable'
  change: number
}

const CATEGORY_META: Record<string, { icon: typeof Activity; label: string; unit: string; color: string; chartColor: string }> = {
  blood_sugar: { icon: Droplets, label: 'Blood Sugar', unit: 'mg/dL', color: 'text-danger', chartColor: '#ef4444' },
  bp: { icon: Heart, label: 'Blood Pressure', unit: 'mmHg', color: 'text-primary', chartColor: '#0d9488' },
  weight: { icon: Weight, label: 'Weight', unit: 'kg', color: 'text-warning', chartColor: '#f59e0b' },
  steps: { icon: Activity, label: 'Steps', unit: 'steps', color: 'text-success', chartColor: '#22c55e' },
}

export default function TrendsPage() {
  const { patientId } = useAuth()
  const supabase = createClient()
  const [vitals, setVitals] = useState<VitalRecord[]>([])
  const [trends, setTrends] = useState<JournalTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedChart, setExpandedChart] = useState<string | null>(null)

  useEffect(() => {
    if (!patientId) return

    async function fetchData() {
      const { data: vitalsData } = await supabase
        .from('patient_vitals')
        .select('id, recorded_at, bp_systolic, bp_diastolic, pulse, weight, spo2, temperature')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('recorded_at', { ascending: false })
        .limit(20)

      if (vitalsData) setVitals(vitalsData)

      const { data: journalData } = await supabase
        .from('health_journal_entries')
        .select('category, value, recorded_at')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('recorded_at', { ascending: false })
        .limit(100)

      if (journalData) {
        const grouped: Record<string, { date: string; value: number }[]> = {}
        for (const entry of journalData) {
          if (!grouped[entry.category]) grouped[entry.category] = []
          const numVal = parseFloat(entry.value)
          if (!isNaN(numVal)) {
            grouped[entry.category].push({
              date: entry.recorded_at,
              value: numVal,
            })
          }
        }

        const trendList: JournalTrend[] = Object.entries(grouped).map(([category, values]) => {
          const sorted = values.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          let trend: 'up' | 'down' | 'stable' = 'stable'
          let change = 0
          if (sorted.length >= 2) {
            change = sorted[0].value - sorted[sorted.length - 1].value
            const recentDiff = sorted[0].value - sorted[1].value
            if (recentDiff > 0) trend = 'up'
            else if (recentDiff < 0) trend = 'down'
          }
          return {
            category,
            values: sorted.slice(0, 14).reverse(),
            latestValue: sorted[0]?.value.toString() || '-',
            trend,
            change,
          }
        })

        setTrends(trendList)
      }

      setLoading(false)
    }

    fetchData()
  }, [patientId, supabase])

  if (loading) {
    return (
      <div className="px-4 pt-12">
        <h1 className="mb-6 text-xl font-bold text-text">Health Trends</h1>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="mb-6 text-xl font-bold text-text">Health Trends</h1>

      {/* Journal Trends with Charts */}
      {trends.length > 0 && (
        <div className="mb-6 space-y-4">
          {trends.map((t) => {
            const meta = CATEGORY_META[t.category] || { icon: Activity, label: t.category, unit: '', color: 'text-muted', chartColor: '#6b7280' }
            const Icon = meta.icon
            const TrendIcon = t.trend === 'up' ? TrendingUp : t.trend === 'down' ? TrendingDown : Minus
            const isExpanded = expandedChart === t.category
            const chartData = t.values.map(v => ({
              date: new Date(v.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
              value: v.value,
            }))

            return (
              <div
                key={t.category}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                <button
                  onClick={() => setExpandedChart(isExpanded ? null : t.category)}
                  className="flex w-full items-center gap-3 p-4"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-opacity-10 ${meta.color.replace('text-', 'bg-')}/10`}>
                    <Icon size={18} className={meta.color} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-text">{meta.label}</p>
                    <p className="text-xs text-muted">
                      Latest: {t.latestValue} {meta.unit}
                      {t.change !== 0 && (
                        <span className={t.change > 0 ? 'text-red-500' : 'text-green-500'}>
                          {' '}({t.change > 0 ? '+' : ''}{t.change.toFixed(1)})
                        </span>
                      )}
                    </p>
                  </div>
                  <TrendIcon size={18} className={
                    t.trend === 'up' ? 'text-red-500' :
                    t.trend === 'down' ? 'text-green-500' : 'text-muted'
                  } />
                </button>

                {/* Mini chart always visible */}
                {!isExpanded && chartData.length > 1 && (
                  <div className="h-12 px-4 pb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={meta.chartColor}
                          fill={meta.chartColor}
                          fillOpacity={0.1}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Expanded full chart */}
                {isExpanded && chartData.length > 1 && (
                  <div className="h-48 px-4 pb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={meta.chartColor}
                          strokeWidth={2}
                          dot={{ r: 3, fill: meta.chartColor }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Recent Vitals */}
      {vitals.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted">Clinical Vitals</h2>
          <div className="space-y-2">
            {vitals.slice(0, 5).map((v) => (
              <div key={v.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted">
                    {new Date(v.recorded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex gap-4 text-xs">
                  {v.bp_systolic && (
                    <span className="text-text">
                      <span className="text-muted">BP:</span> {v.bp_systolic}/{v.bp_diastolic}
                    </span>
                  )}
                  {v.pulse && (
                    <span className="text-text">
                      <span className="text-muted">HR:</span> {v.pulse}
                    </span>
                  )}
                  {v.weight && (
                    <span className="text-text">
                      <span className="text-muted">Wt:</span> {v.weight}kg
                    </span>
                  )}
                  {v.spo2 && (
                    <span className="text-text">
                      <span className="text-muted">SpO2:</span> {v.spo2}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {trends.length === 0 && vitals.length === 0 && (
        <div className="pt-16 text-center">
          <Activity size={40} className="mx-auto mb-3 text-muted" />
          <p className="text-sm font-medium text-text">No trend data yet</p>
          <p className="mt-1 text-xs text-muted">
            Start logging in your Health Journal to see trends here.
          </p>
        </div>
      )}
    </div>
  )
}
