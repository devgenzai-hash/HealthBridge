import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { logger } from '@/lib/logger'
import { createCorsPreflight, withCors } from './cors'
import { handleApiRequest } from './routes'

const host = process.env.API_HOST || '0.0.0.0'
const port = Number(process.env.API_PORT || 4000)

const server = createServer(async (nodeRequest, nodeResponse) => {
  try {
    const request = toWebRequest(nodeRequest)
    const response =
      request.method.toUpperCase() === 'OPTIONS'
        ? createCorsPreflight(request)
        : withCors(request, await handleApiRequest(request))

    await writeWebResponse(nodeResponse, response)
  } catch (error) {
    logger.error({ err: error }, 'Unhandled API server error')
    await writeWebResponse(
      nodeResponse,
      Response.json({ error: 'Internal server error' }, { status: 500 })
    )
  }
})

server.listen(port, host, () => {
  logger.info({ host, port }, 'HealthBridge API server listening')
})

function toWebRequest(nodeRequest: IncomingMessage): Request {
  const method = nodeRequest.method || 'GET'
  const headers = toWebHeaders(nodeRequest.headers)
  const url = createRequestUrl(nodeRequest)
  const init: RequestInit & { duplex?: 'half' } = { method, headers }

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = Readable.toWeb(nodeRequest) as ReadableStream
    init.duplex = 'half'
  }

  return new Request(url, init)
}

function toWebHeaders(nodeHeaders: IncomingHttpHeaders): Headers {
  const headers = new Headers()

  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(name, entry)
    } else if (value !== undefined) {
      headers.set(name, value)
    }
  }

  return headers
}

function createRequestUrl(nodeRequest: IncomingMessage): string {
  const proto = firstHeader(nodeRequest.headers['x-forwarded-proto']) || 'http'
  const hostHeader = nodeRequest.headers.host || `${host}:${port}`
  return new URL(nodeRequest.url || '/', `${proto}://${hostHeader}`).toString()
}

async function writeWebResponse(nodeResponse: ServerResponse, response: Response) {
  const headers: Record<string, string | string[]> = {}
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const setCookies = typeof getSetCookie === 'function' ? getSetCookie.call(response.headers) : []

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      headers[key] = value
    }
  })

  if (setCookies.length > 0) {
    headers['set-cookie'] = setCookies
  } else {
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) headers['set-cookie'] = setCookie
  }

  nodeResponse.writeHead(response.status, headers)

  if (!response.body) {
    nodeResponse.end()
    return
  }

  await new Promise<void>((resolve, reject) => {
    Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(nodeResponse)
    nodeResponse.on('finish', resolve)
    nodeResponse.on('error', reject)
  })
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}