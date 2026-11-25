/**
 * Supabase client for Client Components (browser-side).
 * Uses the publishable key — all queries go through RLS.
 */

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      supabaseUrl!,
      supabaseKey!
    )
  }

  return browserClient
}
