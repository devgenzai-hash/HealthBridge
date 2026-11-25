'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Share2, MessageCircle, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'

interface ReportParameter {
  name: string
  value: string
  unit: string
  reference_range: string
  status: 'normal' | 'borderline' | 'abnormal'
}

interface ReportDetail {
  id: string
  title: string
  category: string
  aiSummary: string | null
  parameters: ReportParameter[] | null
  flags: string[] | null
  labName: string | null
  reportDate: string | null
  createdAt: string
  fileUrl: string
}

const STATUS_STYLES = {
  normal: 'bg-success/10 text-success',
  borderline: 'bg-warning/10 text-warning',
  abnormal: 'bg-danger/10 text-danger',
}

const STATUS_ICONS = {
  normal: CheckCircle,
  borderline: AlertCircle,
  abnormal: AlertTriangle,
}

export default function ReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { patientId } = useAuth()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!patientId || !params.id) return

    async function fetchReport() {
      const { data } = await supabase
        .from('medical_records')
        .select('*')
        .eq('id', params.id as string)
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .single()

      if (data) {
        setReport({
          id: data.id,
          title: data.title,
          category: data.category,
          aiSummary: data.ai_summary,
          parameters: data.parameters as ReportParameter[] | null,
          flags: data.flags,
          labName: data.lab_name,
          reportDate: data.report_date,
          createdAt: data.created_at,
          fileUrl: data.file_url,
        })
      }
      setLoading(false)
    }

    fetchReport()
  }, [patientId, params.id, supabase])

  if (loading) {
    return (
      <div className="px-4 pt-12">
        <div className="skeleton mb-4 h-6 w-32" />
        <div className="skeleton mb-6 h-24 rounded-xl" />
        <div className="skeleton mb-4 h-48 rounded-xl" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-sm text-muted">Report not found</p>
        <button onClick={() => router.back()} className="mt-3 text-sm text-primary">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-bg">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-text">{report.title}</h1>
          <p className="text-xs text-muted">
            {report.labName && `${report.labName} • `}
            {report.reportDate ? formatDate(report.reportDate) : formatDate(report.createdAt)}
          </p>
        </div>
        <button className="rounded-lg p-2 text-muted hover:bg-bg">
          <Share2 size={18} />
        </button>
      </div>

      {/* Flags */}
      {report.flags && report.flags.length > 0 && (
        <div className="mb-4 rounded-xl bg-danger/5 border border-danger/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger" />
            <span className="text-xs font-semibold text-danger">Attention Required</span>
          </div>
          <ul className="space-y-1">
            {report.flags.map((flag, i) => (
              <li key={i} className="text-sm text-text">• {flag}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Summary */}
      {report.aiSummary && (
        <div className="mb-6 rounded-xl border-l-4 border-l-primary bg-card p-4 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase text-primary">AI Summary</p>
          <p className="text-sm leading-relaxed text-text">{report.aiSummary}</p>
        </div>
      )}

      {/* Test Values Table */}
      {report.parameters && report.parameters.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-text">Test Values</h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-bg">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted">Test</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted">Value</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted">Range</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.parameters.map((param, i) => {
                  const Icon = STATUS_ICONS[param.status]
                  return (
                    <tr key={i} className="bg-card">
                      <td className="px-3 py-2.5 text-xs font-medium text-text">{param.name}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-text">
                        {param.value} <span className="text-muted">{param.unit}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-muted">{param.reference_range}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[param.status]}`}>
                          <Icon size={10} />
                          {param.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ask AI Button */}
      <Link
        href={`/ai-chat?reportId=${report.id}`}
        className="btn-secondary w-full gap-2"
      >
        <MessageCircle size={16} />
        Ask AI about this report
      </Link>
    </div>
  )
}
