'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Clock, CheckCircle } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Doctor {
  id: string
  name: string
  specialization: string
  consultation_fee: number
  clinic_id: string
}

type BookingStep = 'doctor' | 'date' | 'confirm'

export default function BookAppointmentPage() {
  const { patientId } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<BookingStep>('doctor')
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [visitType, setVisitType] = useState<'scheduled' | 'walkin' | 'followup'>('scheduled')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function fetchDoctors() {
      const { data } = await supabase
        .from('doctors')
        .select('id, name, specialization, consultation_fee, clinic_id')
        .is('deleted_at', null)

      if (data) setDoctors(data)
    }
    fetchDoctors()
  }, [supabase])

  const handleBook = async () => {
    if (!patientId || !selectedDoctor || !selectedDate) return
    setLoading(true)

    try {
      const { error } = await supabase.from('appointments').insert({
        patient_id: patientId,
        doctor_id: selectedDoctor.id,
        clinic_id: selectedDoctor.clinic_id,
        queue_date: selectedDate,
        visit_type: visitType,
        status: 'scheduled',
        consultation_fee: selectedDoctor.consultation_fee,
        payment_status: 'pending',
      })

      if (error) throw error
      setSuccess(true)
      setTimeout(() => router.push('/appointments'), 2000)
    } catch (err) {
      logger.error({ err }, 'Failed to book appointment')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <CheckCircle size={48} className="mb-4 text-success" />
        <h2 className="text-lg font-bold text-text">Appointment Booked!</h2>
        <p className="mt-2 text-sm text-muted">Redirecting to appointments...</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-bg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-text">Book Appointment</h1>
      </div>

      {/* Progress */}
      <div className="mb-6 flex items-center gap-2">
        {(['doctor', 'date', 'confirm'] as BookingStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                step === s ? 'bg-primary text-white' :
                (['doctor', 'date', 'confirm'].indexOf(step) > i) ? 'bg-success text-white' : 'bg-bg text-muted'
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && <div className="h-0.5 w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Doctor */}
      {step === 'doctor' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-text">Select a Doctor</p>
          {doctors.map((doc) => (
            <button
              key={doc.id}
              onClick={() => { setSelectedDoctor(doc); setStep('date') }}
              className={`card block w-full text-left ${
                selectedDoctor?.id === doc.id ? 'border-primary' : ''
              }`}
            >
              <p className="text-sm font-semibold text-text">Dr. {doc.name}</p>
              <p className="text-xs text-muted">{doc.specialization}</p>
              <p className="mt-1 text-xs text-primary">₹{doc.consultation_fee}</p>
            </button>
          ))}
          {doctors.length === 0 && (
            <p className="text-center text-sm text-muted">No doctors available</p>
          )}
        </div>
      )}

      {/* Step 2: Select Date */}
      {step === 'date' && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-text">Select Date & Type</p>

          <div>
            <label className="mb-1 block text-xs text-muted">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="input"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted">Visit Type</label>
            <div className="flex gap-2">
              {(['scheduled', 'followup', 'walkin'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setVisitType(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                    visitType === t ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted'
                  }`}
                >
                  {t === 'scheduled' ? 'Scheduled' : t === 'followup' ? 'Follow-up' : 'Walk-in'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('doctor')} className="btn-secondary flex-1">
              Back
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={!selectedDate}
              className="btn-primary flex-1"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && selectedDoctor && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-text">Confirm Appointment</p>

          <div className="card space-y-2">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-muted" />
              <span className="text-sm text-text">{selectedDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted" />
              <span className="text-sm text-text capitalize">{visitType}</span>
            </div>
            <div className="border-t border-border pt-2">
              <p className="text-sm font-semibold text-text">Dr. {selectedDoctor.name}</p>
              <p className="text-xs text-muted">{selectedDoctor.specialization}</p>
              <p className="mt-1 text-sm font-medium text-primary">₹{selectedDoctor.consultation_fee}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('date')} className="btn-secondary flex-1">
              Back
            </button>
            <button
              onClick={handleBook}
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
