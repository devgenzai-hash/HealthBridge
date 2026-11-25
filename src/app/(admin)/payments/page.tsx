'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { IndianRupee, CheckCircle, Clock, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Payment {
  id: string
  appointment_id: string
  amount: number
  status: 'pending' | 'paid' | 'failed'
  method: string | null
  created_at: string
  patient_name: string
}

export default function AdminPaymentsPage() {
  const { clinicId } = useAuth()
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all')
  const [totals, setTotals] = useState({ collected: 0, pending: 0 })

  useEffect(() => {
    if (!clinicId) return

    async function fetchPayments() {
      const { data } = await supabase
        .from('appointments')
        .select('id, payment_status, payment_amount, payment_method, created_at, patients(name)')
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .not('payment_amount', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) {
        const mapped: Payment[] = data.map((d) => ({
          id: d.id,
          appointment_id: d.id,
          amount: d.payment_amount || 0,
          status: d.payment_status as Payment['status'] || 'pending',
          method: d.payment_method,
          created_at: d.created_at,
          patient_name: (d.patients as unknown as { name: string })?.name || 'Unknown',
        }))
        setPayments(mapped)

        const collected = mapped
          .filter((p) => p.status === 'paid')
          .reduce((sum, p) => sum + p.amount, 0)
        const pending = mapped
          .filter((p) => p.status === 'pending')
          .reduce((sum, p) => sum + p.amount, 0)
        setTotals({ collected, pending })
      }
      setLoading(false)
    }

    fetchPayments()
  }, [clinicId, supabase])

  const filtered = filter === 'all' ? payments : payments.filter((p) => p.status === filter)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle size={14} className="text-success" />
      case 'pending': return <Clock size={14} className="text-warning" />
      case 'failed': return <XCircle size={14} className="text-error" />
      default: return null
    }
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="mb-4 text-xl font-bold text-text">Payments</h1>

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-xs text-muted">Collected</p>
          <p className="text-lg font-bold text-success">₹{totals.collected.toLocaleString('en-IN')}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-muted">Pending</p>
          <p className="text-lg font-bold text-warning">₹{totals.pending.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2">
        {(['all', 'paid', 'pending', 'failed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              filter === f ? 'bg-primary text-white' : 'bg-bg text-muted'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Payments List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="pt-12 text-center">
          <IndianRupee size={32} className="mx-auto mb-3 text-muted" />
          <p className="text-sm text-muted">No payments found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((payment) => (
            <div key={payment.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(payment.status)}
                <div>
                  <p className="text-sm font-medium text-text">{payment.patient_name}</p>
                  <p className="text-xs text-muted">
                    {formatDate(payment.created_at)}
                    {payment.method && ` · ${payment.method}`}
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold text-text">₹{payment.amount}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
