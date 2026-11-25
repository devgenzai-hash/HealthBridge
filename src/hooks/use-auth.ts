/**
 * useAuth hook — provides current user, role, and auth actions.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types/database'

interface AuthState {
  user: User | null
  role: UserRole | null
  loading: boolean
  patientId: string | null
  doctorId: string | null
  clinicId: string | null
}

interface UserContext {
  role: UserRole | null
  patientId: string | null
  doctorId: string | null
  clinicId: string | null
}

const pendingUserContext = new Map<string, Promise<UserContext | null>>()

async function getUserContext(userId: string): Promise<UserContext | null> {
  const pending = pendingUserContext.get(userId)
  if (pending) return pending

  const request = fetch('/api/auth/context')
    .then(async (res) => {
      if (!res.ok) return null
      const ctx = await res.json()
      return {
        role: (ctx.role as UserRole) || null,
        patientId: ctx.patientId || null,
        doctorId: ctx.doctorId || null,
        clinicId: ctx.clinicId || null,
      }
    })
    .finally(() => {
      pendingUserContext.delete(userId)
    })

  pendingUserContext.set(userId, request)
  return request
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
    patientId: null,
    doctorId: null,
    clinicId: null,
  })

  const supabase = createClient()

  const fetchUserContext = useCallback(
    async (user: User) => {
      // Use server API to get role/context (bypasses RLS recursion)
      try {
        const ctx = await getUserContext(user.id)
        if (ctx) {
          setState({
            user,
            role: ctx.role,
            loading: false,
            patientId: ctx.patientId,
            doctorId: ctx.doctorId,
            clinicId: ctx.clinicId,
          })
          return
        }
      } catch {
        // fallback below
      }

      // Fallback: direct query (works when RLS is fixed)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, clinic_id')
        .eq('user_id', user.id)
        .single()

      let patientId: string | null = null
      let doctorId: string | null = null

      if (roleData?.role === 'patient') {
        const { data } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .single()
        patientId = data?.id || null
      } else if (roleData?.role === 'doctor') {
        const { data } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .single()
        doctorId = data?.id || null
      }

      setState({
        user,
        role: (roleData?.role as UserRole) || null,
        loading: false,
        patientId,
        doctorId,
        clinicId: roleData?.clinic_id || null,
      })
    },
    [supabase]
  )

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        fetchUserContext(user)
      } else {
        setState((s) => ({ ...s, loading: false }))
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return

      if (session?.user) {
        fetchUserContext(session.user)
      } else {
        setState({ user: null, role: null, loading: false, patientId: null, doctorId: null, clinicId: null })
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, fetchUserContext])

  const signOut = useCallback(async () => {
    try {
      // Clear service-worker caches so cached medical data does not leak to next user on shared devices.
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map((name) => caches.delete(name)))
      }
      // Clear app-specific localStorage keys (chat history, insights, custom vitals, etc.)
      if (typeof window !== 'undefined') {
        const keysToRemove: string[] = []
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key && (key.startsWith('hb_') || key.startsWith('healthbridge') || key.startsWith('chat_') || key.startsWith('ai-'))) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k))
      }
    } catch {
      // Best-effort cleanup; do not block sign-out on storage errors.
    }
    await supabase.auth.signOut()
  }, [supabase])

  return { ...state, signOut }
}
