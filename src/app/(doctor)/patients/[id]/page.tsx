'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, FileText, Calendar, Heart, Activity } from 'lucide-react'
import { formatDate, getInitials } from '@/lib/utils'

interface PatientDetails {
  id: string
  name: string
  phone: string
  date_of_birth: string | null
  gender: string | null
  blood_group: string | null
}

interface Visit {
  id: string
  queue_date: string
  status: string
  diagnosis: string | null
}

interface Vital {
  id: string
  recorded_at: string
  bp_systolic: number | null
  bp_diastolic: number | null
  pulse: number | null
  weight: number | null
}

export default function PatientDetailPage() {
  const { id: patientId } = useParams<{ id: string }>()
  const { doctorId } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [patient, setPatient] = useState<PatientDetails | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [vitals, setVitals] = useState<Vital[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId || !doctorId) return

    async function fetchData() {
      const [patientRes, visitsRes, vitalsRes] = await Promise.all([
        supabase
          .from('patients')
          .select('id, name, phone, date_of_birth, gender, blood_group')
          .eq('id', patientId)
          .single(),
        supabase
          .from('appointments')
          .select('id, queue_date, status, diagnosis')
          .eq('patient_id', patientId)
          .eq('doctor_id', doctorId)
          .is('deleted_at', null)
          .order('queue_date', { ascending: false })
          .limit(10),
        supabase
          .from('patient_vitals')
          .select('id, recorded_at, bp_systolic, bp_diastolic, pulse, weight')
          .eq('patient_id', patientId)
          .is('deleted_at', null)
          .order('recorded_at', { ascending: false })
          .limit(5),
      ])

      if (patientRes.data) setPatient(patientRes.data)
      if (visitsRes.data) setVisits(visitsRes.data)
      if (vitalsRes.data) setVitals(vitalsRes.data)
      setLoading(false)
    }

    fetchData()
  }, [patientId, doctorId, supabase])

  if (loading || !patient) {
    return (
      <div className="px-4 pt-12">
        <div className="skeleton mb-4 h-20 rounded-xl" />
        <div className="skeleton mb-3 h-32 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-bg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-text">Patient Profile</h1>
      </div>

      {/* Patient Header */}
      <div className="card mb-4 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {getInitials(patient.name)}
        </div>
        <div>
          <p className="text-base font-semibold text-text">{patient.name}</p>
          <div className="flex gap-3 text-xs text-muted">
            {patient.gender && <span className="capitalize">{patient.gender}</span>}
            {patient.date_of_birth && <span>{formatDate(patient.date_of_birth)}</span>}
            {patient.blood_group && (
              <span className="flex items-center gap-0.5">
                <Heart size={10} /> {patient.blood_group}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Latest Vitals */}
      {vitals.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Activity size={14} /> Latest Vitals
          </h2>
          <div className="card grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-xs text-muted">BP</p>
              <p className="text-sm font-medium text-text">
                {vitals[0].bp_systolic ? `${vitals[0].bp_systolic}/${vitals[0].bp_diastolic}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Pulse</p>
              <p className="text-sm font-medium text-text">{vitals[0].pulse || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Weight</p>
              <p className="text-sm font-medium text-text">{vitals[0].weight ? `${vitals[0].weight}kg` : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Date</p>
              <p className="text-sm font-medium text-text">
                {new Date(vitals[0].recorded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Visit History */}
      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted">
          <Calendar size={14} /> Visit History
        </h2>
        {visits.length === 0 ? (
          <p className="text-xs text-muted">No visit history</p>
        ) : (
          <div className="space-y-2">
            {visits.map((visit) => (
              <div key={visit.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm text-text">{formatDate(visit.queue_date)}</p>
                  {visit.diagnosis && (
                    <p className="text-xs text-muted">{visit.diagnosis}</p>
                  )}
                </div>
                <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                  visit.status === 'done' ? 'bg-success/10 text-success' : 'bg-bg text-muted'
                }`}>
                  {visit.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
