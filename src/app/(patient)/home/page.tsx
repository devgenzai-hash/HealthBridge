'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { getGreeting, formatRelativeTime } from '@/lib/utils'
import { Droplet, Heart, Scale, Footprints, FileText, TrendingUp, RefreshCw, Loader2, Plus, AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { QuickLogBarChart } from './quick-log-bar-chart'

const ChatWidget = dynamic(
  () => import('@/components/chat/chat-widget').then((mod) => mod.ChatWidget),
  { ssr: false }
)

const DEFAULT_QUICK_LOG_ITEMS = [
  { category: 'blood_sugar', label: 'Sugar', icon: Droplet, color: 'text-red-500', chartColor: '#ef4444' },
  { category: 'bp', label: 'BP', icon: Heart, color: 'text-pink-500', chartColor: '#ec4899' },
  { category: 'weight', label: 'Weight', icon: Scale, color: 'text-blue-500', chartColor: '#3b82f6' },
  { category: 'steps', label: 'Steps', icon: Footprints, color: 'text-green-500', chartColor: '#22c55e' },
]

const QUICK_LOG_STORAGE_KEY = 'hb_quick_log_items'

function getQuickLogItems() {
  if (typeof window === 'undefined') return DEFAULT_QUICK_LOG_ITEMS
  try {
    const stored = localStorage.getItem(QUICK_LOG_STORAGE_KEY)
    return stored ? JSON.parse(stored) : DEFAULT_QUICK_LOG_ITEMS
  } catch {
    return DEFAULT_QUICK_LOG_ITEMS
  }
}

interface AIInsight {
  overview: string
  trends: { vital: string; direction: string; detail: string }[]
  recommendation: string
  flags: string[]
}

interface ChartEntry {
  label: string
  value: number
}

interface QueuePosition {
  position: number
  clinicName: string
}

interface RecentReport {
  id: string
  title: string
  category: string
  createdAt: string
  aiSummary: string | null
}

interface HomeDataResponse {
  patient?: { id: string; name: string }
  queuePosition?: QueuePosition | null
  reports?: Array<{ id: string; title: string; category: string; created_at: string; ai_summary: string | null }>
  chartData?: Record<string, ChartEntry[]>
}

let pendingHomeData: Promise<HomeDataResponse> | null = null

function fetchPatientHomeData() {
  if (!pendingHomeData) {
    pendingHomeData = fetch('/api/patient/data?section=home')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json() as Promise<HomeDataResponse>
      })
      .finally(() => {
        pendingHomeData = null
      })
  }

  return pendingHomeData
}

export default function PatientHomePage() {
  const { patientId } = useAuth()
  const [homePatientId, setHomePatientId] = useState<string | null>(null)
  const [patientName, setPatientName] = useState('')
  const [queuePosition, setQueuePosition] = useState<QueuePosition | null>(null)
  const [recentReports, setRecentReports] = useState<RecentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [quickLogItems] = useState(getQuickLogItems)
  const [chartData, setChartData] = useState<Record<string, ChartEntry[]>>({})
  
  // AI Health Insight
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightGeneratedAt, setInsightGeneratedAt] = useState<string | null>(null)
  const activePatientId = patientId || homePatientId

  // Load cached insight
  useEffect(() => {
    if (!activePatientId) return
    try {
      const cached = localStorage.getItem(`hb_insight_${activePatientId}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        setAiInsight(parsed.insight)
        setInsightGeneratedAt(parsed.generatedAt)
      }
    } catch { /* ignore */ }
  }, [activePatientId])

  useEffect(() => {
    async function fetchHomeData() {
      try {
        const data = await fetchPatientHomeData()

        if (data.patient) {
          setHomePatientId(data.patient.id)
          setPatientName(data.patient.name.split(' ')[0])
        }
        if (data.queuePosition) setQueuePosition(data.queuePosition)

        if (data.reports) {
          setRecentReports(
            data.reports.map((r) => ({
              id: r.id,
              title: r.title,
              category: r.category,
              createdAt: r.created_at,
              aiSummary: r.ai_summary,
            }))
          )
        }

        // Build chart data from journal entries
        if (data.chartData) {
          setChartData(data.chartData)
        }
      } catch (err) {
        console.error('Failed to fetch home data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchHomeData()
  }, [])

  const handleCalibrate = useCallback(async () => {
    if (!activePatientId || insightLoading) return
    setInsightLoading(true)
    try {
      const res = await fetch('/api/ai/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: activePatientId }),
      })
      if (!res.ok) throw new Error('Calibration failed')
      const data = await res.json()
      setAiInsight(data.insight)
      setInsightGeneratedAt(data.generatedAt)
      // Cache it
      localStorage.setItem(`hb_insight_${activePatientId}`, JSON.stringify({
        insight: data.insight,
        generatedAt: data.generatedAt,
      }))
    } catch (err) {
      console.error('Calibration error:', err)
    } finally {
      setInsightLoading(false)
    }
  }, [activePatientId, insightLoading])

  if (loading) {
    return (
      <div className="px-4 pt-12">
        <div className="skeleton mb-4 h-8 w-48" />
        <div className="skeleton mb-6 h-24 w-full rounded-xl" />
        <div className="skeleton mb-4 h-16 w-full rounded-xl" />
        <div className="skeleton h-32 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Greeting */}
      <h1 className="mb-1 text-2xl font-bold text-text">
        {getGreeting()}, {patientName || 'there'} 👋
      </h1>
      <p className="mb-6 text-sm text-muted">Here&apos;s your health snapshot</p>

      {/* Queue Position Badge */}
      {queuePosition && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
            #{queuePosition.position}
          </div>
          <div>
            <p className="text-sm font-semibold text-text">
              You are #{queuePosition.position} in queue
            </p>
            <p className="text-xs text-muted">at {queuePosition.clinicName}</p>
          </div>
        </div>
      )}

      {/* AI Health Insight - Large Card with Calibrate */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            <span className="text-sm font-bold text-text">AI Health Insight</span>
          </div>
          <button
            onClick={handleCalibrate}
            disabled={insightLoading}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {insightLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {insightLoading ? 'Analyzing...' : 'Calibrate'}
          </button>
        </div>

        {aiInsight ? (
          <div className="space-y-3">
            <p className="text-sm text-text leading-relaxed">{aiInsight.overview}</p>
            
            {aiInsight.trends && aiInsight.trends.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {aiInsight.trends.map((trend, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-xs">
                    {trend.direction === 'improving' && <ArrowDown size={10} className="text-green-500" />}
                    {trend.direction === 'worsening' && <ArrowUp size={10} className="text-red-500" />}
                    {trend.direction === 'stable' && <Minus size={10} className="text-blue-500" />}
                    <span className="font-medium">{trend.vital}</span>
                  </div>
                ))}
              </div>
            )}

            {aiInsight.flags && aiInsight.flags.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                <p className="text-xs text-amber-700">{aiInsight.flags[0]}</p>
              </div>
            )}

            {aiInsight.recommendation && (
              <p className="text-xs text-muted italic">💡 {aiInsight.recommendation}</p>
            )}

            {insightGeneratedAt && (
              <p className="text-[10px] text-muted/50">
                Last calibrated: {formatRelativeTime(insightGeneratedAt)}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted mb-2">
              Tap &quot;Calibrate&quot; to analyze your last 30 days of health data
            </p>
            <p className="text-xs text-muted/60">
              AI will review your vitals, reports, and journal entries
            </p>
          </div>
        )}
      </div>

      {/* Quick Log with Charts */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">Quick Log</h2>
          <Link href="/journal" className="text-xs text-primary font-medium">
            View All
          </Link>
        </div>
        <div className="space-y-3">
          {quickLogItems.map((item: typeof DEFAULT_QUICK_LOG_ITEMS[0]) => {
            const Icon = typeof item.icon === 'string' ? Droplet : item.icon
            const data = chartData[item.category] || []
            return (
              <div key={item.category} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={item.color} />
                    <span className="text-xs font-medium text-text">{item.label}</span>
                    {data.length > 0 && (
                      <span className="text-[10px] text-muted">
                        Latest: {data[data.length - 1]?.value}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/journal/log?category=${item.category}`}
                    className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary"
                  >
                    <Plus size={10} /> Add
                  </Link>
                </div>
                {data.length > 0 && (
                  <div className="h-10">
                    <QuickLogBarChart data={data} color={item.chartColor || '#0d9488'} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Reports */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Recent Reports</h2>
          <Link href="/reports" className="text-xs font-medium text-primary">
            View all
          </Link>
        </div>

        {recentReports.length === 0 ? (
          <Link
            href="/reports/upload"
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center"
          >
            <FileText size={24} className="text-muted" />
            <p className="text-sm font-medium text-text">Upload your first report</p>
            <p className="text-xs text-muted">Get AI-powered analysis instantly</p>
          </Link>
        ) : (
          <div className="space-y-3">
            {recentReports.map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="card block"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{report.title}</p>
                    <p className="mt-1 text-xs text-muted line-clamp-2">
                      {report.aiSummary || 'Analysis in progress...'}
                    </p>
                  </div>
                  <span className="ml-2 shrink-0 text-xs text-muted">
                    {formatRelativeTime(report.createdAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Chat Widget */}
      {activePatientId && (
        <ChatWidget
          patientId={activePatientId}
          contextType="general"
          title="Health Assistant"
          placeholder="Ask about your health..."
        />
      )}
    </div>
  )
}
