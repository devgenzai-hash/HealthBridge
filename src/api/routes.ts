import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { apiHandler } from './context'
import { chatWithVision, aiChat, embed } from '@/lib/ai'
import {
  CARE_PLAN_SYSTEM_PROMPT,
  DOCTOR_BRIEFING_SYSTEM_PROMPT,
  PATIENT_CHAT_SYSTEM_PROMPT,
  REPORT_ANALYSIS_SYSTEM_PROMPT,
  REPORT_OCR_PROMPT,
  VITALS_EXTRACTION_PROMPT,
} from '@/lib/ai/prompts'
import { logger } from '@/lib/logger'
import { checkAIRateLimit, checkOTPRateLimit } from '@/lib/rate-limit'
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, isValidIndianPhone } from '@/lib/utils'

const DEV_PASSWORD = process.env.DEV_PASSWORD || 'dev-healthbridge-2024!'
const DEV_ENDPOINTS_ENABLED =
  process.env.ALLOW_DEV_ENDPOINTS === 'true' || process.env.NODE_ENV === 'development'

/** UUID v1-v5 regex used to harden IDs accepted from clients. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value)

const ALLOWED_QUEUE_STATUSES = new Set(['waiting', 'in_progress', 'done', 'no_show', 'cancelled'])

type AnySupabaseClient = SupabaseClient<any, any, any, any, any>

const INSIGHT_SYSTEM_PROMPT = `You are a compassionate health assistant for an Indian patient. 
Analyze their health data from the last 30 days and provide:
1. A comprehensive 3-5 sentence health overview in simple language
2. Key trends (improving/worsening/stable) for each vital tracked
3. One actionable recommendation
4. Any flags or concerns

Be warm, encouraging, and specific with numbers. Never diagnose - use phrases like "this may indicate" or "consider discussing with your doctor".
Format your response as JSON:
{
  "overview": "...",
  "trends": [{"vital": "...", "direction": "improving|worsening|stable", "detail": "..."}],
  "recommendation": "...",
  "flags": ["..."]
}`

export const authOtpPost = apiHandler(async ({ request, json }) => {
  const log = logger.child({ route: 'auth/otp' })

  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return json({ error: 'Phone number required' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '')
    if (!isValidIndianPhone(cleanPhone)) {
      return json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const rateLimitResult = checkOTPRateLimit(cleanPhone)
    if (!rateLimitResult.allowed) {
      log.warn({ phone: cleanPhone }, 'OTP rate limit exceeded')
      return json(
        {
          error: 'Too many OTP requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        },
        { status: 429 }
      )
    }

    return json({
      allowed: true,
      remaining: rateLimitResult.remaining,
    })
  } catch (error) {
    log.error({ err: error }, 'Unhandled error in OTP endpoint')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const authDevLoginPost = apiHandler(async ({ request, json }) => {
  if (!DEV_ENDPOINTS_ENABLED) {
    logger.warn({ route: 'auth/dev-login' }, 'Dev endpoint blocked (ALLOW_DEV_ENDPOINTS not set)')
    return json({ error: 'Not available' }, { status: 404 })
  }

  const { phone } = await request.json()

  if (!phone) {
    return json({ error: 'Phone required' }, { status: 400 })
  }

  const cleanPhone = phone.replace(/\D/g, '')
  const devEmail = `${cleanPhone}@dev.healthbridge.local`

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (serviceKey) {
    const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: devEmail,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { phone, dev_mode: true },
    })

    if (createError) {
      const alreadyExists = /already|exist|registered/i.test(createError.message)
      if (alreadyExists) {
        return json({
          email: devEmail,
          password: DEV_PASSWORD,
          message: 'Existing dev user',
        })
      }

      return json({ error: createError.message }, { status: 500 })
    }

    if (newUser.user) {
      await supabaseAdmin.from('user_roles').upsert(
        {
          user_id: newUser.user.id,
          role: 'patient',
        },
        { onConflict: 'user_id' }
      )

      await supabaseAdmin.from('patients').upsert(
        {
          user_id: newUser.user.id,
          name: `Dev User ${cleanPhone.slice(-4)}`,
          phone,
          language_pref: 'en',
        },
        { onConflict: 'user_id' }
      )
    }

    return json({
      email: devEmail,
      password: DEV_PASSWORD,
      userId: newUser.user?.id,
      message: 'New dev user created',
    })
  }

  const supabase = createSupabaseClient(supabaseUrl, anonKey)

  const { data: signInData } = await supabase.auth.signInWithPassword({
    email: devEmail,
    password: DEV_PASSWORD,
  })

  if (signInData?.user) {
    return json({
      email: devEmail,
      password: DEV_PASSWORD,
      userId: signInData.user.id,
      message: 'Existing dev user',
    })
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: devEmail,
    password: DEV_PASSWORD,
    options: {
      data: { phone, dev_mode: true },
    },
  })

  if (signUpError) {
    return json({ error: signUpError.message }, { status: 500 })
  }

  return json({
    email: devEmail,
    password: DEV_PASSWORD,
    userId: signUpData.user?.id,
    message: 'New dev user created (email confirmation may be needed - disable it in Supabase dashboard)',
  })
})

export const authDevSetRolePost = apiHandler(async ({ request, json }) => {
  if (!DEV_ENDPOINTS_ENABLED) {
    logger.warn({ route: 'auth/dev-set-role' }, 'Dev endpoint blocked (ALLOW_DEV_ENDPOINTS not set)')
    return json({ error: 'Not available' }, { status: 404 })
  }

  const { phone, role, clinicId } = await request.json()

  if (!phone || !role) {
    return json({ error: 'phone and role required' }, { status: 400 })
  }

  if (!['patient', 'doctor', 'admin'].includes(role)) {
    return json({ error: 'role must be: patient, doctor, or admin' }, { status: 400 })
  }

  const cleanPhone = phone.replace(/\D/g, '')
  const devEmail = `${cleanPhone}@dev.healthbridge.local`

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: users } = await supabaseAdmin.auth.admin.listUsers()
  const user = users?.users?.find((candidate) => candidate.email === devEmail)

  if (!user) {
    return json(
      { error: `User not found. Login first with phone ${phone} to create the account.` },
      { status: 404 }
    )
  }

  const userId = user.id

  await supabaseAdmin.from('user_roles').upsert(
    {
      user_id: userId,
      role,
      clinic_id: clinicId || null,
    },
    { onConflict: 'user_id' }
  )

  if (role === 'doctor') {
    const finalClinicId = await resolveClinicId(supabaseAdmin, clinicId)

    await supabaseAdmin.from('user_roles').upsert(
      {
        user_id: userId,
        role: 'doctor',
        clinic_id: finalClinicId,
      },
      { onConflict: 'user_id' }
    )

    await supabaseAdmin.from('doctors').upsert(
      {
        user_id: userId,
        clinic_id: finalClinicId,
        name: `Dr. Dev ${cleanPhone.slice(-4)}`,
        phone,
        specialization: 'General Medicine',
      },
      { onConflict: 'user_id' }
    )

    return json({
      success: true,
      userId,
      role: 'doctor',
      clinicId: finalClinicId,
      message: `User set to doctor at clinic ${finalClinicId}`,
    })
  }

  if (role === 'admin') {
    const finalClinicId = await resolveClinicId(supabaseAdmin, clinicId)

    await supabaseAdmin.from('user_roles').upsert(
      {
        user_id: userId,
        role: 'admin',
        clinic_id: finalClinicId,
      },
      { onConflict: 'user_id' }
    )

    return json({
      success: true,
      userId,
      role: 'admin',
      clinicId: finalClinicId,
      message: `User set to admin at clinic ${finalClinicId}`,
    })
  }

  return json({
    success: true,
    userId,
    role: 'patient',
    message: 'User set to patient',
  })
})

export const authContextGet = apiHandler(async ({ supabase, adminClient, json }) => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role, clinic_id')
      .eq('user_id', user.id)
      .single()

    let patientId: string | null = null
    let doctorId: string | null = null

    if (roleData?.role === 'patient') {
      const { data } = await adminClient
        .from('patients')
        .select('id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single()
      patientId = data?.id || null
    } else if (roleData?.role === 'doctor') {
      const { data } = await adminClient
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single()
      doctorId = data?.id || null
    }

    return json({
      userId: user.id,
      role: roleData?.role || null,
      patientId,
      doctorId,
      clinicId: roleData?.clinic_id || null,
    })
  } catch {
    return json({ error: 'Internal error' }, { status: 500 })
  }
})

export const analyticsGet = apiHandler(async ({ request, supabase, json }) => {
  const log = logger.child({ route: 'analytics' })

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 })

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role, clinic_id')
      .eq('user_id', user.id)
      .single()

    if (roleData?.role !== 'admin' || !roleData?.clinic_id) {
      return json({ error: 'Admin access required' }, { status: 403 })
    }

    const clinicId = roleData.clinic_id
    const { searchParams } = new URL(request.url)
    const rawDays = parseInt(searchParams.get('days') || '30', 10)
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 30

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const { data: appointments } = await supabase
      .from('appointments')
      .select('queue_date, status, consultation_fee, payment_status, doctor_id')
      .eq('clinic_id', clinicId)
      .gte('queue_date', startDateStr)
      .is('deleted_at', null)

    if (!appointments) {
      return json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    const revenueByDay: Record<string, number> = {}
    const bookingsByDay: Record<string, number> = {}
    const revenueByDoctor: Record<string, number> = {}

    for (const appt of appointments) {
      const day = appt.queue_date
      bookingsByDay[day] = (bookingsByDay[day] || 0) + 1

      if (appt.payment_status === 'verified') {
        revenueByDay[day] = (revenueByDay[day] || 0) + (appt.consultation_fee || 0)
        revenueByDoctor[appt.doctor_id] =
          (revenueByDoctor[appt.doctor_id] || 0) + (appt.consultation_fee || 0)
      }
    }

    return json({
      period: { start: startDateStr, days },
      totals: {
        appointments: appointments.length,
        completed: appointments.filter((appointment) => appointment.status === 'done').length,
        revenue: Object.values(revenueByDay).reduce((sum, value) => sum + value, 0),
        noShows: appointments.filter((appointment) => appointment.status === 'no_show').length,
      },
      revenueByDay,
      bookingsByDay,
      revenueByDoctor,
    })
  } catch (error) {
    log.error({ err: error }, 'Unhandled error in analytics')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const queueGet = apiHandler(async ({ request, supabase, adminClient, json }) => {
  const log = logger.child({ route: 'queue/GET' })

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get('doctorId')
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    if (!isUuid(doctorId)) {
      return json({ error: 'Valid Doctor ID required' }, { status: 400 })
    }

    // Authorization: requester must be the doctor themselves, or admin of the doctor's clinic.
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role, clinic_id')
      .eq('user_id', user.id)
      .single()

    const { data: doctorRecord } = await adminClient
      .from('doctors')
      .select('id, user_id, clinic_id')
      .eq('id', doctorId)
      .is('deleted_at', null)
      .single()

    if (!doctorRecord) {
      return json({ error: 'Doctor not found' }, { status: 404 })
    }

    const isSelf = doctorRecord.user_id === user.id
    const isClinicAdmin = roleData?.role === 'admin' && roleData?.clinic_id === doctorRecord.clinic_id
    if (!isSelf && !isClinicAdmin) {
      log.warn({ userId: user.id, doctorId }, 'Unauthorized queue access attempt')
      return json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('appointments')
      .select(
        `
        id, patient_id, queue_position, status, visit_type, scheduled_at, notes,
        patients(name, phone)
      `
      )
      .eq('doctor_id', doctorId)
      .eq('queue_date', date)
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .order('queue_position', { ascending: true })

    if (error) {
      log.error({ err: error }, 'Failed to fetch queue')
      return json({ error: 'Failed to fetch queue' }, { status: 500 })
    }

    return json({ queue: data })
  } catch (error) {
    log.error({ err: error }, 'Unhandled error')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const queuePost = apiHandler(async ({ request, supabase, adminClient, json }) => {
  const log = logger.child({ route: 'queue/POST' })

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { patientId, doctorId, clinicId } = body

    if (!isUuid(patientId) || !isUuid(doctorId) || !isUuid(clinicId)) {
      return json({ error: 'Valid Patient, Doctor, and Clinic IDs required' }, { status: 400 })
    }

    // Authorization: only the patient themselves, the assigned doctor, or a clinic admin/doctor may add to queue.
    const [{ data: roleData }, { data: patientRecord }, { data: doctorRecord }] = await Promise.all([
      adminClient.from('user_roles').select('role, clinic_id').eq('user_id', user.id).single(),
      adminClient.from('patients').select('id, user_id').eq('id', patientId).is('deleted_at', null).single(),
      adminClient.from('doctors').select('id, user_id, clinic_id').eq('id', doctorId).is('deleted_at', null).single(),
    ])

    if (!patientRecord) return json({ error: 'Patient not found' }, { status: 404 })
    if (!doctorRecord) return json({ error: 'Doctor not found' }, { status: 404 })
    if (doctorRecord.clinic_id !== clinicId) {
      return json({ error: 'Doctor does not belong to clinic' }, { status: 400 })
    }

    const isPatientSelf = patientRecord.user_id === user.id
    const isAssignedDoctor = doctorRecord.user_id === user.id
    const isClinicStaff =
      (roleData?.role === 'admin' || roleData?.role === 'doctor') && roleData?.clinic_id === clinicId
    if (!isPatientSelf && !isAssignedDoctor && !isClinicStaff) {
      log.warn({ userId: user.id, patientId, doctorId }, 'Unauthorized queue insertion attempt')
      return json({ error: 'Forbidden' }, { status: 403 })
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: existing } = await supabase
      .from('appointments')
      .select('queue_position')
      .eq('doctor_id', doctorId)
      .eq('queue_date', today)
      .is('deleted_at', null)
      .order('queue_position', { ascending: false })
      .limit(1)

    const nextPosition = (existing?.[0]?.queue_position || 0) + 1

    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        clinic_id: clinicId,
        queue_date: today,
        queue_position: nextPosition,
        status: 'waiting',
        visit_type: 'walkin',
        consultation_fee: 0,
        payment_status: 'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      log.error({ err: insertError }, 'Failed to add to queue')
      return json({ error: 'Failed to add patient to queue' }, { status: 500 })
    }

    log.info({ appointmentId: appointment?.id, patientId, position: nextPosition }, 'Walk-in added to queue')

    return json({ appointment, position: nextPosition })
  } catch (error) {
    log.error({ err: error }, 'Unhandled error')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const queuePatch = apiHandler(async ({ request, supabase, adminClient, json }) => {
  const log = logger.child({ route: 'queue/PATCH' })

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { appointmentId, status, queuePosition } = body

    if (!isUuid(appointmentId)) {
      return json({ error: 'Valid Appointment ID required' }, { status: 400 })
    }

    if (status !== undefined && !ALLOWED_QUEUE_STATUSES.has(status)) {
      return json({ error: 'Invalid status' }, { status: 400 })
    }

    if (
      queuePosition !== undefined &&
      (!Number.isInteger(queuePosition) || queuePosition < 1 || queuePosition > 10000)
    ) {
      return json({ error: 'Invalid queue position' }, { status: 400 })
    }

    // Authorization: must be the assigned doctor, the patient themselves, or a clinic admin.
    const { data: appt } = await adminClient
      .from('appointments')
      .select('id, patient_id, doctor_id, clinic_id')
      .eq('id', appointmentId)
      .is('deleted_at', null)
      .single()

    if (!appt) {
      return json({ error: 'Appointment not found' }, { status: 404 })
    }

    const [{ data: roleData }, { data: doctorRecord }, { data: patientRecord }] = await Promise.all([
      adminClient.from('user_roles').select('role, clinic_id').eq('user_id', user.id).single(),
      adminClient.from('doctors').select('id').eq('user_id', user.id).maybeSingle(),
      adminClient.from('patients').select('id').eq('user_id', user.id).maybeSingle(),
    ])

    const isDoctor = doctorRecord?.id === appt.doctor_id
    const isPatient = patientRecord?.id === appt.patient_id
    const isClinicAdmin = roleData?.role === 'admin' && roleData?.clinic_id === appt.clinic_id
    if (!isDoctor && !isPatient && !isClinicAdmin) {
      log.warn({ userId: user.id, appointmentId }, 'Unauthorized queue update attempt')
      return json({ error: 'Forbidden' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (queuePosition !== undefined) updateData.queue_position = queuePosition

    if (Object.keys(updateData).length === 0) {
      return json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)

    if (updateError) {
      log.error({ err: updateError, appointmentId }, 'Failed to update appointment')
      return json({ error: 'Failed to update' }, { status: 500 })
    }

    log.info(
      {
        appointmentId,
        status: updateData.status,
        queuePosition: updateData.queue_position,
      },
      'Queue item updated'
    )

    return json({ success: true })
  } catch (error) {
    log.error({ err: error }, 'Unhandled error')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const doctorQueueGet = apiHandler(async ({ supabase, adminClient, json }) => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: doctor } = await adminClient
      .from('doctors')
      .select('id, clinic_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!doctor) {
      return json({ error: 'Doctor not found' }, { status: 404 })
    }

    const queueDate = new Date().toISOString().split('T')[0]

    const { data: appointments } = await adminClient
      .from('appointments')
      .select(
        `
        id,
        patient_id,
        queue_position,
        status,
        visit_type,
        scheduled_at,
        patients(name, phone)
      `
      )
      .eq('doctor_id', doctor.id)
      .eq('queue_date', queueDate)
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .order('queue_position', { ascending: true })

    return json({
      doctorId: doctor.id,
      clinicId: doctor.clinic_id,
      queue: appointments || [],
    })
  } catch {
    return json({ error: 'Internal error' }, { status: 500 })
  }
})

export const patientClaimPost = apiHandler(async ({ request, supabase, adminClient, json }) => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { phone } = await request.json()

    if (!phone) {
      return json({ error: 'Phone number required' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10)

    const { data: existing } = await adminClient
      .from('patients')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (existing) {
      return json({ error: 'You already have a patient profile', patientId: existing.id }, { status: 409 })
    }

    const { data: unclaimed } = await adminClient
      .from('patients')
      .select('id, name, clinic_id')
      .is('user_id', null)
      .or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone}`)
      .is('deleted_at', null)
      .single()

    if (!unclaimed) {
      return json({ error: 'No matching unclaimed record found' }, { status: 404 })
    }

    const { error: updateErr } = await adminClient
      .from('patients')
      .update({ user_id: user.id })
      .eq('id', unclaimed.id)

    if (updateErr) {
      return json({ error: 'Failed to claim record' }, { status: 500 })
    }

    return json({
      message: 'Patient record claimed successfully',
      patientId: unclaimed.id,
      name: unclaimed.name,
    })
  } catch {
    return json({ error: 'Internal error' }, { status: 500 })
  }
})

export const patientDataGet = apiHandler(async ({ request, supabase, adminClient, json }) => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: patient } = await adminClient
      .from('patients')
      .select('id, name, language_pref')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!patient) {
      return json({ error: 'Patient not found' }, { status: 404 })
    }

    const patientId = patient.id
    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') || 'home'

    if (section === 'home') {
      const today = new Date().toISOString().split('T')[0]

      const [appointmentResult, reportsResult, journalResult] = await Promise.all([
        adminClient
          .from('appointments')
          .select('queue_position, clinics(name)')
          .eq('patient_id', patientId)
          .eq('queue_date', today)
          .in('status', ['waiting', 'confirmed'])
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle(),
        adminClient
          .from('medical_records')
          .select('id, title, category, created_at, ai_summary')
          .eq('patient_id', patientId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(2),
        adminClient
          .from('health_journal_entries')
          .select('category, value, unit, recorded_at')
          .eq('patient_id', patientId)
          .is('deleted_at', null)
          .order('recorded_at', { ascending: false })
          .limit(50),
      ])

      const appointment = appointmentResult.data
      const reports = reportsResult.data
      const journal = journalResult.data
      const clinic = appointment?.clinics as { name?: string } | { name?: string }[] | null | undefined
      const clinicName = Array.isArray(clinic) ? clinic[0]?.name || 'Clinic' : clinic?.name || 'Clinic'

      const chartCategories = ['blood_sugar', 'bp', 'weight', 'steps']
      const chartData: Record<string, { label: string; value: number }[]> = {}

      for (const cat of chartCategories) {
        const catEntries = (journal || [])
          .filter((entry: { category: string }) => entry.category === cat)
          .slice(0, 7)
          .reverse()

        chartData[cat] = catEntries.map((entry: { recorded_at: string; value: number }) => ({
          label: new Date(entry.recorded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          value: Number(entry.value) || 0,
        }))
      }

      return json({
        patient: { id: patient.id, name: patient.name },
        queuePosition: appointment?.queue_position ? { position: appointment.queue_position, clinicName } : null,
        reports: reports || [],
        journal: journal || [],
        chartData,
      })
    }

    if (section === 'journal') {
      const { data: entries } = await adminClient
        .from('health_journal_entries')
        .select('*')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('recorded_at', { ascending: false })
        .limit(50)

      return json({ entries: entries || [] })
    }

    if (section === 'reports') {
      const { data: records } = await adminClient
        .from('medical_records')
        .select('id, title, category, created_at, ai_summary')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      return json({ records: records || [] })
    }

    if (section === 'appointments') {
      const { data: appointments } = await adminClient
        .from('appointments')
        .select('*, clinics(name), doctors(name, specialization)')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('queue_date', { ascending: false })
        .limit(20)

      return json({ appointments: appointments || [] })
    }

    return json({ error: 'Invalid section' }, { status: 400 })
  } catch {
    return json({ error: 'Internal error' }, { status: 500 })
  }
})

export const reportsUploadPost = apiHandler(async ({ request, supabase, json }) => {
  const requestId = uuidv4()
  const log = logger.child({ requestId, route: 'reports/upload' })

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const patientId = formData.get('patientId') as string | null
    const customTitle = formData.get('title') as string | null

    if (!file) {
      return json({ error: 'No file provided' }, { status: 400 })
    }

    if (!patientId) {
      return json({ error: 'Patient ID required' }, { status: 400 })
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      log.warn({ fileType: file.type }, 'Invalid file type rejected')
      return json({ error: 'Only JPEG, PNG, WebP images and PDF files are allowed' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      log.warn({ fileSize: file.size }, 'File too large')
      return json({ error: 'File size must be under 10MB' }, { status: 400 })
    }

    if (!isUuid(patientId)) {
      return json({ error: 'Invalid patient ID' }, { status: 400 })
    }

    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!patient) {
      return json({ error: 'Patient not found' }, { status: 404 })
    }

    const rawExt = file.name.split('.').pop() || 'jpg'
    const fileExt = rawExt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin'
    const fileName = `${patientId}/${uuidv4()}.${fileExt}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage.from('medical-files').upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    })

    if (uploadError) {
      log.error({ err: uploadError }, 'Storage upload failed')
      return json({ error: 'File upload failed' }, { status: 500 })
    }

    const { data: record, error: recordError } = await supabase
      .from('medical_records')
      .insert({
        patient_id: patientId,
        title: customTitle || file.name.replace(/\.[^/.]+$/, '') || 'Untitled Report',
        category: 'other',
        file_url: fileName,
        file_type: file.type,
      })
      .select('id')
      .single()

    if (recordError || !record) {
      log.error({ err: recordError }, 'Failed to create medical record')
      return json({ error: 'Failed to save record' }, { status: 500 })
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      record_id: record.id,
      record_type: 'medical_record',
      action: 'upload',
      metadata: { fileName: file.name, fileSize: file.size, fileType: file.type },
    })

    log.info({ recordId: record.id, patientId, fileName }, 'Report uploaded successfully')

    return json({ recordId: record.id, fileName })
  } catch (error) {
    log.error({ err: error }, 'Unhandled error in report upload')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const reportsAnalyzePost = apiHandler(async ({ request, supabase, adminClient, json }) => {
  const requestId = uuidv4()
  const log = logger.child({ requestId, route: 'reports/analyze' })

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResult = checkAIRateLimit(user.id)
    if (!rateLimitResult.allowed) {
      log.warn({ userId: user.id }, 'AI rate limit exceeded')
      return json(
        { error: 'Too many AI requests. Please wait a moment.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) },
        }
      )
    }

    const body = await request.json()
    const { recordId } = body

    if (!recordId) {
      return json({ error: 'Record ID required' }, { status: 400 })
    }

    const { data: record, error: recordError } = await supabase
      .from('medical_records')
      .select('*')
      .eq('id', recordId)
      .is('deleted_at', null)
      .single()

    if (recordError || !record) {
      return json({ error: 'Record not found' }, { status: 404 })
    }

    log.info({ recordId, fileUrl: record.file_url, fileType: record.file_type }, 'Starting report analysis')

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('medical-files')
      .download(record.file_url)

    if (downloadError || !fileData) {
      log.error({ err: downloadError }, 'Failed to download file from storage')
      return json({ error: 'Failed to fetch file' }, { status: 500 })
    }

    let analysisResult: string | null = null

    if (record.file_type.startsWith('image/') || record.file_type === 'application/pdf') {
      const arrayBuffer = await fileData.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const prompt = `${REPORT_OCR_PROMPT}\n\nAfter extracting the text, analyze it and provide the structured output.\n\n${REPORT_ANALYSIS_SYSTEM_PROMPT}`

      analysisResult = await chatWithVision(base64, record.file_type, prompt, {
        temperature: 0.1,
        maxTokens: 3000,
        responseFormat: 'json',
      })
    }

    if (!analysisResult) {
      log.error({ recordId }, 'AI analysis returned empty result')
      return json({ error: 'Analysis failed - no result' }, { status: 500 })
    }

    let parsed: {
      title?: string
      lab_name?: string
      report_date?: string
      parameters?: Array<{ name: string; value: string; unit: string; reference_range: string; status: string }>
      ai_summary?: string
      flags?: string[]
      category?: string
    }

    try {
      parsed = JSON.parse(analysisResult)
    } catch {
      const jsonMatch = analysisResult.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        return json({ error: 'Failed to parse analysis result' }, { status: 500 })
      }
    }

    const textToEmbed = [
      parsed.title || record.title,
      parsed.ai_summary || '',
      parsed.parameters?.map((parameter) => `${parameter.name}: ${parameter.value} ${parameter.unit}`).join(', ') || '',
    ].join(' ')

    let embedding: number[] | null = null
    try {
      embedding = await embed(textToEmbed)
    } catch (embErr) {
      log.warn({ err: embErr }, 'Embedding generation failed (non-critical)')
    }

    const updateData: Record<string, unknown> = {
      title: parsed.title || record.title,
      ai_summary: parsed.ai_summary || null,
      parameters: parsed.parameters || null,
      flags: parsed.flags || null,
      lab_name: parsed.lab_name || null,
      report_date: parsed.report_date || null,
      category: parsed.category || record.category,
      ocr_text: textToEmbed,
    }

    if (embedding) {
      // Supabase pgvector accepts number[] directly — never stringify, it breaks similarity search.
      updateData.embedding = embedding
    }

    const { error: updateError } = await adminClient.from('medical_records').update(updateData).eq('id', recordId)

    if (updateError) {
      log.error({ err: updateError, recordId }, 'Failed to update medical record')
      return json({ error: 'Failed to save analysis' }, { status: 500 })
    }

    log.info(
      {
        recordId,
        title: parsed.title,
        parametersCount: parsed.parameters?.length || 0,
        flagsCount: parsed.flags?.length || 0,
        hasEmbedding: !!embedding,
      },
      'Report analysis completed'
    )

    return json({
      success: true,
      title: parsed.title,
      summary: parsed.ai_summary,
      parametersCount: parsed.parameters?.length || 0,
      flags: parsed.flags || [],
    })
  } catch (error) {
    log.error({ err: error }, 'Unhandled error in report analysis')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const vitalsExtractPost = apiHandler(async ({ request, supabase, json }) => {
  const log = logger.child({ route: 'vitals/extract' })

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 })

    const rateLimit = checkAIRateLimit(user.id)
    if (!rateLimit.allowed) {
      return json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || !file.type.startsWith('image/')) {
      return json({ error: 'Image file required' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const result = await chatWithVision(base64, file.type, VITALS_EXTRACTION_PROMPT, {
      temperature: 0.1,
      maxTokens: 1000,
      responseFormat: 'json',
    })

    if (!result) {
      return json({ error: 'Extraction failed' }, { status: 500 })
    }

    let parsed
    try {
      parsed = JSON.parse(result)
    } catch {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return json({ error: 'Failed to parse extraction result' }, { status: 500 })
      }
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch (err) {
        log.error({ err }, 'Vitals extraction JSON parse failed')
        return json({ error: 'Failed to parse extraction result' }, { status: 500 })
      }
    }

    log.info({ vitalsCount: parsed.vitals?.length || 0 }, 'Vitals extracted from image')

    return json(parsed)
  } catch (error) {
    log.error({ err: error }, 'Unhandled error in vitals extraction')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const aiChatPost = apiHandler(async ({ request, supabase, adminClient, json }) => {
  const log = logger.child({ route: 'ai/chat' })

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimit = checkAIRateLimit(user.id)
    if (!rateLimit.allowed) {
      return json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
    }

    const body = await request.json()
    const { message, patientId, history } = body

    if (!message || typeof message !== 'string' || !patientId) {
      return json({ error: 'Message and patient ID required' }, { status: 400 })
    }
    if (message.length > 4000) {
      return json({ error: 'Message too long (max 4000 chars)' }, { status: 400 })
    }
    if (!isUuid(patientId)) {
      return json({ error: 'Invalid patient ID' }, { status: 400 })
    }

    const { data: patient } = await adminClient
      .from('patients')
      .select('id, language_pref')
      .eq('id', patientId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!patient) {
      return json({ error: 'Patient not found' }, { status: 404 })
    }

    const queryEmbedding = await embed(message)

    const { data: matchedRecords } = await adminClient.rpc('match_medical_records', {
      query_embedding: queryEmbedding,
      match_threshold: 0.4,
      match_count: 7,
      patient_id_filter: patientId,
    })

    const { data: matchedJournal } = await adminClient.rpc('match_journal_entries', {
      query_embedding: queryEmbedding,
      match_threshold: 0.4,
      match_count: 5,
      patient_id_filter: patientId,
    })

    const contextParts: string[] = []
    const sourceIds: string[] = []

    if (matchedRecords && matchedRecords.length > 0) {
      for (const record of matchedRecords) {
        contextParts.push(`[Report: ${record.title}] ${record.ai_summary || record.ocr_text?.slice(0, 200) || ''}`)
        sourceIds.push(record.id)
      }
    }

    if (matchedJournal && matchedJournal.length > 0) {
      for (const entry of matchedJournal) {
        contextParts.push(`[Journal ${entry.category} - ${entry.recorded_at}] ${entry.value} ${entry.notes || ''}`)
        sourceIds.push(entry.id)
      }
    }

    const context = contextParts.join('\n')
    const sourceCount = (matchedRecords?.length || 0) + (matchedJournal?.length || 0)

    const systemPrompt = PATIENT_CHAT_SYSTEM_PROMPT
      .replace('{context}', context || 'No relevant records found.')
      .replace('{source_count}', String(sourceCount))

    const safeHistory = (Array.isArray(history) ? history : [])
      .filter(
        (m: unknown): m is { role: 'user' | 'assistant'; content: string } =>
          !!m &&
          typeof m === 'object' &&
          (m as { role?: unknown }).role !== undefined &&
          ['user', 'assistant'].includes(((m as { role: string }).role)) &&
          typeof (m as { content?: unknown }).content === 'string'
      )
      .slice(-6)

    const messages = [
      ...safeHistory,
      { role: 'user' as const, content: message },
    ]

    if (patient.language_pref !== 'en') {
      messages[0] = {
        ...messages[0],
        content: `[Respond in ${patient.language_pref} language] ${messages[0].content}`,
      }
    }

    const response = await aiChat(messages, {
      systemPrompt,
      temperature: 0.4,
      maxTokens: 800,
    })

    if (!response) {
      return json({ error: 'AI response empty' }, { status: 500 })
    }

    log.info({ patientId, sourcesUsed: sourceCount }, 'AI chat response generated')

    return json({
      response,
      sourceIds,
      sourceCount,
    })
  } catch (error) {
    log.error({ err: error }, 'Unhandled error in AI chat')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const aiCarePlanPost = apiHandler(async ({ request, supabase, adminClient, json }) => {
  const log = logger.child({ route: 'ai/care-plan' })

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimit = checkAIRateLimit(user.id)
    if (!rateLimit.allowed) {
      return json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json()
    const { patientId, appointmentId } = body

    if (!patientId) {
      return json({ error: 'Patient ID required' }, { status: 400 })
    }

    const { data: patient } = await adminClient
      .from('patients')
      .select('name, language_pref, date_of_birth, gender')
      .eq('id', patientId)
      .is('deleted_at', null)
      .single()

    if (!patient) {
      return json({ error: 'Patient not found' }, { status: 404 })
    }

    const { data: records } = await adminClient
      .from('medical_records')
      .select('title, ai_summary, parameters')
      .eq('patient_id', patientId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(3)

    const { data: vitals } = await adminClient
      .from('patient_vitals')
      .select('*')
      .eq('patient_id', patientId)
      .is('deleted_at', null)
      .order('recorded_at', { ascending: false })
      .limit(1)

    const contextParts: string[] = []
    contextParts.push(`Patient: ${patient.name}, ${patient.gender || 'unknown'}, DOB: ${patient.date_of_birth || 'unknown'}`)

    if (records) {
      for (const record of records) {
        contextParts.push(`Report: ${record.title} - ${record.ai_summary || ''}`)
      }
    }

    if (vitals && vitals.length > 0) {
      const vital = vitals[0]
      const vitalParts = []
      if (vital.bp_systolic) vitalParts.push(`BP: ${vital.bp_systolic}/${vital.bp_diastolic}`)
      if (vital.weight) vitalParts.push(`Weight: ${vital.weight}kg`)
      if (vital.height) vitalParts.push(`Height: ${vital.height}cm`)
      contextParts.push(`Latest Vitals: ${vitalParts.join(', ')}`)
    }

    const context = contextParts.join('\n')
    const languageInstruction = patient.language_pref !== 'en' ? `Respond in ${patient.language_pref} language.` : ''

    const result = await aiChat(
      [
        {
          role: 'user',
          content: `Generate a personalized diet and exercise plan for this patient:\n\n${context}\n\n${languageInstruction}`,
        },
      ],
      {
        systemPrompt: CARE_PLAN_SYSTEM_PROMPT,
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: 'json',
      }
    )

    if (!result) {
      return json({ error: 'Failed to generate care plan' }, { status: 500 })
    }

    let carePlan
    try {
      carePlan = JSON.parse(result)
    } catch {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        carePlan = JSON.parse(jsonMatch[0])
      } else {
        return json({ error: 'Failed to parse care plan' }, { status: 500 })
      }
    }

    const { data: saved, error: saveError } = await adminClient
      .from('care_plans')
      .insert({
        patient_id: patientId,
        appointment_id: appointmentId || null,
        doctor_id: null,
        diet_plan: carePlan.diet_plan || {},
        exercise_plan: carePlan.exercise_plan || {},
        hydration: carePlan.hydration || null,
        sleep_recommendation: carePlan.sleep || null,
        valid_from: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single()

    if (saveError) {
      log.error({ err: saveError }, 'Failed to save care plan')
    }

    log.info({ patientId, carePlanId: saved?.id }, 'Care plan generated')

    return json({ carePlan, id: saved?.id })
  } catch (error) {
    log.error({ err: error }, 'Unhandled error in care plan generation')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const aiCalibratePost = apiHandler(async ({ request, supabase, adminClient, json }) => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { patientId } = await request.json()
    if (!patientId) {
      return json({ error: 'patientId required' }, { status: 400 })
    }

    const { data: patient } = await adminClient
      .from('patients')
      .select('id, name')
      .eq('id', patientId)
      .eq('user_id', user.id)
      .single()

    if (!patient) {
      return json({ error: 'Forbidden' }, { status: 403 })
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: journalEntries } = await adminClient
      .from('health_journal_entries')
      .select('category, value, unit, context, notes, recorded_at')
      .eq('patient_id', patientId)
      .is('deleted_at', null)
      .gte('recorded_at', thirtyDaysAgo)
      .order('recorded_at', { ascending: false })
      .limit(100)

    const { data: records } = await adminClient
      .from('medical_records')
      .select('title, ai_summary, parameters, flags, report_date')
      .eq('patient_id', patientId)
      .is('deleted_at', null)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(10)

    const { data: vitals } = await adminClient
      .from('patient_vitals')
      .select('bp_systolic, bp_diastolic, pulse, weight, height, spo2, recorded_at')
      .eq('patient_id', patientId)
      .order('recorded_at', { ascending: false })
      .limit(10)

    const journalSummary = (journalEntries || [])
      .map(
        (entry) =>
          `${entry.category}: ${entry.value} ${entry.unit || ''} (${entry.context || 'no context'}) on ${new Date(entry.recorded_at).toLocaleDateString()}`
      )
      .join('\n')

    const recordsSummary = (records || [])
      .map((record) => `Report: ${record.title} - ${record.ai_summary || 'No summary'} (${record.report_date || 'unknown date'})`)
      .join('\n')

    const vitalsSummary = (vitals || [])
      .map(
        (vital) =>
          `Vitals: BP ${vital.bp_systolic}/${vital.bp_diastolic}, Pulse ${vital.pulse}, Weight ${vital.weight}kg, SpO2 ${vital.spo2}% on ${new Date(vital.recorded_at).toLocaleDateString()}`
      )
      .join('\n')

    const dataContext = `Patient: ${patient.name}
    
HEALTH JOURNAL (Last 30 days, ${journalEntries?.length || 0} entries):
${journalSummary || 'No journal entries'}

MEDICAL REPORTS:
${recordsSummary || 'No recent reports'}

CLINICAL VITALS:
${vitalsSummary || 'No vitals recorded'}`

    const response = await aiChat(
      [{ role: 'user', content: `Analyze this patient's health data and provide insights:\n\n${dataContext}` }],
      {
        systemPrompt: INSIGHT_SYSTEM_PROMPT,
        temperature: 0.3,
        maxTokens: 800,
        responseFormat: 'json',
      }
    )

    if (!response) {
      return json({ error: 'AI returned empty response' }, { status: 500 })
    }

    let insight
    try {
      insight = JSON.parse(response)
    } catch {
      insight = {
        overview: response,
        trends: [],
        recommendation: '',
        flags: [],
      }
    }

    const unembedded = (journalEntries || []).filter(() => true)
    if (unembedded.length > 0) {
      const { data: noEmbedding } = await adminClient
        .from('health_journal_entries')
        .select('id, category, value, unit, context, notes')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .is('embedding', null)
        .limit(50)

      if (noEmbedding && noEmbedding.length > 0) {
        for (let index = 0; index < Math.min(noEmbedding.length, 30); index++) {
          const entry = noEmbedding[index]
          const text = `${entry.category}: ${entry.value} ${entry.unit || ''} ${entry.context || ''} ${entry.notes || ''}`
          try {
            const vector = await embed(text)
            await adminClient.from('health_journal_entries').update({ embedding: vector }).eq('id', entry.id)
          } catch (embedError) {
            logger.error({ err: embedError, entryId: entry.id }, 'Failed to embed journal entry')
          }
        }
      }
    }

    return json({
      insight,
      dataPoints: {
        journalEntries: journalEntries?.length || 0,
        reports: records?.length || 0,
        vitals: vitals?.length || 0,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error({ err: error, route: 'ai/calibrate' }, 'Calibrate error')
    return json({ error: 'Failed to generate insight' }, { status: 500 })
  }
})

export const aiBriefingGet = apiHandler(async ({ params, supabase, adminClient, json }) => {
  const appointmentId = params.id
  const log = logger.child({ route: 'ai/briefing', appointmentId })

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimit = checkAIRateLimit(user.id)
    if (!rateLimit.allowed) {
      return json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('patient_id, doctor_id, status, notes')
      .eq('id', appointmentId)
      .is('deleted_at', null)
      .single()

    if (apptError || !appointment) {
      return json({ error: 'Appointment not found' }, { status: 404 })
    }

    const { data: doctor } = await supabase
      .from('doctors')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!doctor || doctor.id !== appointment.doctor_id) {
      return json({ error: 'Unauthorized - not your appointment' }, { status: 403 })
    }

    const patientId = appointment.patient_id
    log.info({ patientId }, 'Generating doctor briefing')

    const queryEmbedding = await embed('patient medical history summary for consultation briefing')

    const { data: matchedRecords } = await adminClient.rpc('match_medical_records', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 15,
      patient_id_filter: patientId,
    })

    const { data: matchedJournal } = await adminClient.rpc('match_journal_entries', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 10,
      patient_id_filter: patientId,
    })

    const { data: recentVitals } = await adminClient
      .from('patient_vitals')
      .select('*')
      .eq('patient_id', patientId)
      .is('deleted_at', null)
      .order('recorded_at', { ascending: false })
      .limit(3)

    const { data: prescriptions } = await adminClient
      .from('prescriptions')
      .select('diagnosis, medicines, created_at')
      .eq('patient_id', patientId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(3)

    const contextParts: string[] = []

    if (matchedRecords && matchedRecords.length > 0) {
      contextParts.push('=== MEDICAL RECORDS ===')
      for (const record of matchedRecords) {
        contextParts.push(`[${record.title}] ${record.ai_summary || record.ocr_text?.slice(0, 300) || 'No details'}`)
      }
    }

    if (matchedJournal && matchedJournal.length > 0) {
      contextParts.push('\n=== HEALTH JOURNAL ===')
      for (const entry of matchedJournal) {
        contextParts.push(`[${entry.recorded_at}] ${entry.category}: ${entry.value} ${entry.notes || ''}`)
      }
    }

    if (recentVitals && recentVitals.length > 0) {
      contextParts.push('\n=== RECENT VITALS ===')
      for (const vital of recentVitals) {
        const parts = []
        if (vital.bp_systolic) parts.push(`BP: ${vital.bp_systolic}/${vital.bp_diastolic}`)
        if (vital.pulse) parts.push(`Pulse: ${vital.pulse}`)
        if (vital.weight) parts.push(`Weight: ${vital.weight}kg`)
        if (vital.spo2) parts.push(`SpO2: ${vital.spo2}%`)
        contextParts.push(`[${vital.recorded_at}] ${parts.join(', ')}`)
      }
    }

    if (prescriptions && prescriptions.length > 0) {
      contextParts.push('\n=== PRESCRIPTIONS ===')
      for (const rx of prescriptions) {
        const meds = Array.isArray(rx.medicines)
          ? rx.medicines.map((medicine: { name?: string } | string) => (typeof medicine === 'string' ? medicine : medicine.name || medicine)).join(', ')
          : ''
        contextParts.push(`[${rx.created_at}] Dx: ${rx.diagnosis} | Rx: ${meds}`)
      }
    }

    const context = contextParts.join('\n')

    if (!context.trim()) {
      return json({
        briefing: 'Limited patient history available. This appears to be a new patient or first visit.',
        key_metrics: { hba1c: null, bp: null, ldl: null, egfr: null, bmi: null },
        recent_visits: [],
        current_medications: [],
        suggested_questions: [
          'What brings you in today?',
          'Do you have any existing medical conditions?',
          'Are you currently taking any medications?',
        ],
        flags: [],
        positive_trends: [],
      })
    }

    const briefingResult = await aiChat(
      [{ role: 'user', content: `Generate a clinical briefing for the upcoming consultation based on this patient data:\n\n${context}` }],
      {
        systemPrompt: DOCTOR_BRIEFING_SYSTEM_PROMPT,
        temperature: 0.2,
        maxTokens: 1500,
        responseFormat: 'json',
      }
    )

    if (!briefingResult) {
      log.error('AI returned empty briefing')
      return json({ error: 'Failed to generate briefing' }, { status: 500 })
    }

    let briefingData
    try {
      briefingData = JSON.parse(briefingResult)
    } catch {
      const jsonMatch = briefingResult.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        briefingData = JSON.parse(jsonMatch[0])
      } else {
        log.error({ rawResult: briefingResult.slice(0, 200) }, 'Failed to parse briefing JSON')
        return json({ error: 'Failed to parse briefing' }, { status: 500 })
      }
    }

    log.info({ patientId, recordsUsed: matchedRecords?.length, journalUsed: matchedJournal?.length }, 'Briefing generated')

    return json(briefingData)
  } catch (error) {
    log.error({ err: error }, 'Unhandled error in briefing generation')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const embeddingsJournalPost = apiHandler(async ({ request, supabase, adminClient, json }) => {
  const log = logger.child({ route: 'embeddings/journal' })
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimit = checkAIRateLimit(user.id)
    if (!rateLimit.allowed) {
      return json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { entryId, text } = await request.json()
    if (!isUuid(entryId) || !text || typeof text !== 'string') {
      return json({ error: 'Valid entryId and text required' }, { status: 400 })
    }
    if (text.length > 8000) {
      return json({ error: 'Text too long (max 8000 chars)' }, { status: 400 })
    }

    // Use RLS-bound client so users cannot embed other users' entries.
    const { data: entry } = await supabase
      .from('health_journal_entries')
      .select('id, patient_id')
      .eq('id', entryId)
      .is('deleted_at', null)
      .single()

    if (!entry) {
      return json({ error: 'Entry not found' }, { status: 404 })
    }

    const { data: patient } = await adminClient
      .from('patients')
      .select('id')
      .eq('id', entry.patient_id)
      .eq('user_id', user.id)
      .single()

    if (!patient) {
      return json({ error: 'Forbidden' }, { status: 403 })
    }

    const vector = await embed(text)

    const { error: updateError } = await adminClient
      .from('health_journal_entries')
      .update({ embedding: vector })
      .eq('id', entryId)

    if (updateError) {
      log.error({ err: updateError, entryId }, 'Embedding update failed')
      return json({ error: 'Failed to store embedding' }, { status: 500 })
    }

    return json({ success: true })
  } catch (error) {
    log.error({ err: error }, 'Unhandled error in embeddings/journal')
    return json({ error: 'Internal error' }, { status: 500 })
  }
})

export const paymentsVerifyPost = apiHandler(async ({ request, supabase, json }) => {
  const log = logger.child({ route: 'payments/verify' })

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 })

    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()

    if (roleData?.role !== 'admin') {
      return json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { appointmentId, action } = body

    if (!isUuid(appointmentId) || !['verify', 'reject'].includes(action)) {
      return json({ error: 'Invalid request' }, { status: 400 })
    }

    const newStatus = action === 'verify' ? 'verified' : 'rejected'

    // Idempotency: if already in target state (or terminal opposite), don't toggle.
    const { data: current } = await supabase
      .from('appointments')
      .select('payment_status, clinic_id')
      .eq('id', appointmentId)
      .is('deleted_at', null)
      .single()

    if (!current) {
      return json({ error: 'Appointment not found' }, { status: 404 })
    }

    if (current.payment_status === newStatus) {
      return json({ success: true, status: newStatus, idempotent: true })
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update({ payment_status: newStatus })
      .eq('id', appointmentId)
      .eq('payment_status', current.payment_status)

    if (updateError) {
      log.error({ err: updateError }, 'Failed to update payment status')
      return json({ error: 'Failed to update' }, { status: 500 })
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      record_id: appointmentId,
      record_type: 'appointment',
      action: `payment_${action}`,
    })

    log.info({ appointmentId, action, adminId: user.id }, 'Payment status updated')

    return json({ success: true, status: newStatus })
  } catch (error) {
    log.error({ err: error }, 'Unhandled error')
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})

async function resolveClinicId(supabaseAdmin: AnySupabaseClient, clinicId?: string) {
  if (clinicId) return clinicId

  const { data: clinic } = await supabaseAdmin.from('clinics').select('id').limit(1).single()
  if (clinic) return clinic.id

  const { data: newClinic } = await supabaseAdmin
    .from('clinics')
    .insert({
      name: 'Dev Clinic',
      address: '123 Dev Street, Mumbai',
      phone: '+919000000000',
      consultation_fee: 500,
      working_hours_start: '09:00',
      working_hours_end: '18:00',
    })
    .select('id')
    .single()

  return newClinic?.id
}