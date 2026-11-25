'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Camera, Save, CheckCircle, Loader2 } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Vitals {
  bp_systolic: string
  bp_diastolic: string
  pulse: string
  temperature: string
  weight: string
  height: string
  spo2: string
  respiratory_rate: string
}

export default function VitalsPage() {
  const { id: appointmentId } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [vitals, setVitals] = useState<Vitals>({
    bp_systolic: '',
    bp_diastolic: '',
    pulse: '',
    temperature: '',
    weight: '',
    height: '',
    spo2: '',
    respiratory_rate: '',
  })
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [success, setSuccess] = useState(false)

  const updateVital = (key: keyof Vitals, value: string) => {
    setVitals((prev) => ({ ...prev, [key]: value }))
  }

  const handleImageExtract = async (file: File) => {
    setExtracting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/vitals/extract', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (data.vitals) {
          setVitals((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(data.vitals).filter(([, v]) => v != null && v !== '')
            ),
          }))
        }
      }
    } catch (err) {
      logger.error({ err }, 'Vitals extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  const handleSubmit = async () => {
    if (!appointmentId) return
    setLoading(true)

    try {
      // Get patient_id from appointment
      const { data: appt } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('id', appointmentId)
        .single()

      if (!appt) throw new Error('Appointment not found')

      const { error } = await supabase.from('patient_vitals').insert({
        patient_id: appt.patient_id,
        appointment_id: appointmentId,
        bp_systolic: vitals.bp_systolic ? parseInt(vitals.bp_systolic) : null,
        bp_diastolic: vitals.bp_diastolic ? parseInt(vitals.bp_diastolic) : null,
        pulse: vitals.pulse ? parseInt(vitals.pulse) : null,
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : null,
        weight: vitals.weight ? parseFloat(vitals.weight) : null,
        height: vitals.height ? parseFloat(vitals.height) : null,
        spo2: vitals.spo2 ? parseInt(vitals.spo2) : null,
        respiratory_rate: vitals.respiratory_rate ? parseInt(vitals.respiratory_rate) : null,
        recorded_at: new Date().toISOString(),
      })

      if (error) throw error
      setSuccess(true)
      setTimeout(() => router.back(), 1500)
    } catch (err) {
      logger.error({ err }, 'Failed to save vitals')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <CheckCircle size={48} className="mb-4 text-success" />
        <h2 className="text-lg font-bold text-text">Vitals Recorded</h2>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-bg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-text">Record Vitals</h1>
      </div>

      {/* AI Extract from Photo */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={extracting}
        className="btn-secondary mb-6 w-full gap-2"
      >
        {extracting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
        {extracting ? 'Extracting...' : 'Extract from Photo (AI)'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImageExtract(file)
        }}
      />

      {/* Vitals Form */}
      <div className="space-y-4">
        {/* Blood Pressure */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Blood Pressure (mmHg)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={vitals.bp_systolic}
              onChange={(e) => updateVital('bp_systolic', e.target.value)}
              placeholder="Systolic"
              className="input flex-1"
            />
            <span className="text-muted">/</span>
            <input
              type="number"
              value={vitals.bp_diastolic}
              onChange={(e) => updateVital('bp_diastolic', e.target.value)}
              placeholder="Diastolic"
              className="input flex-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Pulse (bpm)</label>
            <input
              type="number"
              value={vitals.pulse}
              onChange={(e) => updateVital('pulse', e.target.value)}
              placeholder="72"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Temperature (°F)</label>
            <input
              type="number"
              step="0.1"
              value={vitals.temperature}
              onChange={(e) => updateVital('temperature', e.target.value)}
              placeholder="98.6"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={vitals.weight}
              onChange={(e) => updateVital('weight', e.target.value)}
              placeholder="70"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Height (cm)</label>
            <input
              type="number"
              value={vitals.height}
              onChange={(e) => updateVital('height', e.target.value)}
              placeholder="170"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">SpO2 (%)</label>
            <input
              type="number"
              value={vitals.spo2}
              onChange={(e) => updateVital('spo2', e.target.value)}
              placeholder="98"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Resp. Rate</label>
            <input
              type="number"
              value={vitals.respiratory_rate}
              onChange={(e) => updateVital('respiratory_rate', e.target.value)}
              placeholder="16"
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="btn-primary mt-6 w-full gap-2"
      >
        <Save size={16} />
        {loading ? 'Saving...' : 'Save Vitals'}
      </button>
    </div>
  )
}
