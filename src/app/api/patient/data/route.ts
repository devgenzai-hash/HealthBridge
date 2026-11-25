import { nextApiRoute } from '@/api/next-route'
import { patientDataGet } from '@/api/routes'

export const GET = nextApiRoute(patientDataGet)
