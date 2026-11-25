'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { Plus, Search, FileText, ArrowUpDown, Calendar, AlertTriangle } from 'lucide-react'
import { ChatWidget } from '@/components/chat/chat-widget'

interface Report {
  id: string
  title: string
  category: string
  aiSummary: string | null
  reportDate: string | null
  createdAt: string
  flags: string[] | null
}

const CATEGORY_LABELS: Record<string, string> = {
  blood_test: 'Blood Test',
  urine_test: 'Urine Test',
  imaging: 'Imaging',
  pathology: 'Pathology',
  other: 'Other',
}

type SortMode = 'newest' | 'oldest' | 'flagged'

export default function ReportsListPage() {
  const { patientId } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')

  useEffect(() => {
    if (!patientId) return

    async function fetchReports() {
      try {
        const res = await fetch('/api/patient/data?section=reports')
        if (!res.ok) throw new Error('Failed')
        const { records: data } = await res.json()

        if (data) {
          setReports(
            data.map((r: { id: string; title: string; category: string; ai_summary: string | null; report_date: string | null; created_at: string; flags: string[] | null }) => ({
              id: r.id,
              title: r.title,
              category: r.category,
              aiSummary: r.ai_summary,
              reportDate: r.report_date,
              createdAt: r.created_at,
              flags: r.flags,
            }))
          )
        }
      } catch (err) {
        console.error('Failed to fetch reports:', err)
      }
      setLoading(false)
    }

    fetchReports()
  }, [patientId])

  // Filter and sort
  const filteredReports = reports
    .filter(r => {
      if (categoryFilter && r.category !== categoryFilter) return false
      if (search) {
        const s = search.toLowerCase()
        return r.title.toLowerCase().includes(s) || (r.aiSummary && r.aiSummary.toLowerCase().includes(s))
      }
      return true
    })
    .sort((a, b) => {
      if (sortMode === 'flagged') {
        const aFlags = a.flags?.length || 0
        const bFlags = b.flags?.length || 0
        if (bFlags !== aFlags) return bFlags - aFlags
      }
      if (sortMode === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  // Group by month for timeline view
  const groupedByMonth: Record<string, Report[]> = {}
  if (viewMode === 'timeline') {
    filteredReports.forEach(r => {
      const date = new Date(r.reportDate || r.createdAt)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!groupedByMonth[key]) groupedByMonth[key] = []
      groupedByMonth[key].push(r)
    })
  }

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-text">My Reports</h1>
        <Link href="/reports/upload" className="btn-primary !min-h-[36px] !px-3 gap-1.5">
          <Plus size={16} />
          Upload
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search reports by title or content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input !pl-9"
        />
      </div>

      {/* Sort and View Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortMode(sortMode === 'newest' ? 'oldest' : sortMode === 'oldest' ? 'flagged' : 'newest')}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:bg-bg"
          >
            <ArrowUpDown size={12} />
            {sortMode === 'newest' ? 'Newest' : sortMode === 'oldest' ? 'Oldest' : 'Flagged'}
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'timeline' : 'list')}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${
              viewMode === 'timeline' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted hover:bg-bg'
            }`}
          >
            <Calendar size={12} />
            Timeline
          </button>
        </div>
        <span className="text-xs text-muted">{filteredReports.length} reports</span>
      </div>

      {/* Category Filter Chips */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !categoryFilter ? 'bg-primary text-white' : 'bg-bg text-muted border border-border'
          }`}
        >
          All
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCategoryFilter(key === categoryFilter ? null : key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              categoryFilter === key ? 'bg-primary text-white' : 'bg-bg text-muted border border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Reports */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="flex flex-col items-center gap-3 pt-12 text-center">
          <FileText size={40} className="text-muted" />
          <p className="text-sm text-muted">
            {search ? 'No reports match your search' : 'No reports uploaded yet'}
          </p>
          <Link href="/reports/upload" className="btn-primary">
            Upload Your First Report
          </Link>
        </div>
      ) : viewMode === 'timeline' ? (
        /* Timeline View */
        <div className="space-y-6">
          {Object.entries(groupedByMonth).map(([monthKey, monthReports]) => {
            const [year, month] = monthKey.split('-')
            const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
            return (
              <div key={monthKey}>
                <h3 className="mb-3 text-xs font-bold uppercase text-muted">{monthLabel}</h3>
                <div className="relative border-l-2 border-border pl-4 space-y-3">
                  {monthReports.map((report) => (
                    <Link key={report.id} href={`/reports/${report.id}`} className="block">
                      <div className="absolute -left-[5px] mt-2 h-2 w-2 rounded-full bg-primary" />
                      <div className="rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-text">{report.title}</p>
                          {report.flags && report.flags.length > 0 && (
                            <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted line-clamp-1">
                          {report.aiSummary || 'Processing...'}
                        </p>
                        <span className="mt-1 text-[10px] text-muted">
                          {report.reportDate ? formatDate(report.reportDate) : formatRelativeTime(report.createdAt)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`} className="card block">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText size={18} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-text">{report.title}</p>
                    {report.flags && report.flags.length > 0 && (
                      <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                        {report.flags.length} flag{report.flags.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted line-clamp-1">
                    {report.aiSummary || 'Processing...'}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] text-muted">
                      {CATEGORY_LABELS[report.category] || report.category}
                    </span>
                    <span className="text-[10px] text-muted">
                      {report.reportDate ? formatDate(report.reportDate) : formatRelativeTime(report.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Chat Widget for Reports */}
      {patientId && (
        <ChatWidget
          patientId={patientId}
          contextType="reports"
          title="Reports Chat"
          placeholder="Ask about your reports..."
          contextData={filteredReports.length > 0 ? `Recent reports: ${filteredReports.slice(0, 5).map(r => `${r.title} (${r.category}): ${r.aiSummary || 'no summary'}`).join('; ')}` : undefined}
        />
      )}
    </div>
  )
}
