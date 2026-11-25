import { nextApiRoute } from '@/api/next-route'
import { patientClaimPost } from '@/api/routes'

export const POST = nextApiRoute(patientClaimPost)
