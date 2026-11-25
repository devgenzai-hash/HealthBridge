'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { formatRelativeTime } from '@/lib/utils'
import { Droplet, Heart, Scale, Footprints, Moon, GlassWater, Smile, AlertCircle, Flame, X, TrendingUp, Plus, Activity } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { ChatWidget } from '@/components/chat/chat-widget'

const DEFAULT_CATEGORIES = [
  { id: 'blood_sugar', label: 'Blood Sugar', icon: 'Droplet', emoji: '🩸', color: 'bg-red-500/10 text-red-500', chartColor: '#ef4444' },
  { id: 'bp', label: 'BP', icon: 'Heart', emoji: '❤️', color: 'bg-pink-500/10 text-pink-500', chartColor: '#ec4899' },
  { id: 'weight', label: 'Weight', icon: 'Scale', emoji: '⚖️', color: 'bg-blue-500/10 text-blue-500', chartColor: '#3b82f6' },
  { id: 'steps', label: 'Steps', icon: 'Footprints', emoji: '👣', color: 'bg-green-500/10 text-green-500', chartColor: '#22c55e' },
  { id: 'sleep', label: 'Sleep', icon: 'Moon', emoji: '😴', color: 'bg-indigo-500/10 text-indigo-500', chartColor: '#6366f1' },
  { id: 'water', label: 'Water', icon: 'GlassWater', emoji: '💧', color: 'bg-cyan-500/10 text-cyan-500', chartColor: '#06b6d4' },
  { id: 'mood', label: 'Mood', icon: 'Smile', emoji: '😊', color: 'bg-yellow-500/10 text-yellow-500', chartColor: '#eab308' },
  { id: 'symptom', label: 'Symptoms', icon: 'AlertCircle', emoji: '🤒', color: 'bg-orange-500/10 text-orange-500', chartColor: '#f97316' },
]

const ICON_MAP: Record<string, typeof Droplet> = {
  Droplet, Heart, Scale, Footprints, Moon, GlassWater, Smile, AlertCircle, Activity,
}

const CUSTOM_CATEGORIES_KEY = 'hb_custom_vitals'

function getCategories() {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES
  try {
    const stored = localStorage.getItem(CUSTOM_CATEGORIES_KEY)
    if (stored) {
      const custom = JSON.parse(stored)
      return [...DEFAULT_CATEGORIES, ...custom]
    }
  } catch { /* ignore */ }
  return DEFAULT_CATEGORIES
}

interface JournalEntry {
  id: string
  category: string
  value: string
  unit: string | null
  context: string | null
  notes: string | null
  recordedAt: string
}

export default function JournalPage() {
  const { patientId } = useAuth()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categories, setCategories] = useState(getCategories)
  const [showAddVital, setShowAddVital] = useState(false)
  const [newVitalName, setNewVitalName] = useState('')
  const [newVitalUnit, setNewVitalUnit] = useState('')

  useEffect(() => {
    if (!patientId) return

    async function fetchJournal() {
      try {
        const res = await fetch('/api/patient/data?section=journal')
        if (!res.ok) throw new Error('Failed')
        const { entries: data } = await res.json()

        if (data) {
          setEntries(
            data.map((e: { id: string; category: string; value: string; unit: string | null; context: string | null; notes: string | null; recorded_at: string }) => ({
              id: e.id,
              category: e.category,
              value: e.value,
              unit: e.unit,
              context: e.context,
              notes: e.notes,
              recordedAt: e.recorded_at,
            }))
          )

          // Calculate streak
          const dates = [...new Set(data.map((e: { recorded_at: string }) => new Date(e.recorded_at).toDateString()))]
          let currentStreak = 0
          const today = new Date()
          for (let i = 0; i < dates.length; i++) {
            const expected = new Date(today)
            expected.setDate(expected.getDate() - i)
            if (dates.includes(expected.toDateString())) {
              currentStreak++
            } else {
              break
            }
          }
          setStreak(currentStreak)
        }
      } catch (err) {
        console.error('Failed to fetch journal:', err)
      }
      setLoading(false)
    }

    fetchJournal()
  }, [patientId])

  // Chart data for selected category - ALL records
  const chartData = selectedCategory
    ? entries
        .filter(e => e.category === selectedCategory)
        .reverse()
        .map(e => ({
          date: new Date(e.recordedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          value: Number(e.value) || 0,
        }))
    : []

  const selectedCat = categories.find(c => c.id === selectedCategory)

  const handleAddVital = () => {
    if (!newVitalName.trim()) return
    const id = newVitalName.trim().toLowerCase().replace(/\s+/g, '_')
    if (categories.find(c => c.id === id)) return // already exists

    const chartColors = ['#8b5cf6', '#14b8a6', '#f43f5e', '#84cc16', '#a855f7', '#0ea5e9']
    const newCat = {
      id,
      label: newVitalName.trim(),
      icon: 'Activity',
      emoji: '📊',
      color: 'bg-purple-500/10 text-purple-500',
      chartColor: chartColors[categories.length % chartColors.length],
      unit: newVitalUnit.trim() || undefined,
    }

    const updatedCustom = [...categories.filter(c => !DEFAULT_CATEGORIES.find(d => d.id === c.id)), newCat]
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(updatedCustom))
    setCategories([...categories, newCat])
    setNewVitalName('')
    setNewVitalUnit('')
    setShowAddVital(false)
  }

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header with streak */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-text">Health Journal</h1>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1">
            <Flame size={14} className="text-warning" />
            <span className="text-xs font-semibold text-warning">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* Category Grid */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {categories.map((cat) => {
          const Icon = ICON_MAP[cat.icon] || Activity
          const isSelected = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${cat.color}`}>
                <Icon size={18} />
              </div>
              <span className="text-[11px] font-medium text-text">{cat.label}</span>
            </button>
          )
        })}
        {/* Add Vital Button */}
        <button
          onClick={() => setShowAddVital(true)}
          className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-3 transition-colors hover:border-primary/30"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/10">
            <Plus size={18} className="text-muted" />
          </div>
          <span className="text-[11px] font-medium text-muted">Add</span>
        </button>
      </div>

      {/* Add Vital Dialog */}
      {showAddVital && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-text">Add Custom Vital</span>
            <button onClick={() => setShowAddVital(false)} className="p-1 rounded hover:bg-bg">
              <X size={14} className="text-muted" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={newVitalName}
              onChange={(e) => setNewVitalName(e.target.value)}
              placeholder="Vital name (e.g. Creatinine)"
              className="input text-sm"
              autoFocus
            />
            <input
              type="text"
              value={newVitalUnit}
              onChange={(e) => setNewVitalUnit(e.target.value)}
              placeholder="Unit (e.g. mg/dL) — optional"
              className="input text-sm"
            />
            <button
              onClick={handleAddVital}
              disabled={!newVitalName.trim()}
              className="btn-primary w-full text-sm disabled:opacity-50"
            >
              Add Vital
            </button>
          </div>
        </div>
      )}

      {/* Chart Panel */}
      {selectedCategory && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <span className="text-sm font-semibold text-text">{selectedCat?.label} Trend</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/journal/log?category=${selectedCategory}`}
                className="text-xs font-medium text-primary"
              >
                + Add Entry
              </Link>
              <button onClick={() => setSelectedCategory(null)} className="p-1 rounded hover:bg-bg">
                <X size={14} className="text-muted" />
              </button>
            </div>
          </div>
          
          {chartData.length === 0 ? (
            <p className="text-center text-sm text-muted py-6">No entries yet for this category</p>
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={selectedCat?.chartColor || '#0d9488'}
                    strokeWidth={2}
                    dot={{ r: 3, fill: selectedCat?.chartColor || '#0d9488' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Recent Timeline */}
      <h2 className="mb-3 text-sm font-semibold text-text">Recent Entries</h2>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="pt-8 text-center">
          <p className="text-sm text-muted">No entries yet. Start logging!</p>
          <Link href="/journal/log" className="mt-3 inline-block text-sm font-medium text-primary">
            Log your first entry →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {(selectedCategory
            ? entries.filter(e => e.category === selectedCategory)
            : entries
          ).map((entry) => {
            const cat = categories.find((c) => c.id === entry.category)
            return (
              <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <span className="text-lg">{cat?.emoji || '📝'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">
                    {cat?.label}: {entry.value} {entry.unit || ''}
                  </p>
                  {entry.context && (
                    <p className="text-xs text-muted">{entry.context}</p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-muted">
                  {formatRelativeTime(entry.recordedAt)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Chat Widget for Journal Context */}
      {patientId && (
        <ChatWidget
          patientId={patientId}
          contextType="journal"
          title="Journal Chat"
          placeholder="Ask about your journal data..."
          contextData={entries.length > 0 ? `Recent journal entries: ${entries.slice(0, 10).map(e => `${e.category}: ${e.value} ${e.unit || ''} (${e.context || ''})`).join('; ')}` : undefined}
        />
      )}
    </div>
  )
}
