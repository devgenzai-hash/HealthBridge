'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Search, User } from 'lucide-react'
import Link from 'next/link'
import { getInitials, formatPhone } from '@/lib/utils'

interface Patient {
  id: string
  name: string
  phone: string
  lastVisit: string | null
  visitCount: number
}

export default function DoctorPatientsPage() {
  const { doctorId } = useAuth()
  const supabase = createClient()
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!doctorId) return

    async function fetchPatients() {
      // Get unique patients from appointments
      const { data } = await supabase
        .from('appointments')
        .select('patient_id, queue_date, patients(id, name, phone)')
        .eq('doctor_id', doctorId)
        .is('deleted_at', null)
        .order('queue_date', { ascending: false })
        .limit(200)

      if (data) {
        const patientMap = new Map<string, Patient>()
        for (const appt of data) {
          const p = appt.patients as unknown as { id: string; name: string; phone: string }
          if (!p) continue
          const existing = patientMap.get(p.id)
          if (existing) {
            existing.visitCount++
          } else {
            patientMap.set(p.id, {
              id: p.id,
              name: p.name,
              phone: p.phone,
              lastVisit: appt.queue_date,
              visitCount: 1,
            })
          }
        }
        setPatients(Array.from(patientMap.values()))
      }
      setLoading(false)
    }

    fetchPatients()
  }, [doctorId, supabase])

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  )

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="mb-4 text-xl font-bold text-text">My Patients</h1>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="input pl-9"
        />
      </div>

      {/* Patient List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="pt-12 text-center">
          <User size={40} className="mx-auto mb-3 text-muted" />
          <p className="text-sm text-muted">
            {search ? 'No patients match your search' : 'No patients yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((patient) => (
            <Link
              key={patient.id}
              href={`/patients/${patient.id}`}
              className="card flex items-center gap-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {getInitials(patient.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">{patient.name}</p>
                <p className="text-xs text-muted">{formatPhone(patient.phone)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">{patient.visitCount} visits</p>
                {patient.lastVisit && (
                  <p className="text-[10px] text-muted">
                    Last: {new Date(patient.lastVisit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
