'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatPhone } from '@/lib/utils'
import { ArrowLeft, Calendar, Clock, User, MapPin, CreditCard } from 'lucide-react'

interface AppointmentDetail {
  id: string
  queue_date: string
  status: string
  visit_type: string
  queue_position: number | null
  consultation_fee: number
  payment_status: string
  notes: string | null
  diagnosis: string | null
  follow_up_date: string | null
  doctor: { name: string; specialization: string; phone: string } | null
  clinic: { name: string; address: string } | null
}

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { patientId } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId || !id) return

    async function fetchAppointment() {
      const { data } = await supabase
        .from('appointments')
        .select(`
          id, queue_date, status, visit_type, queue_position,
          consultation_fee, payment_status, notes, diagnosis, follow_up_date,
          doctors(name, specialization, phone),
          clinics(name, address)
        `)
        .eq('id', id)
        .eq('patient_id', patientId)
        .single()

      if (data) {
        setAppointment({
          ...data,
          doctor: data.doctors as unknown as AppointmentDetail['doctor'],
          clinic: data.clinics as unknown as AppointmentDetail['clinic'],
        })
      }
      setLoading(false)
    }

    fetchAppointment()
  }, [id, patientId, supabase])

  if (loading) {
    return (
      <div className="px-4 pt-12">
        <div className="skeleton mb-4 h-8 w-48" />
        <div className="skeleton mb-3 h-24 rounded-xl" />
        <div className="skeleton mb-3 h-24 rounded-xl" />
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted">Appointment not found</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-bg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-text">Appointment Details</h1>
      </div>

      {/* Status Badge */}
      <div className="mb-4 flex items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          appointment.status === 'done' ? 'bg-success/10 text-success' :
          appointment.status === 'cancelled' ? 'bg-danger/10 text-danger' :
          'bg-primary/10 text-primary'
        }`}>
          {appointment.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </span>
        <span className="rounded-full bg-bg px-3 py-1 text-xs text-muted capitalize">
          {appointment.visit_type}
        </span>
      </div>

      {/* Doctor Info */}
      {appointment.doctor && (
        <div className="card mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Dr. {appointment.doctor.name}</p>
              <p className="text-xs text-muted">{appointment.doctor.specialization}</p>
              {appointment.doctor.phone && (
                <p className="text-xs text-muted">{formatPhone(appointment.doctor.phone)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Date & Location */}
      <div className="card mb-3 space-y-3">
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-muted" />
          <span className="text-sm text-text">{formatDate(appointment.queue_date)}</span>
        </div>
        {appointment.queue_position && (
          <div className="flex items-center gap-3">
            <Clock size={16} className="text-muted" />
            <span className="text-sm text-text">Queue Position: #{appointment.queue_position}</span>
          </div>
        )}
        {appointment.clinic && (
          <div className="flex items-center gap-3">
            <MapPin size={16} className="text-muted" />
            <div>
              <p className="text-sm text-text">{appointment.clinic.name}</p>
              <p className="text-xs text-muted">{appointment.clinic.address}</p>
            </div>
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="card mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard size={16} className="text-muted" />
            <span className="text-sm text-text">₹{appointment.consultation_fee}</span>
          </div>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${
            appointment.payment_status === 'verified' ? 'bg-success/10 text-success' :
            appointment.payment_status === 'pending' ? 'bg-warning/10 text-warning' :
            'bg-bg text-muted'
          }`}>
            {appointment.payment_status}
          </span>
        </div>
      </div>

      {/* Diagnosis & Notes */}
      {appointment.diagnosis && (
        <div className="card mb-3">
          <p className="mb-1 text-xs font-medium text-muted">Diagnosis</p>
          <p className="text-sm text-text">{appointment.diagnosis}</p>
        </div>
      )}

      {appointment.notes && (
        <div className="card mb-3">
          <p className="mb-1 text-xs font-medium text-muted">Notes</p>
          <p className="text-sm text-text">{appointment.notes}</p>
        </div>
      )}

      {appointment.follow_up_date && (
        <div className="card">
          <p className="mb-1 text-xs font-medium text-muted">Follow-up Date</p>
          <p className="text-sm text-text">{formatDate(appointment.follow_up_date)}</p>
        </div>
      )}
    </div>
  )
}
