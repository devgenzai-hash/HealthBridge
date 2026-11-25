'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Search, User, Phone, Calendar } from 'lucide-react'
import { getInitials, formatPhone, formatDate } from '@/lib/utils'

interface Patient {
  id: string
  name: string
  phone: string
  date_of_birth: string | null
  gender: string | null
  created_at: string
}

export default function AdminPatientsPage() {
  const { clinicId } = useAuth()
  const supabase = createClient()
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!clinicId) return

    async function fetchPatients() {
      const { data, count } = await supabase
        .from('patients')
        .select('id, name, phone, date_of_birth, gender, created_at', { count: 'exact' })
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) setPatients(data)
      if (count !== null) setTotal(count)
      setLoading(false)
    }

    fetchPatients()
  }, [clinicId, supabase])

  const filtered = search
    ? patients.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.phone.includes(search)
      )
    : patients

  return (
    <div className="px-4 pt-12 pb-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-text">Patients</h1>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {total} total
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patients..."
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
          <p className="text-sm text-muted">No patients found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((patient) => (
            <div key={patient.id} className="card flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {getInitials(patient.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">{patient.name}</p>
                <div className="flex gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Phone size={10} /> {formatPhone(patient.phone)}
                  </span>
                  {patient.gender && <span className="capitalize">{patient.gender}</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted">
                  <Calendar size={10} className="inline" />{' '}
                  {new Date(patient.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
