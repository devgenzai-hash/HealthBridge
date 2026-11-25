'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'
import { Plus, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react'

interface Appointment {
  id: string
  doctorName: string
  clinicName: string
  queueDate: string
  status: string
  visitType: string
  queuePosition: number | null
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  scheduled: Calendar,
  confirmed: Calendar,
  waiting: Clock,
  in_consultation: Clock,
  done: CheckCircle,
  no_show: XCircle,
  cancelled: XCircle,
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  waiting: 'In Queue',
  in_consultation: 'With Doctor',
  done: 'Completed',
  no_show: 'No Show',
  cancelled: 'Cancelled',
}

export default function AppointmentsPage() {
  const { patientId } = useAuth()
  const [upcoming, setUpcoming] = useState<Appointment[]>([])
  const [past, setPast] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

  useEffect(() => {
    if (!patientId) return

    async function fetchAppointments() {
      try {
        const res = await fetch('/api/patient/data?section=appointments')
        if (!res.ok) throw new Error('Failed')
        const { appointments: data } = await res.json()

        if (data) {
          const today = new Date().toISOString().split('T')[0]
          const mapped = data.map((a: { id: string; queue_date: string; status: string; visit_type: string; queue_position: number | null; doctors: { name: string } | null; clinics: { name: string } | null }) => ({
            id: a.id,
            doctorName: a.doctors?.name || 'Doctor',
            clinicName: a.clinics?.name || 'Clinic',
            queueDate: a.queue_date,
            status: a.status,
            visitType: a.visit_type,
            queuePosition: a.queue_position,
          }))

          setUpcoming(mapped.filter((a: Appointment) => a.queueDate >= today && !['done', 'no_show', 'cancelled'].includes(a.status)))
          setPast(mapped.filter((a: Appointment) => a.queueDate < today || ['done', 'no_show', 'cancelled'].includes(a.status)))
        }
      } catch (err) {
        console.error('Failed to fetch appointments:', err)
      }
      setLoading(false)
    }

    fetchAppointments()
  }, [patientId])

  const appointments = tab === 'upcoming' ? upcoming : past

  return (
    <div className="px-4 pt-12 pb-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-text">Appointments</h1>
        <Link href="/appointments/book" className="btn-primary !min-h-[36px] !px-3 gap-1.5">
          <Plus size={16} />
          Book
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex rounded-lg border border-border bg-bg p-1">
        <button
          onClick={() => setTab('upcoming')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === 'upcoming' ? 'bg-card text-text shadow-sm' : 'text-muted'
          }`}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          onClick={() => setTab('past')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === 'past' ? 'bg-card text-text shadow-sm' : 'text-muted'
          }`}
        >
          Past ({past.length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="pt-12 text-center">
          <Calendar size={40} className="mx-auto mb-3 text-muted" />
          <p className="text-sm text-muted">
            {tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const Icon = STATUS_ICONS[appt.status] || Calendar
            return (
              <Link key={appt.id} href={`/appointments/${appt.id}`} className="card block">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">Dr. {appt.doctorName}</p>
                    <p className="text-xs text-muted">{appt.clinicName}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted">{formatDate(appt.queueDate)}</span>
                      <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] text-muted">
                        {STATUS_LABELS[appt.status]}
                      </span>
                      {appt.queuePosition && appt.status === 'waiting' && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          #{appt.queuePosition}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
