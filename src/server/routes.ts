import { ApiRouter } from './router'
import {
  aiBriefingGet,
  aiCalibratePost,
  aiCarePlanPost,
  aiChatPost,
  analyticsGet,
  authContextGet,
  authDevLoginPost,
  authDevSetRolePost,
  authOtpPost,
  doctorQueueGet,
  embeddingsJournalPost,
  patientClaimPost,
  patientDataGet,
  paymentsVerifyPost,
  queueGet,
  queuePatch,
  queuePost,
  reportsAnalyzePost,
  reportsUploadPost,
  vitalsExtractPost,
} from '@/api/routes'

const router = new ApiRouter()

router.register('GET', '/health', healthCheck)
router.register('GET', '/api/health', healthCheck)
router.register('POST', '/api/auth/otp', authOtpPost)
router.register('POST', '/api/auth/dev-login', authDevLoginPost)
router.register('POST', '/api/auth/dev-set-role', authDevSetRolePost)
router.register('GET', '/api/auth/context', authContextGet)
router.register('GET', '/api/analytics', analyticsGet)
router.register('GET', '/api/queue', queueGet)
router.register('POST', '/api/queue', queuePost)
router.register('PATCH', '/api/queue', queuePatch)
router.register('GET', '/api/doctor/queue', doctorQueueGet)
router.register('POST', '/api/patient/claim', patientClaimPost)
router.register('GET', '/api/patient/data', patientDataGet)
router.register('POST', '/api/reports/upload', reportsUploadPost)
router.register('POST', '/api/reports/analyze', reportsAnalyzePost)
router.register('POST', '/api/vitals/extract', vitalsExtractPost)
router.register('POST', '/api/ai/chat', aiChatPost)
router.register('POST', '/api/ai/care-plan', aiCarePlanPost)
router.register('POST', '/api/ai/calibrate', aiCalibratePost)
router.register('GET', '/api/ai/briefing/:id', aiBriefingGet)
router.register('POST', '/api/embeddings/journal', embeddingsJournalPost)
router.register('POST', '/api/payments/verify', paymentsVerifyPost)

export async function handleApiRequest(request: Request): Promise<Response> {
  const routeMatch = router.match(request)
  if (!routeMatch) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return routeMatch.handler(request, { params: routeMatch.params })
}

async function healthCheck() {
  return Response.json({
    ok: true,
    service: 'healthbridge-api',
    timestamp: new Date().toISOString(),
  })
}