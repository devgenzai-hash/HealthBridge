import { nextApiRoute } from '@/api/next-route'
import { doctorQueueGet } from '@/api/routes'

export const GET = nextApiRoute(doctorQueueGet)
