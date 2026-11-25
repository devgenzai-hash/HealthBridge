import { nextApiRoute } from '@/api/next-route'
import { queueGet, queuePatch, queuePost } from '@/api/routes'

export const GET = nextApiRoute(queueGet)
export const POST = nextApiRoute(queuePost)
export const PATCH = nextApiRoute(queuePatch)
