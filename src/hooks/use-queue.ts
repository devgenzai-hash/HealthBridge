/**
 * useQueue hook — abstracts doctor queue polling.
 * v1: Polls every 2 minutes.
 * v2: Swap to Supabase real-time subscription without changing consumers.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppointmentStatus } from '@/types/database'

export interface QueueItem {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  queuePosition: number
  status: AppointmentStatus
  visitType: string
  scheduledAt: string | null
  hasBriefing: boolean
}

interface UseQueueOptions {
  doctorId: string
  date?: string // YYYY-MM-DD, defaults to today
  pollInterval?: number // ms, defaults to 2 min
}

interface UseQueueReturn {
  queue: QueueItem[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  addWalkin: (patientId: string) => Promise<void>
  updateStatus: (appointmentId: string, status: AppointmentStatus) => Promise<void>
  reorder: (appointmentId: string, newPosition: number) => Promise<void>
}

export function useQueue({ doctorId, date, pollInterval = 120000 }: UseQueueOptions): UseQueueReturn {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const queueDate = date || new Date().toISOString().split('T')[0]

  const fetchQueue = useCallback(async () => {
    if (!doctorId) {
      setQueue([])
      setError(null)
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('appointments')
        .select(`
          id,
          patient_id,
          queue_position,
          status,
          visit_type,
          scheduled_at,
          patients!inner(name, phone)
        `)
        .eq('doctor_id', doctorId)
        .eq('queue_date', queueDate)
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .order('queue_position', { ascending: true })

      if (fetchError) throw fetchError

      const items: QueueItem[] = (data || []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        patientId: item.patient_id as string,
        patientName: (item.patients as Record<string, string>)?.name || 'Unknown',
        patientPhone: (item.patients as Record<string, string>)?.phone || '',
        queuePosition: item.queue_position as number,
        status: item.status as AppointmentStatus,
        visitType: item.visit_type as string,
        scheduledAt: item.scheduled_at as string | null,
        hasBriefing: false, // TODO: Check if briefing exists
      }))

      setQueue(items)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch queue')
    } finally {
      setLoading(false)
    }
  }, [supabase, doctorId, queueDate])

  // Initial fetch + polling
  useEffect(() => {
    fetchQueue()

    const interval = setInterval(fetchQueue, pollInterval)

    // Also refresh on window focus
    const handleFocus = () => fetchQueue()
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchQueue, pollInterval])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchQueue()
  }, [fetchQueue])

  const addWalkin = useCallback(
    async (patientId: string) => {
      if (!doctorId) throw new Error('Doctor profile is not loaded')

      const maxPosition = queue.length > 0 ? Math.max(...queue.map((q) => q.queuePosition)) : 0

      const { error: insertError } = await supabase.from('appointments').insert({
        patient_id: patientId,
        doctor_id: doctorId,
        clinic_id: '', // TODO: get from doctor context
        queue_date: queueDate,
        queue_position: maxPosition + 1,
        status: 'waiting',
        visit_type: 'walkin',
        consultation_fee: 0,
        payment_status: 'pending',
      })

      if (insertError) throw insertError
      await fetchQueue()
    },
    [supabase, doctorId, queueDate, queue, fetchQueue]
  )

  const updateStatus = useCallback(
    async (appointmentId: string, status: AppointmentStatus) => {
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId)

      if (updateError) throw updateError
      await fetchQueue()
    },
    [supabase, fetchQueue]
  )

  const reorder = useCallback(
    async (appointmentId: string, newPosition: number) => {
      // Batch update positions
      const updatedQueue = [...queue]
      const itemIndex = updatedQueue.findIndex((q) => q.id === appointmentId)
      if (itemIndex === -1) return

      const [item] = updatedQueue.splice(itemIndex, 1)
      updatedQueue.splice(newPosition - 1, 0, item)

      // Update all positions
      const updates = updatedQueue.map((q, i) => ({
        id: q.id,
        queue_position: i + 1,
      }))

      for (const update of updates) {
        await supabase
          .from('appointments')
          .update({ queue_position: update.queue_position })
          .eq('id', update.id)
      }

      await fetchQueue()
    },
    [supabase, queue, fetchQueue]
  )

  return { queue, loading, error, refresh, addWalkin, updateStatus, reorder }
}
