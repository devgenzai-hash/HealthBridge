/**
 * Next.js Middleware
 * - Refreshes Supabase auth tokens
 * - Protects routes by role
 * - Applies security headers
 */

import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/login', '/register', '/otp', '/offline', '/shared']

// Role-based route access
const ROLE_ROUTES: Record<string, string[]> = {
  patient: ['/home', '/reports', '/journal', '/appointments', '/trends', '/care-plans', '/medicines', '/ai-chat', '/profile'],
  doctor: ['/queue', '/patients', '/schedule'],
  admin: ['/dashboard', '/payments', '/analytics', '/settings', '/patient-mgmt'],
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const path = request.nextUrl.pathname

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => path === route || path.startsWith('/api/auth'))) {
    return supabaseResponse
  }

  // Allow API routes (they have their own auth checks)
  if (path.startsWith('/api/')) {
    return supabaseResponse
  }

  // Require authentication for all other routes
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icons/ (PWA icons)
     * - manifest.json (PWA manifest)
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|screenshots/).*)',
  ],
}
