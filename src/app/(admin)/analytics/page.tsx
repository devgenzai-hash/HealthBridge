'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Users, Calendar, IndianRupee, Activity } from 'lucide-react'

interface AnalyticsData {
  totalPatients: number
  thisMonthPatients: number
  totalAppointments: number
  thisWeekAppointments: number
  revenue: number
  avgWaitTime: number | null
  topDoctors: { name: string; count: number }[]
  visitTypes: { type: string; count: number }[]
}

export default function AdminAnalyticsPage() {
  const { clinicId } = useAuth()
  const supabase = createClient()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicId) return

    async function fetchAnalytics() {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0]

      const [patientsRes, monthPatientsRes, apptsRes, weekApptsRes, revenueRes, doctorsRes] =
        await Promise.all([
          supabase
            .from('patients')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .is('deleted_at', null),
          supabase
            .from('patients')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .gte('created_at', startOfMonth)
            .is('deleted_at', null),
          supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .is('deleted_at', null),
          supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .gte('queue_date', startOfWeek)
            .is('deleted_at', null),
          supabase
            .from('appointments')
            .select('payment_amount')
            .eq('clinic_id', clinicId)
            .eq('payment_status', 'paid')
            .is('deleted_at', null),
          supabase
            .from('appointments')
            .select('doctor_id, doctors(name)')
            .eq('clinic_id', clinicId)
            .gte('queue_date', startOfWeek)
            .is('deleted_at', null),
        ])

      const revenue = (revenueRes.data || []).reduce(
        (sum: number, r: { payment_amount: number | null }) => sum + (r.payment_amount || 0),
        0
      )

      // Count appointments per doctor
      const doctorCounts: Record<string, { name: string; count: number }> = {}
      for (const d of doctorsRes.data || []) {
        const name = (d.doctors as unknown as { name: string })?.name || 'Unknown'
        if (!doctorCounts[d.doctor_id]) {
          doctorCounts[d.doctor_id] = { name, count: 0 }
        }
        doctorCounts[d.doctor_id].count++
      }
      const topDoctors = Object.values(doctorCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      setData({
        totalPatients: patientsRes.count || 0,
        thisMonthPatients: monthPatientsRes.count || 0,
        totalAppointments: apptsRes.count || 0,
        thisWeekAppointments: weekApptsRes.count || 0,
        revenue,
        avgWaitTime: null,
        topDoctors,
        visitTypes: [],
      })
      setLoading(false)
    }

    fetchAnalytics()
  }, [clinicId, supabase])

  if (loading || !data) {
    return (
      <div className="px-4 pt-12">
        <div className="skeleton mb-4 h-6 w-32 rounded" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="mb-4 text-xl font-bold text-text">Analytics</h1>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="card">
          <div className="mb-1 flex items-center gap-2 text-primary">
            <Users size={14} />
            <span className="text-xs text-muted">Total Patients</span>
          </div>
          <p className="text-2xl font-bold text-text">{data.totalPatients}</p>
          <p className="text-[10px] text-success">+{data.thisMonthPatients} this month</p>
        </div>
        <div className="card">
          <div className="mb-1 flex items-center gap-2 text-primary">
            <Calendar size={14} />
            <span className="text-xs text-muted">Appointments</span>
          </div>
          <p className="text-2xl font-bold text-text">{data.totalAppointments}</p>
          <p className="text-[10px] text-muted">{data.thisWeekAppointments} this week</p>
        </div>
        <div className="card">
          <div className="mb-1 flex items-center gap-2 text-primary">
            <IndianRupee size={14} />
            <span className="text-xs text-muted">Revenue</span>
          </div>
          <p className="text-2xl font-bold text-text">₹{data.revenue.toLocaleString('en-IN')}</p>
        </div>
        <div className="card">
          <div className="mb-1 flex items-center gap-2 text-primary">
            <Activity size={14} />
            <span className="text-xs text-muted">Avg Wait</span>
          </div>
          <p className="text-2xl font-bold text-text">{data.avgWaitTime ? `${data.avgWaitTime}m` : '-'}</p>
        </div>
      </div>

      {/* Top Doctors */}
      {data.topDoctors.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted">
            <TrendingUp size={14} /> Top Doctors (This Week)
          </h2>
          <div className="card space-y-2">
            {data.topDoctors.map((doc, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-text">{doc.name}</span>
                <span className="rounded bg-bg px-2 py-0.5 text-xs font-medium text-muted">
                  {doc.count} appts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
