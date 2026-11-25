'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Users, Calendar, IndianRupee, Clock, TrendingUp } from 'lucide-react'

interface DashboardStats {
  totalPatients: number
  todayAppointments: number
  monthlyRevenue: number
  pendingPayments: number
}

interface ActivityItem {
  id: string
  description: string
  timestamp: string
}

export default function AdminDashboardPage() {
  const { clinicId } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    todayAppointments: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
  })
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!clinicId) return
    const currentClinicId = clinicId

    async function fetchDashboard() {
      const today = new Date().toISOString().split('T')[0]
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

      // Total patients (via appointments)
      const { count: patientCount } = await supabase
        .from('appointments')
        .select('patient_id', { count: 'exact', head: true })
        .eq('clinic_id', currentClinicId)
        .is('deleted_at', null)

      // Today's appointments
      const { count: todayCount } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', currentClinicId)
        .eq('queue_date', today)
        .is('deleted_at', null)

      // Monthly revenue (verified payments)
      const { data: revenue } = await supabase
        .from('appointments')
        .select('consultation_fee')
        .eq('clinic_id', currentClinicId)
        .eq('payment_status', 'verified')
        .gte('queue_date', monthStart)
        .is('deleted_at', null)

      const totalRevenue = revenue?.reduce((sum: number, a: { consultation_fee: number | null }) => sum + (a.consultation_fee || 0), 0) || 0

      // Pending payments
      const { count: pendingCount } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', currentClinicId)
        .eq('payment_status', 'uploaded')
        .is('deleted_at', null)

      setStats({
        totalPatients: patientCount || 0,
        todayAppointments: todayCount || 0,
        monthlyRevenue: totalRevenue,
        pendingPayments: pendingCount || 0,
      })

      // Recent activity
      const { data: recentAppts } = await supabase
        .from('appointments')
        .select('id, status, queue_date, patients(name)')
        .eq('clinic_id', currentClinicId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (recentAppts) {
        setActivities(
          recentAppts.map((a) => ({
            id: a.id,
            description: `${a.patients?.name || 'Patient'} — ${a.status}`,
            timestamp: a.queue_date,
          }))
        )
      }

      setLoading(false)
    }

    fetchDashboard()
  }, [clinicId, supabase])

  if (loading) {
    return (
      <div className="px-4 pt-12">
        <div className="skeleton mb-6 h-8 w-40" />
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
      <h1 className="mb-6 text-xl font-bold text-text">Dashboard</h1>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard
          icon={Users}
          label="Total Patients"
          value={String(stats.totalPatients)}
          color="text-primary"
        />
        <StatCard
          icon={Calendar}
          label="Today's Appts"
          value={String(stats.todayAppointments)}
          color="text-blue-500"
        />
        <StatCard
          icon={IndianRupee}
          label="Monthly Revenue"
          value={`₹${stats.monthlyRevenue.toLocaleString('en-IN')}`}
          color="text-success"
        />
        <StatCard
          icon={Clock}
          label="Pending Payments"
          value={String(stats.pendingPayments)}
          color="text-warning"
        />
      </div>

      {/* AI Insight */}
      <div className="mb-6 rounded-xl border-l-4 border-l-warning bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp size={16} className="text-warning" />
          <span className="text-xs font-semibold uppercase text-warning">AI Insight</span>
        </div>
        <p className="text-sm text-text">
          {stats.todayAppointments > 10
            ? 'Busy day ahead! Consider adding an extra consultation slot.'
            : 'Moderate appointment load today. All doctors have availability.'}
        </p>
      </div>

      {/* Activity Feed */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-text">Recent Activity</h2>
        <div className="space-y-2">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <p className="flex-1 text-xs text-text">{activity.description}</p>
              <span className="text-[10px] text-muted">{activity.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users
  label: string
  value: string
  color: string
}) {
  return (
    <div className="card">
      <Icon size={18} className={color} />
      <p className="mt-2 text-lg font-bold text-text">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
