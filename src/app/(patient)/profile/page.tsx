'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { formatDate, getInitials } from '@/lib/utils'
import { ArrowLeft, LogOut, Globe, Phone, Calendar, Heart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'

interface PatientProfile {
  name: string
  phone: string
  email: string | null
  dateOfBirth: string | null
  gender: string | null
  bloodGroup: string | null
  languagePref: string
}

export default function ProfilePage() {
  const { user, patientId, signOut } = useAuth()
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!patientId) return

    async function fetchProfile() {
      const { data } = await supabase
        .from('patients')
        .select('name, phone, email, date_of_birth, gender, blood_group, language_pref')
        .eq('id', patientId)
        .single()

      if (data) {
        setProfile({
          name: data.name,
          phone: data.phone,
          email: data.email,
          dateOfBirth: data.date_of_birth,
          gender: data.gender,
          bloodGroup: data.blood_group,
          languagePref: data.language_pref,
        })
      }
      setLoading(false)
    }

    fetchProfile()
  }, [patientId, supabase])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading || !profile) {
    return (
      <div className="px-4 pt-12">
        <div className="skeleton mx-auto mb-4 h-20 w-20 rounded-full" />
        <div className="skeleton mx-auto mb-8 h-6 w-32" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const languageName = SUPPORTED_LANGUAGES.find((l) => l.code === profile.languagePref)?.nativeName || 'English'

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Profile Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
          {getInitials(profile.name)}
        </div>
        <h1 className="text-xl font-bold text-text">{profile.name}</h1>
        <p className="text-sm text-muted">{user?.email || profile.phone}</p>
      </div>

      {/* Profile Fields */}
      <div className="space-y-3">
        <ProfileRow icon={Phone} label="Phone" value={`+91 ${profile.phone}`} />
        {profile.dateOfBirth && (
          <ProfileRow icon={Calendar} label="Date of Birth" value={formatDate(profile.dateOfBirth)} />
        )}
        {profile.bloodGroup && (
          <ProfileRow icon={Heart} label="Blood Group" value={profile.bloodGroup} />
        )}
        <ProfileRow icon={Globe} label="Language" value={languageName} />
      </div>

      {/* Actions */}
      <div className="mt-8 space-y-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl border border-danger/20 bg-danger/5 p-4 text-left text-sm font-medium text-danger"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>

      {/* App Info */}
      <div className="mt-8 text-center text-xs text-muted">
        <p>HealthBridge v0.1.0</p>
        <p className="mt-1">DPDP Act 2023 compliant • Data in Mumbai (ap-south-1)</p>
      </div>
    </div>
  )
}

function ProfileRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <Icon size={18} className="text-muted" />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-medium text-text">{value}</p>
      </div>
    </div>
  )
}
