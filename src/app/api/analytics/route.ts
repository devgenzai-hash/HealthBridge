import { nextApiRoute } from '@/api/next-route'
import { analyticsGet } from '@/api/routes'

export const GET = nextApiRoute(analyticsGet)
