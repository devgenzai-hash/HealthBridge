'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useQueue, type QueueItem } from '@/hooks/use-queue'
import { createClient } from '@/lib/supabase/client'
import { formatPhone, getInitials } from '@/lib/utils'
import Link from 'next/link'
import {
  Plus, Search, UserPlus, Clock, Stethoscope, CheckCircle,
  XCircle, ChevronRight, Brain, RefreshCw, GripVertical, Clipboard
} from 'lucide-react'
import type { AppointmentStatus } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  waiting: { label: 'Waiting', color: 'bg-warning/10 text-warning', icon: Clock },
  in_consultation: { label: 'In Consultation', color: 'bg-primary/10 text-primary', icon: Stethoscope },
  done: { label: 'Done', color: 'bg-success/10 text-success', icon: CheckCircle },
  no_show: { label: 'No Show', color: 'bg-muted/10 text-muted', icon: XCircle },
}

export default function DoctorQueuePage() {
  const { doctorId } = useAuth()
  const { queue, loading, error, refresh, addWalkin, updateStatus } = useQueue({
    doctorId: doctorId || '',
  })
  const [showAddWalkin, setShowAddWalkin] = useState(false)
  const [searchPhone, setSearchPhone] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; phone: string }>>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const supabase = createClient()

  const waitingCount = queue.filter((q) => q.status === 'waiting').length
  const inConsultation = queue.find((q) => q.status === 'in_consultation')

  const handleSearch = useCallback(async () => {
    if (searchPhone.length < 3) return
    setSearchLoading(true)

    const { data } = await supabase
      .from('patients')
      .select('id, name, phone')
      .or(`phone.ilike.%${searchPhone}%,name.ilike.%${searchPhone}%`)
      .is('deleted_at', null)
      .limit(5)

    setSearchResults(data || [])
    setSearchLoading(false)
  }, [searchPhone, supabase])

  const handleAddToQueue = useCallback(async (patientId: string) => {
    await addWalkin(patientId)
    setShowAddWalkin(false)
    setSearchPhone('')
    setSearchResults([])
  }, [addWalkin])

  const handleStatusChange = useCallback(async (appointmentId: string, newStatus: AppointmentStatus) => {
    await updateStatus(appointmentId, newStatus)
  }, [updateStatus])

  if (!doctorId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted">Loading doctor profile...</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Today&apos;s Queue</h1>
          <p className="text-sm text-muted">
            {waitingCount} waiting • {queue.filter((q) => q.status === 'done').length} done
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="rounded-lg p-2 text-muted hover:bg-card">
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowAddWalkin(true)}
            className="btn-primary !min-h-[36px] !px-3 gap-1.5"
          >
            <Plus size={16} />
            Walk-in
          </button>
        </div>
      </div>

      {/* Currently Consulting */}
      {inConsultation && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-1 text-xs font-medium text-primary">Currently Consulting</p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text">{inConsultation.patientName}</p>
            <Link
              href={`/queue/${inConsultation.id}/briefing`}
              className="flex items-center gap-1 text-xs text-primary"
            >
              <Brain size={12} />
              Briefing
            </Link>
          </div>
        </div>
      )}

      {/* Add Walk-in Modal */}
      {showAddWalkin && (
        <div className="mb-6 card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Add Walk-in Patient</h3>
            <button onClick={() => setShowAddWalkin(false)} className="text-xs text-muted">
              Cancel
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              placeholder="Search by phone or name"
              className="input flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="btn-primary !min-h-[44px]">
              <Search size={16} />
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleAddToQueue(patient.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-bg"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {getInitials(patient.name)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text">{patient.name}</p>
                    <p className="text-xs text-muted">{formatPhone(patient.phone)}</p>
                  </div>
                  <UserPlus size={16} className="text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Queue List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="flex flex-col items-center gap-3 pt-16 text-center">
          <Clipboard size={40} className="text-muted" />
          <p className="text-sm text-muted">No patients in queue today</p>
          <button onClick={() => setShowAddWalkin(true)} className="btn-primary gap-2">
            <Plus size={16} />
            Add Walk-in Patient
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {queue
            .filter((item) => item.status !== 'done' && item.status !== 'no_show')
            .map((item) => (
              <QueueCard
                key={item.id}
                item={item}
                onStatusChange={handleStatusChange}
              />
            ))}

          {/* Completed section */}
          {queue.filter((q) => q.status === 'done').length > 0 && (
            <>
              <div className="pt-4 pb-2">
                <p className="text-xs font-medium text-muted">Completed ({queue.filter((q) => q.status === 'done').length})</p>
              </div>
              {queue
                .filter((q) => q.status === 'done')
                .map((item) => (
                  <QueueCard key={item.id} item={item} onStatusChange={handleStatusChange} />
                ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function QueueCard({
  item,
  onStatusChange,
}: {
  item: QueueItem
  onStatusChange: (id: string, status: AppointmentStatus) => void
}) {
  const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.waiting
  const Icon = config.icon

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      {/* Drag handle + position */}
      <div className="flex flex-col items-center gap-1">
        <GripVertical size={14} className="text-muted" />
        <span className="text-xs font-bold text-muted">#{item.queuePosition}</span>
      </div>

      {/* Patient info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-text">{item.patientName}</p>
          {item.visitType === 'walkin' && (
            <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[9px] font-medium text-warning">
              Walk-in
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}>
            <Icon size={10} />
            {config.label}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {item.status === 'waiting' && (
          <button
            onClick={() => onStatusChange(item.id, 'in_consultation')}
            className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[10px] font-medium text-primary"
          >
            Start
          </button>
        )}
        {item.status === 'in_consultation' && (
          <button
            onClick={() => onStatusChange(item.id, 'done')}
            className="rounded-lg bg-success/10 px-2.5 py-1.5 text-[10px] font-medium text-success"
          >
            Done
          </button>
        )}
        <Link
          href={`/queue/${item.id}/briefing`}
          className="rounded-lg p-1.5 text-muted hover:bg-bg"
        >
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  )
}
