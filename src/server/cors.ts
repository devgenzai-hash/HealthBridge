const defaultOrigins = ['http://localhost:3000']

export function createCorsPreflight(request: Request): Response {
  return withCors(request, new Response(null, { status: 204 }))
}

export function withCors(request: Request, response: Response): Response {
  const requestOrigin = request.headers.get('origin')
  const allowedOrigin = resolveAllowedOrigin(requestOrigin)

  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    appendVary(response.headers, 'Origin')
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  response.headers.set(
    'Access-Control-Allow-Headers',
    request.headers.get('access-control-request-headers') || 'authorization, content-type, x-client-info, apikey'
  )

  return response
}

function resolveAllowedOrigin(requestOrigin: string | null): string | null {
  const configuredOrigins = (process.env.API_CORS_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins
  if (allowedOrigins.includes('*')) return '*'
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) return requestOrigin
  return allowedOrigins[0] || null
}

function appendVary(headers: Headers, value: string) {
  const current = headers.get('Vary')
  if (!current) {
    headers.set('Vary', value)
    return
  }

  const values = current.split(',').map((entry) => entry.trim().toLowerCase())
  if (!values.includes(value.toLowerCase())) {
    headers.set('Vary', `${current}, ${value}`)
  }
}