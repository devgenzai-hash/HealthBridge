'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Settings, Clock, IndianRupee, Globe, Save, CheckCircle, Loader2 } from 'lucide-react'
import { logger } from '@/lib/logger'

interface ClinicSettings {
  name: string
  address: string
  phone: string
  consultation_fee: number
  working_hours_start: string
  working_hours_end: string
  working_days: string[]
  languages: string[]
  auto_queue: boolean
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function AdminSettingsPage() {
  const { clinicId } = useAuth()
  const supabase = createClient()
  const [settings, setSettings] = useState<ClinicSettings>({
    name: '',
    address: '',
    phone: '',
    consultation_fee: 300,
    working_hours_start: '09:00',
    working_hours_end: '18:00',
    working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    languages: ['en', 'hi'],
    auto_queue: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!clinicId) return

    async function fetchSettings() {
      const { data } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', clinicId)
        .single()

      if (data) {
        setSettings({
          name: data.name || '',
          address: data.address || '',
          phone: data.phone || '',
          consultation_fee: data.consultation_fee || 300,
          working_hours_start: data.working_hours_start || '09:00',
          working_hours_end: data.working_hours_end || '18:00',
          working_days: data.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
          languages: data.languages || ['en', 'hi'],
          auto_queue: data.auto_queue ?? true,
        })
      }
      setLoading(false)
    }

    fetchSettings()
  }, [clinicId, supabase])

  const handleSave = async () => {
    if (!clinicId) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('clinics')
        .update({
          name: settings.name,
          address: settings.address,
          phone: settings.phone,
          consultation_fee: settings.consultation_fee,
          working_hours_start: settings.working_hours_start,
          working_hours_end: settings.working_hours_end,
          working_days: settings.working_days,
          languages: settings.languages,
          auto_queue: settings.auto_queue,
        })
        .eq('id', clinicId)

      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      logger.error({ err }, 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (day: string) => {
    setSettings((prev) => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter((d) => d !== day)
        : [...prev.working_days, day],
    }))
  }

  if (loading) {
    return (
      <div className="px-4 pt-12">
        <div className="skeleton mb-4 h-6 w-32 rounded" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4">
      <h1 className="mb-6 text-xl font-bold text-text">Clinic Settings</h1>

      <div className="space-y-4">
        {/* Basic Info */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Clinic Name</label>
          <input
            type="text"
            value={settings.name}
            onChange={(e) => setSettings((prev) => ({ ...prev, name: e.target.value }))}
            className="input"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Address</label>
          <textarea
            value={settings.address}
            onChange={(e) => setSettings((prev) => ({ ...prev, address: e.target.value }))}
            rows={2}
            className="input resize-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Phone</label>
          <input
            type="tel"
            value={settings.phone}
            onChange={(e) => setSettings((prev) => ({ ...prev, phone: e.target.value }))}
            className="input"
          />
        </div>

        {/* Consultation Fee */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
            <IndianRupee size={10} /> Consultation Fee
          </label>
          <input
            type="number"
            value={settings.consultation_fee}
            onChange={(e) => setSettings((prev) => ({ ...prev, consultation_fee: parseInt(e.target.value) || 0 }))}
            className="input"
          />
        </div>

        {/* Working Hours */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
            <Clock size={10} /> Working Hours
          </label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={settings.working_hours_start}
              onChange={(e) => setSettings((prev) => ({ ...prev, working_hours_start: e.target.value }))}
              className="input flex-1"
            />
            <span className="text-muted">to</span>
            <input
              type="time"
              value={settings.working_hours_end}
              onChange={(e) => setSettings((prev) => ({ ...prev, working_hours_end: e.target.value }))}
              className="input flex-1"
            />
          </div>
        </div>

        {/* Working Days */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted">Working Days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  settings.working_days.includes(day)
                    ? 'bg-primary text-white'
                    : 'bg-bg text-muted'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Auto Queue */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text">Auto Queue</p>
            <p className="text-xs text-muted">Automatically assign queue numbers</p>
          </div>
          <button
            onClick={() => setSettings((prev) => ({ ...prev, auto_queue: !prev.auto_queue }))}
            className={`h-6 w-11 rounded-full transition-colors ${
              settings.auto_queue ? 'bg-primary' : 'bg-border'
            }`}
          >
            <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
              settings.auto_queue ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary mt-8 w-full gap-2"
      >
        {saving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : saved ? (
          <CheckCircle size={16} />
        ) : (
          <Save size={16} />
        )}
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}
