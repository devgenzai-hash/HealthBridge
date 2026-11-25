/**
 * Supabase client for Server Components and Route Handlers.
 * Uses the publishable key with cookie-based auth (respects RLS).
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Server-side Supabase client that respects RLS.
 * Use in Server Components and Route Handlers for user-scoped queries.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignore errors in Server Components (read-only context)
          }
        },
      },
    }
  )
}

/**
 * Admin Supabase client — bypasses RLS.
 * Use ONLY for operations that need elevated privileges.
 */
export function createAdminClient() {
  return createSupabaseClient(
    supabaseUrl!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  )
}
