'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Clock, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface ScheduleDay {
  date: string
  appointmentCount: number
  appointments: {
    id: string
    patient_name: string
    visit_type: string
    status: string
  }[]
}

export default function SchedulePage() {
  const { doctorId } = useAuth()
  const supabase = createClient()
  const [schedule, setSchedule] = useState<ScheduleDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!doctorId) return

    async function fetchSchedule() {
      const today = new Date()
      const next7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() + i)
        return d.toISOString().split('T')[0]
      })

      const { data } = await supabase
        .from('appointments')
        .select('id, queue_date, visit_type, status, patients(name)')
        .eq('doctor_id', doctorId)
        .in('queue_date', next7Days)
        .is('deleted_at', null)
        .not('status', 'in', '("cancelled","no_show")')
        .order('queue_date', { ascending: true })

      if (data) {
        const grouped: Record<string, ScheduleDay> = {}
        for (const date of next7Days) {
          grouped[date] = { date, appointmentCount: 0, appointments: [] }
        }
        for (const appt of data) {
          if (grouped[appt.queue_date]) {
            grouped[appt.queue_date].appointmentCount++
            grouped[appt.queue_date].appointments.push({
              id: appt.id,
              patient_name: (appt.patients as unknown as { name: string })?.name || 'Patient',
              visit_type: appt.visit_type,
              status: appt.status,
            })
          }
        }
        setSchedule(Object.values(grouped))
      }
      setLoading(false)
    }

    fetchSchedule()
  }, [doctorId, supabase])

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="mb-6 text-xl font-bold text-text">Schedule</h1>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {schedule.map((day) => {
            const isToday = day.date === today
            const dayName = new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' })
            const dayNum = new Date(day.date).getDate()
            const month = new Date(day.date).toLocaleDateString('en-IN', { month: 'short' })

            return (
              <div
                key={day.date}
                className={`card ${isToday ? 'border-primary/30 bg-primary/5' : ''}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 flex-col items-center justify-center rounded-lg ${
                      isToday ? 'bg-primary text-white' : 'bg-bg text-muted'
                    }`}>
                      <span className="text-[10px] font-medium">{dayName}</span>
                      <span className="text-sm font-bold leading-none">{dayNum}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">
                        {isToday ? 'Today' : `${dayName}, ${dayNum} ${month}`}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted">
                        <Users size={10} />
                        {day.appointmentCount} appointment{day.appointmentCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Appointments for the day */}
                {day.appointments.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2">
                    {day.appointments.slice(0, 4).map((appt) => (
                      <div key={appt.id} className="flex items-center justify-between">
                        <span className="text-xs text-text">{appt.patient_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] text-muted capitalize">
                            {appt.visit_type}
                          </span>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            appt.status === 'done' ? 'bg-success' :
                            appt.status === 'waiting' ? 'bg-warning' : 'bg-muted'
                          }`} />
                        </div>
                      </div>
                    ))}
                    {day.appointments.length > 4 && (
                      <p className="text-[10px] text-muted">+{day.appointments.length - 4} more</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
