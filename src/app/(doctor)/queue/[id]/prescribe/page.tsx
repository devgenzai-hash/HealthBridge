'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2, Save, CheckCircle } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Medicine {
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

export default function PrescribePage() {
  const { id: appointmentId } = useParams<{ id: string }>()
  const { doctorId } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [diagnosis, setDiagnosis] = useState('')
  const [medicines, setMedicines] = useState<Medicine[]>([
    { name: '', dosage: '', frequency: 'twice daily', duration: '7 days', instructions: '' },
  ])
  const [followUpDate, setFollowUpDate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const addMedicine = () => {
    setMedicines([...medicines, { name: '', dosage: '', frequency: 'twice daily', duration: '7 days', instructions: '' }])
  }

  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index))
  }

  const updateMedicine = (index: number, field: keyof Medicine, value: string) => {
    const updated = [...medicines]
    updated[index] = { ...updated[index], [field]: value }
    setMedicines(updated)
  }

  const handleSubmit = async () => {
    if (!doctorId || !appointmentId || !diagnosis.trim()) return
    setLoading(true)

    try {
      // Get patient_id from appointment
      const { data: appt } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('id', appointmentId)
        .single()

      if (!appt) throw new Error('Appointment not found')

      // Create prescription
      const { error: rxError } = await supabase.from('prescriptions').insert({
        appointment_id: appointmentId,
        patient_id: appt.patient_id,
        doctor_id: doctorId,
        diagnosis,
        medicines: medicines.filter((m) => m.name.trim()),
        follow_up_date: followUpDate || null,
        notes: notes || null,
      })

      if (rxError) throw rxError

      // Update appointment with diagnosis
      await supabase
        .from('appointments')
        .update({
          diagnosis,
          status: 'done',
          follow_up_date: followUpDate || null,
          notes,
        })
        .eq('id', appointmentId)

      setSuccess(true)
      setTimeout(() => router.push('/queue'), 2000)
    } catch (err) {
      logger.error({ err }, 'Failed to save prescription')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <CheckCircle size={48} className="mb-4 text-success" />
        <h2 className="text-lg font-bold text-text">Prescription Saved</h2>
        <p className="mt-2 text-sm text-muted">Returning to queue...</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-bg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-text">Prescribe</h1>
      </div>

      {/* Diagnosis */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-muted">Diagnosis *</label>
        <textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="Enter diagnosis..."
          rows={2}
          className="input"
        />
      </div>

      {/* Medicines */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-muted">Medicines</label>
          <button onClick={addMedicine} className="flex items-center gap-1 text-xs text-primary">
            <Plus size={12} /> Add
          </button>
        </div>
        <div className="space-y-3">
          {medicines.map((med, i) => (
            <div key={i} className="card relative">
              {medicines.length > 1 && (
                <button
                  onClick={() => removeMedicine(i)}
                  className="absolute right-2 top-2 text-danger"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <input
                type="text"
                value={med.name}
                onChange={(e) => updateMedicine(i, 'name', e.target.value)}
                placeholder="Medicine name"
                className="input mb-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={med.dosage}
                  onChange={(e) => updateMedicine(i, 'dosage', e.target.value)}
                  placeholder="Dosage (e.g., 500mg)"
                  className="input"
                />
                <select
                  value={med.frequency}
                  onChange={(e) => updateMedicine(i, 'frequency', e.target.value)}
                  className="input"
                >
                  <option value="once daily">Once daily</option>
                  <option value="twice daily">Twice daily</option>
                  <option value="thrice daily">Thrice daily</option>
                  <option value="as needed">As needed</option>
                  <option value="before meals">Before meals</option>
                  <option value="after meals">After meals</option>
                </select>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={med.duration}
                  onChange={(e) => updateMedicine(i, 'duration', e.target.value)}
                  placeholder="Duration (e.g., 7 days)"
                  className="input"
                />
                <input
                  type="text"
                  value={med.instructions}
                  onChange={(e) => updateMedicine(i, 'instructions', e.target.value)}
                  placeholder="Special instructions"
                  className="input"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Follow-up & Notes */}
      <div className="mb-4 grid grid-cols-1 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Follow-up Date</label>
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={2}
            className="input"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !diagnosis.trim()}
        className="btn-primary w-full gap-2"
      >
        <Save size={16} />
        {loading ? 'Saving...' : 'Save Prescription'}
      </button>
    </div>
  )
}
