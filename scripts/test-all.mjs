/**
 * Comprehensive HealthBridge E2E Test Script
 * Tests: Auth, Patient Pages, Doctor Queue, AI RAG Chat
 */
import { createClient } from '@supabase/supabase-js'
import http from 'http'
import OpenAI from 'openai'

const SUPABASE_URL = 'https://uajlbqcyxaobnyaykvpx.supabase.co'
const SUPABASE_KEY = 'sb_publishable_rofGIGuPbCO54ntQ-yNR1w_pAY3FOsu'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamxicWN5eGFvYm55YXlrdnB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkxNzYzNywiZXhwIjoyMDg3NDkzNjM3fQ.EkyVMgRcfk_IryapTRxd9lIWeWyow1lvXhkAWzxOmeM'

const results = []
let passed = 0
let failed = 0

function log(test, status, detail) {
  const icon = status === 'PASS' ? '✓' : '✗'
  console.log(`  ${icon} ${test}${detail ? ' — ' + detail : ''}`)
  results.push({ test, status, detail })
  if (status === 'PASS') passed++
  else failed++
}

function request(method, path, body, cookie) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null
    const headers = { 'Content-Type': 'application/json' }
    if (data) headers['Content-Length'] = Buffer.byteLength(data)
    if (cookie) headers['Cookie'] = cookie
    const req = http.request({ hostname: 'localhost', port: 3000, path, method, headers }, (res) => {
      let b = ''
      res.on('data', d => b += d)
      res.on('end', () => {
        let json = null
        try { json = JSON.parse(b) } catch {}
        resolve({ status: res.statusCode, body: json, raw: b, headers: res.headers })
      })
    })
    req.on('error', (e) => resolve({ status: 0, body: null, raw: e.message }))
    if (data) req.write(data)
    req.end()
  })
}

async function getAuthCookie(email) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data: session, error } = await supabase.auth.signInWithPassword({
    email, password: 'dev-healthbridge-2024!'
  })
  if (error) return null
  const cookieBase = 'sb-uajlbqcyxaobnyaykvpx-auth-token'
  const tokenObj = {
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    expires_at: session.session.expires_at,
    expires_in: session.session.expires_in,
    token_type: 'bearer'
  }
  return cookieBase + '=' + encodeURIComponent(JSON.stringify(tokenObj))
}

async function testAuth() {
  console.log('\n━━━ 1. AUTHENTICATION ━━━')

  // Dev login for all roles
  for (const [phone, role] of [['9000000001', 'patient'], ['9000000002', 'doctor'], ['9000000003', 'admin'], ['9000000000', 'super']]) {
    const r = await request('POST', '/api/auth/dev-login', { phone, otp: '111111' })
    log(`Dev login ${role} (${phone})`, r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`)
  }

  // Supabase direct auth
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: '9000000001@dev.healthbridge.local', password: 'dev-healthbridge-2024!'
  })
  log('Supabase signInWithPassword', !error ? 'PASS' : 'FAIL', error?.message || `uid=${data.user.id}`)
}

async function testAuthContext() {
  console.log('\n━━━ 2. AUTH CONTEXT (Role Resolution) ━━━')

  const tests = [
    { email: '9000000001@dev.healthbridge.local', expectedRole: 'patient', label: 'Patient' },
    { email: '9000000002@dev.healthbridge.local', expectedRole: 'doctor', label: 'Doctor' },
    { email: '9000000003@dev.healthbridge.local', expectedRole: 'admin', label: 'Admin' },
  ]

  for (const t of tests) {
    const cookie = await getAuthCookie(t.email)
    const r = await request('GET', '/api/auth/context', null, cookie)
    const roleMatch = r.body?.role === t.expectedRole
    log(`${t.label} role = "${t.expectedRole}"`, r.status === 200 && roleMatch ? 'PASS' : 'FAIL',
      `got: role=${r.body?.role}, patientId=${r.body?.patientId || 'null'}, doctorId=${r.body?.doctorId || 'null'}`)
  }
}

async function testPatientPages() {
  console.log('\n━━━ 3. PATIENT PAGES (HTTP 200) ━━━')

  const cookie = await getAuthCookie('9000000001@dev.healthbridge.local')
  const pages = ['/home', '/journal', '/reports', '/appointments', '/ai-chat']

  for (const page of pages) {
    const r = await request('GET', page, null, cookie)
    log(`GET ${page}`, r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}, size=${r.raw.length}b`)
  }
}

async function testPatientDataAPIs() {
  console.log('\n━━━ 4. PATIENT DATA APIs ━━━')

  const cookie = await getAuthCookie('9000000001@dev.healthbridge.local')

  // Home data
  const home = await request('GET', '/api/patient/data?section=home', null, cookie)
  log('Home data', home.status === 200 && home.body?.patient ? 'PASS' : 'FAIL',
    `patient=${home.body?.patient?.name}, reports=${home.body?.reports?.length}, journal=${home.body?.journal?.length}`)

  // Queue position
  log('Queue position', home.body?.queuePosition ? 'PASS' : 'FAIL',
    home.body?.queuePosition ? `pos=${home.body.queuePosition.position} at ${home.body.queuePosition.clinicName}` : 'none')

  // Journal data
  const journal = await request('GET', '/api/patient/data?section=journal', null, cookie)
  log('Journal entries', journal.status === 200 && journal.body?.entries?.length > 0 ? 'PASS' : 'FAIL',
    `count=${journal.body?.entries?.length || 0}`)

  // Reports data
  const reports = await request('GET', '/api/patient/data?section=reports', null, cookie)
  log('Medical records', reports.status === 200 && reports.body?.records?.length > 0 ? 'PASS' : 'FAIL',
    `count=${reports.body?.records?.length || 0}`)

  // Appointments data
  const appts = await request('GET', '/api/patient/data?section=appointments', null, cookie)
  log('Appointments', appts.status === 200 && appts.body?.appointments?.length > 0 ? 'PASS' : 'FAIL',
    `count=${appts.body?.appointments?.length || 0}`)
}

async function testDoctorQueue() {
  console.log('\n━━━ 5. DOCTOR QUEUE ━━━')

  const cookie = await getAuthCookie('9000000002@dev.healthbridge.local')
  const r = await request('GET', '/api/doctor/queue', null, cookie)
  log('Doctor queue API', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`)
  log('Queue has patients', r.body?.queue?.length > 0 ? 'PASS' : 'FAIL',
    `count=${r.body?.queue?.length || 0}, doctorId=${r.body?.doctorId}`)

  if (r.body?.queue?.length > 0) {
    const first = r.body.queue[0]
    log('Queue item structure', first.patient_id && first.status && first.patients ? 'PASS' : 'FAIL',
      `patient=${first.patients?.name}, status=${first.status}, pos=${first.queue_position}`)
  }
}

async function testAIChat() {
  console.log('\n━━━ 6. AI RAG CHAT ━━━')

  const cookie = await getAuthCookie('9000000001@dev.healthbridge.local')

  // Test basic chat
  const chat1 = await request('POST', '/api/ai/chat', {
    message: 'What is my blood sugar level?',
    patientId: '33333333-3333-3333-3333-333333333333',
    history: []
  }, cookie)
  log('Chat API responds', chat1.status === 200 ? 'PASS' : 'FAIL', `status=${chat1.status}`)
  log('AI response content', chat1.body?.response?.length > 50 ? 'PASS' : 'FAIL',
    `length=${chat1.body?.response?.length || 0} chars`)
  log('RAG sources used', chat1.body?.sourceCount > 0 ? 'PASS' : 'FAIL',
    `sources=${chat1.body?.sourceCount}`)
  log('Response mentions numbers', /\d+/.test(chat1.body?.response || '') ? 'PASS' : 'FAIL',
    'Contains actual data from records')

  // Test with medical query
  const chat2 = await request('POST', '/api/ai/chat', {
    message: 'Tell me about my HbA1c report',
    patientId: '33333333-3333-3333-3333-333333333333',
    history: []
  }, cookie)
  log('HbA1c query', chat2.status === 200 && chat2.body?.response?.includes('7.2') ? 'PASS' : 'FAIL',
    chat2.body?.response?.includes('7.2') ? 'Correctly references 7.2% HbA1c' : `response=${chat2.body?.response?.substring(0, 100)}`)

  // Test unauthorized access
  const chat3 = await request('POST', '/api/ai/chat', {
    message: 'test',
    patientId: '33333333-3333-3333-3333-333333333333',
    history: []
  })
  log('Unauthenticated blocked', chat3.status === 401 ? 'PASS' : 'FAIL', `status=${chat3.status}`)

  // Test wrong patient access
  const doctorCookie = await getAuthCookie('9000000002@dev.healthbridge.local')
  const chat4 = await request('POST', '/api/ai/chat', {
    message: 'test',
    patientId: '33333333-3333-3333-3333-333333333333',
    history: []
  }, doctorCookie)
  log('Cross-user access blocked', chat4.status === 404 ? 'PASS' : 'FAIL',
    `status=${chat4.status} (doctor cant access patient chat)`)
}

async function testDatabaseIntegrity() {
  console.log('\n━━━ 7. DATABASE INTEGRITY ━━━')

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Check all tables exist and have data
  const tables = [
    { name: 'clinics', minRows: 1 },
    { name: 'doctors', minRows: 1 },
    { name: 'patients', minRows: 1 },
    { name: 'appointments', minRows: 1 },
    { name: 'medical_records', minRows: 1 },
    { name: 'health_journal_entries', minRows: 5 },
    { name: 'user_roles', minRows: 3 },
    { name: 'prescriptions', minRows: 1 },
    { name: 'care_plans', minRows: 1 },
    { name: 'patient_vitals', minRows: 1 },
  ]

  for (const t of tables) {
    const { data, error } = await supabase.from(t.name).select('id').limit(t.minRows)
    log(`Table ${t.name}`, !error && data?.length >= t.minRows ? 'PASS' : 'FAIL',
      error ? error.message : `${data?.length} rows`)
  }

  // Check embeddings exist
  const { data: embRecs } = await supabase.from('medical_records').select('id, embedding').not('embedding', 'is', null)
  log('Medical records have embeddings', embRecs?.length >= 2 ? 'PASS' : 'FAIL', `${embRecs?.length || 0} with embeddings`)

  const { data: embJournal } = await supabase.from('health_journal_entries').select('id, embedding').not('embedding', 'is', null)
  log('Journal entries have embeddings', embJournal?.length >= 10 ? 'PASS' : 'FAIL', `${embJournal?.length || 0} with embeddings`)
}

async function testNvidiaAPIs() {
  console.log('\n━━━ 8. NVIDIA NIM APIs ━━━')

  const ai = new OpenAI({ apiKey: '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', baseURL: 'https://integrate.api.nvidia.com/v1' })

  // LLM test
  try {
    const r = await ai.chat.completions.create({ model: 'meta/llama-3.1-8b-instruct', messages: [{ role: 'user', content: 'Reply with just OK' }], max_tokens: 10 })
    log('NVIDIA LLM (llama-3.1-8b)', r.choices?.[0]?.message ? 'PASS' : 'FAIL', `response="${r.choices[0].message.content}"`)
  } catch (e) {
    log('NVIDIA LLM', 'FAIL', e.message)
  }

  // Embedding test
  try {
    const r = await ai.embeddings.create({ model: 'nvidia/nv-embedqa-e5-v5', input: 'test', input_type: 'query' })
    log('NVIDIA Embeddings (nv-embedqa-e5-v5)', r.data?.[0]?.embedding?.length === 1024 ? 'PASS' : 'FAIL',
      `dimensions=${r.data[0].embedding.length}`)
  } catch (e) {
    log('NVIDIA Embeddings', 'FAIL', e.message)
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║     HealthBridge Comprehensive Test Suite        ║')
  console.log('╚══════════════════════════════════════════════════╝')

  await testAuth()
  await testAuthContext()
  await testPatientPages()
  await testPatientDataAPIs()
  await testDoctorQueue()
  await testAIChat()
  await testDatabaseIntegrity()
  await testNvidiaAPIs()

  console.log('\n══════════════════════════════════════════════════')
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`)
  console.log('══════════════════════════════════════════════════')

  if (failed > 0) {
    console.log('\n  Failed tests:')
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.test}: ${r.detail}`))
  }
}

main().catch(console.error)
