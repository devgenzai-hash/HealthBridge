'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Pill, Calendar, User, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Prescription {
  id: string
  medicine_name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string | null
  prescribed_at: string
  doctor_name: string
  is_active: boolean
}

export default function MedicinesPage() {
  const { patientId } = useAuth()
  const supabase = createClient()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'past'>('active')

  useEffect(() => {
    if (!patientId) return

    async function fetchPrescriptions() {
      const { data } = await supabase
        .from('prescriptions')
        .select('id, medicine_name, dosage, frequency, duration, instructions, created_at, doctors(name)')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (data) {
        const now = new Date()
        const mapped: Prescription[] = data.map((p) => {
          // Estimate if still active based on duration (e.g. "7 days", "2 weeks")
          const daysMatch = p.duration?.match(/(\d+)\s*day/i)
          const weeksMatch = p.duration?.match(/(\d+)\s*week/i)
          const durationDays = daysMatch ? parseInt(daysMatch[1]) : weeksMatch ? parseInt(weeksMatch[1]) * 7 : 30

          const prescribedDate = new Date(p.created_at)
          const endDate = new Date(prescribedDate.getTime() + durationDays * 86400000)
          const isActive = endDate > now

          return {
            id: p.id,
            medicine_name: p.medicine_name,
            dosage: p.dosage,
            frequency: p.frequency,
            duration: p.duration,
            instructions: p.instructions,
            prescribed_at: p.created_at,
            doctor_name: (p.doctors as unknown as { name: string })?.name || 'Doctor',
            is_active: isActive,
          }
        })
        setPrescriptions(mapped)
      }
      setLoading(false)
    }

    fetchPrescriptions()
  }, [patientId, supabase])

  const filtered = prescriptions.filter((p) =>
    tab === 'active' ? p.is_active : !p.is_active
  )

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="mb-4 text-xl font-bold text-text">My Medicines</h1>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('active')}
          className={`rounded-full px-4 py-1.5 text-xs font-medium ${
            tab === 'active' ? 'bg-primary text-white' : 'bg-bg text-muted'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setTab('past')}
          className={`rounded-full px-4 py-1.5 text-xs font-medium ${
            tab === 'past' ? 'bg-primary text-white' : 'bg-bg text-muted'
          }`}
        >
          Past
        </button>
      </div>

      {/* Prescription List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="pt-12 text-center">
          <Pill size={40} className="mx-auto mb-3 text-muted" />
          <p className="text-sm text-muted">
            {tab === 'active' ? 'No active prescriptions' : 'No past prescriptions'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rx) => (
            <div key={rx.id} className="card">
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Pill size={14} className={rx.is_active ? 'text-primary' : 'text-muted'} />
                  <h3 className="text-sm font-semibold text-text">{rx.medicine_name}</h3>
                </div>
                {rx.is_active && (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                    Active
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-muted">
                <div>
                  <p className="font-medium text-text">{rx.dosage}</p>
                  <p>Dosage</p>
                </div>
                <div>
                  <p className="font-medium text-text">{rx.frequency}</p>
                  <p>Frequency</p>
                </div>
                <div>
                  <p className="font-medium text-text">{rx.duration}</p>
                  <p>Duration</p>
                </div>
              </div>

              {rx.instructions && (
                <p className="mt-2 text-xs text-muted italic">💊 {rx.instructions}</p>
              )}

              <div className="mt-2 flex items-center gap-3 border-t border-border pt-2 text-[10px] text-muted">
                <span className="flex items-center gap-0.5">
                  <User size={9} /> Dr. {rx.doctor_name}
                </span>
                <span className="flex items-center gap-0.5">
                  <Calendar size={9} /> {formatDate(rx.prescribed_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
