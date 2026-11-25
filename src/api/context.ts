import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

export interface ApiRouteContext {
  params?: Record<string, string>
}

export type ApiRouteHandler = (
  request: Request,
  context?: ApiRouteContext
) => Promise<Response>

interface CookieToSet {
  name: string
  value: string
  options: CookieOptions
}

interface ApiContext {
  request: Request
  params: Record<string, string>
  supabase: SupabaseClient
  adminClient: SupabaseClient
  json: typeof Response.json
  applyCookies: (response: Response) => Response
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function apiHandler(
  handler: (context: ApiContext) => Promise<Response> | Response
): ApiRouteHandler {
  return async (request: Request, routeContext: ApiRouteContext = {}) => {
    const context = createApiContext(request, routeContext.params || {})
    const response = await handler(context)
    return context.applyCookies(response)
  }
}

function createApiContext(request: Request, params: Record<string, string>): ApiContext {
  const pendingCookies: CookieToSet[] = []
  const cookieMap = parseCookieHeader(request.headers.get('cookie'))
  const authorization = request.headers.get('authorization')
  let adminClient: SupabaseClient | null = null

  const supabase = createServerClient(supabaseUrl!, supabasePublishableKey!, {
    cookies: {
      getAll() {
        return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }))
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const cookie of cookiesToSet) {
          cookieMap.set(cookie.name, cookie.value)
          pendingCookies.push(cookie)
        }
      },
    },
    ...(authorization
      ? {
          global: {
            headers: { Authorization: authorization },
          },
        }
      : {}),
  })

  return {
    request,
    params,
    supabase,
    get adminClient() {
      if (!adminClient) {
        adminClient = createSupabaseClient(
          supabaseUrl!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        )
      }

      return adminClient
    },
    json: Response.json,
    applyCookies(response: Response) {
      for (const cookie of pendingCookies) {
        response.headers.append('Set-Cookie', serializeCookie(cookie))
      }
      return response
    },
  }
}

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>()
  if (!cookieHeader) return cookies

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue


    const name = trimmed.slice(0, separatorIndex)
    const rawValue = trimmed.slice(separatorIndex + 1)
    cookies.set(name, safeDecode(rawValue))
  }

  return cookies
}

function serializeCookie({ name, value, options }: CookieToSet): string {
  const parts = [`${name}=${encodeURIComponent(value)}`]

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  if (options.domain) parts.push(`Domain=${options.domain}`)
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  if (options.sameSite) parts.push(`SameSite=${formatSameSite(options.sameSite)}`)

  return parts.join('; ')
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function formatSameSite(sameSite: CookieOptions['sameSite']): string {
  if (typeof sameSite === 'string') {
    return sameSite.charAt(0).toUpperCase() + sameSite.slice(1).toLowerCase()
  }

  return 'Lax'
}