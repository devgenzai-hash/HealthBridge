import type { ApiRouteHandler } from './context'
import { logger } from '@/lib/logger'

const DEFAULT_DEDICATED_API_BASE_URL = 'http://localhost:4000'
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'dedicated'])

export function nextApiRoute(localHandler: ApiRouteHandler): ApiRouteHandler {
  return async (request, context) => {
    if (shouldUseDedicatedApi()) {
      return proxyToDedicatedApi(request)
    }

    return localHandler(request, context)
  }
}

function shouldUseDedicatedApi(): boolean {
  return TRUE_VALUES.has((process.env.USE_DEDICATED_API || '').trim().toLowerCase())
}

async function proxyToDedicatedApi(request: Request): Promise<Response> {
  const targetUrl = createDedicatedApiUrl(request.url)
  const headers = createProxyHeaders(request)
  const method = request.method.toUpperCase()
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    redirect: 'manual',
  }

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }

  try {
    const upstreamResponse = await fetch(targetUrl, init)
    return cloneProxyResponse(upstreamResponse)
  } catch (error) {
    logger.error({ err: error, targetUrl }, 'Dedicated API proxy failed')
    return Response.json(
      { error: 'Dedicated API server unavailable' },
      { status: 502 }
    )
  }
}

function createDedicatedApiUrl(requestUrl: string): string {
  const sourceUrl = new URL(requestUrl)
  const baseUrl = new URL(process.env.DEDICATED_API_BASE_URL || DEFAULT_DEDICATED_API_BASE_URL)

  baseUrl.pathname = sourceUrl.pathname
  baseUrl.search = sourceUrl.search
  return baseUrl.toString()
}

function createProxyHeaders(request: Request): Headers {
  const headers = new Headers(request.headers)
  const sourceUrl = new URL(request.url)

  for (const header of [
    'accept-encoding',
    'connection',
    'content-length',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ]) {
    headers.delete(header)
  }

  headers.set('x-forwarded-host', sourceUrl.host)
  headers.set('x-forwarded-proto', sourceUrl.protocol.replace(':', ''))

  return headers
}

function cloneProxyResponse(upstreamResponse: Response): Response {
  const headers = new Headers(upstreamResponse.headers)
  const getSetCookie = (upstreamResponse.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const setCookies = typeof getSetCookie === 'function' ? getSetCookie.call(upstreamResponse.headers) : []

  if (setCookies.length > 0) {
    headers.delete('set-cookie')
  }

  const response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  })

  for (const cookie of setCookies) {
    response.headers.append('set-cookie', cookie)
  }

  return response
}