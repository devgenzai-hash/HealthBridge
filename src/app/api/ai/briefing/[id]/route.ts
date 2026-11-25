import type { NextRequest } from 'next/server'
import { nextApiRoute } from '@/api/next-route'
import { aiBriefingGet } from '@/api/routes'

const getBriefing = nextApiRoute(aiBriefingGet)

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return getBriefing(request, { params: await params })
}
