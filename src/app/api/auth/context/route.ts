import { nextApiRoute } from '@/api/next-route'
import { authContextGet } from '@/api/routes'

export const GET = nextApiRoute(authContextGet)
