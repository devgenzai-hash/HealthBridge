import type { ApiRouteHandler } from '@/api/context'

interface RouteMatch {
  handler: ApiRouteHandler
  params: Record<string, string>
}

interface CompiledRoute {
  method: string
  pattern: RegExp
  paramNames: string[]
  handler: ApiRouteHandler
}

export class ApiRouter {
  private routes: CompiledRoute[] = []

  register(method: string, path: string, handler: ApiRouteHandler) {
    const { pattern, paramNames } = compilePath(path)
    this.routes.push({ method: method.toUpperCase(), pattern, paramNames, handler })
  }

  match(request: Request): RouteMatch | null {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()

    for (const route of this.routes) {
      if (route.method !== method) continue

      const match = route.pattern.exec(url.pathname)
      if (!match) continue


      const params: Record<string, string> = {}
      route.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(match[index + 1])
      })

      return { handler: route.handler, params }
    }

    return null
  }
}

function compilePath(path: string) {
  const paramNames: string[] = []
  const pattern = path
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1))
        return '([^/]+)'
      }

      return escapeRegExp(segment)
    })
    .join('/')

  return {
    pattern: new RegExp(`^/${pattern}/?$`),
    paramNames,
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}