/**
 * Seed script for HealthBridge — populates the database with test data.
 * Run AFTER the schema.sql has been applied.
 * 
 * Usage: node scripts/seed-data.mjs
 * 
 * Uses the Supabase service role key (bypasses RLS) via REST API.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uajlbqcyxaobnyaykvpx.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamxicWN5eGFvYm55YXlrdnB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkxNzYzNywiZXhwIjoyMDg3NDkzNjM3fQ.EkyVMgRcfk_IryapTRxd9lIWeWyow1lvXhkAWzxOmeM'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// User IDs from dev-login (created earlier)
const USERS = {
  patient: '73b0320e-769b-49b3-b431-5c0f775708a5',    // +919000000001
  doctor: 'd5b1ebcc-f73f-4c99-8d40-26456d6cc87a',     // +919000000002
  admin: '720420b6-dcdc-40b6-aa04-71b2d1fc4e4f',      // +919000000003
  superUser: '342d14fd-8ab4-48cb-80ba-9104126475cc',   // +919000000000
}

async function seed() {
  console.log('🌱 Seeding HealthBridge database...\n')

  // 1. Create Clinic
  console.log('1. Creating clinic...')
  const { data: clinic, error: clinicErr } = await supabase.from('clinics').upsert({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'HealthPlus Clinic',
    address: '42, MG Road, Bengaluru, Karnataka 560001',
    phone: '+919876543210',
    email: 'admin@healthplus.in',
    departments: ['General', 'Cardiology', 'Dermatology'],
    settings: { consultation_fee: 500, currency: 'INR' },
  }, { onConflict: 'id' }).select().single()

  if (clinicErr) {
    console.error('  ✗ Clinic error:', clinicErr.message)
    // Try to continue anyway
  } else {
    console.log('  ✓ Clinic:', clinic.name)
  }

  const clinicId = '11111111-1111-1111-1111-111111111111'

  // 2. Create Doctor record
  console.log('2. Creating doctor...')
  const { data: doctor, error: doctorErr } = await supabase.from('doctors').upsert({
    id: '22222222-2222-2222-2222-222222222222',
    user_id: USERS.doctor,
    clinic_id: clinicId,
    name: 'Dr. Priya Sharma',
    phone: '+919000000002',
    email: 'priya@healthplus.in',
    specialization: 'General Medicine',
    qualification: 'MBBS, MD',
    registration_number: 'KA-MED-2024-1234',
    consultation_fee: 500,
    availability: {
      monday: { start: '09:00', end: '17:00', slots: 20 },
      tuesday: { start: '09:00', end: '17:00', slots: 20 },
      wednesday: { start: '09:00', end: '17:00', slots: 20 },
      thursday: { start: '09:00', end: '17:00', slots: 20 },
      friday: { start: '09:00', end: '17:00', slots: 20 },
      saturday: { start: '09:00', end: '13:00', slots: 10 },
    },
  }, { onConflict: 'user_id' }).select().single()

  if (doctorErr) console.error('  ✗ Doctor error:', doctorErr.message)
  else console.log('  ✓ Doctor:', doctor.name)

  const doctorId = '22222222-2222-2222-2222-222222222222'

  // 3. Create Patient record
  console.log('3. Creating patient...')
  const { data: patient, error: patientErr } = await supabase.from('patients').upsert({
    id: '33333333-3333-3333-3333-333333333333',
    user_id: USERS.patient,
    name: 'Meena Kumari',
    phone: '+919000000001',
    email: 'meena@example.com',
    date_of_birth: '1985-06-15',
    gender: 'female',
    blood_group: 'B+',
    address: '15, Jayanagar, Bengaluru',
    language_pref: 'en',
  }, { onConflict: 'user_id' }).select().single()

  if (patientErr) console.error('  ✗ Patient error:', patientErr.message)
  else console.log('  ✓ Patient:', patient.name)

  const patientId = '33333333-3333-3333-3333-333333333333'

  // 4. Update user_roles with clinic
  console.log('4. Updating user roles...')
  await supabase.from('user_roles').upsert([
    { user_id: USERS.patient, role: 'patient' },
    { user_id: USERS.doctor, role: 'doctor', clinic_id: clinicId },
    { user_id: USERS.admin, role: 'admin', clinic_id: clinicId },
    { user_id: USERS.superUser, role: 'admin', clinic_id: clinicId },
  ], { onConflict: 'user_id' })
  console.log('  ✓ Roles updated')

  // 5. Create appointments (doctor queue for today)
  console.log('5. Creating appointments...')
  const today = new Date().toISOString().split('T')[0]
  
  const { error: apptErr } = await supabase.from('appointments').upsert([
    {
      id: '44444444-4444-4444-4444-444444444441',
      patient_id: patientId,
      doctor_id: doctorId,
      clinic_id: clinicId,
      queue_date: today,
      queue_position: 1,
      status: 'waiting',
      visit_type: 'scheduled',
      consultation_fee: 500,
      payment_status: 'verified',
      notes: 'Follow-up for diabetes management',
    },
    {
      id: '44444444-4444-4444-4444-444444444442',
      patient_id: patientId,
      doctor_id: doctorId,
      clinic_id: clinicId,
      queue_date: today,
      queue_position: 2,
      status: 'scheduled',
      visit_type: 'followup',
      consultation_fee: 500,
      payment_status: 'pending',
      follow_up_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  ], { onConflict: 'id' })

  if (apptErr) console.error('  ✗ Appointments error:', apptErr.message)
  else console.log('  ✓ 2 appointments created')

  // 6. Create health journal entries
  console.log('6. Creating health journal entries...')
  const journalEntries = [
    { patient_id: patientId, category: 'blood_sugar', value: '145', unit: 'mg/dL', context: 'fasting', recorded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { patient_id: patientId, category: 'blood_sugar', value: '182', unit: 'mg/dL', context: 'post-meal', recorded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString() },
    { patient_id: patientId, category: 'bp', value: '130/85', unit: 'mmHg', context: 'morning', recorded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { patient_id: patientId, category: 'weight', value: '72', unit: 'kg', context: 'morning', recorded_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
    { patient_id: patientId, category: 'steps', value: '4500', unit: 'steps', recorded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { patient_id: patientId, category: 'sleep', value: '6.5', unit: 'hours', recorded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { patient_id: patientId, category: 'water', value: '6', unit: 'glasses', recorded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { patient_id: patientId, category: 'mood', value: 'good', notes: 'Slept well, feeling energetic', recorded_at: new Date().toISOString() },
    { patient_id: patientId, category: 'blood_sugar', value: '138', unit: 'mg/dL', context: 'fasting', recorded_at: new Date().toISOString() },
    { patient_id: patientId, category: 'bp', value: '128/82', unit: 'mmHg', context: 'morning', recorded_at: new Date().toISOString() },
  ]

  const { error: journalErr } = await supabase.from('health_journal_entries').insert(journalEntries)
  if (journalErr) console.error('  ✗ Journal error:', journalErr.message)
  else console.log('  ✓', journalEntries.length, 'journal entries created')

  // 7. Create medical records (without actual files, but with OCR text and AI summaries)
  console.log('7. Creating medical records...')
  const { error: recordErr } = await supabase.from('medical_records').upsert([
    {
      id: '55555555-5555-5555-5555-555555555551',
      patient_id: patientId,
      title: 'Complete Blood Count (CBC)',
      category: 'blood_test',
      file_url: 'https://placeholder.co/report-cbc.pdf',
      file_type: 'application/pdf',
      lab_name: 'SRL Diagnostics',
      report_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ocr_text: 'Complete Blood Count Report. Patient: Meena Kumari. Hemoglobin: 12.5 g/dL (Normal: 12-16). WBC: 7200/cumm (Normal: 4000-11000). Platelets: 2.5 lakhs/cumm (Normal: 1.5-4.0). RBC: 4.2 million/cumm. MCV: 86 fL. MCH: 29 pg. ESR: 12 mm/hr.',
      ai_summary: 'Your CBC report shows all values within normal range. Hemoglobin is 12.5 g/dL which is healthy. White blood cells and platelets are also normal, indicating no signs of infection or blood disorders.',
      parameters: [
        { name: 'Hemoglobin', value: '12.5', unit: 'g/dL', reference_range: '12-16', status: 'normal' },
        { name: 'WBC', value: '7200', unit: '/cumm', reference_range: '4000-11000', status: 'normal' },
        { name: 'Platelets', value: '2.5', unit: 'lakhs/cumm', reference_range: '1.5-4.0', status: 'normal' },
        { name: 'RBC', value: '4.2', unit: 'million/cumm', reference_range: '3.8-5.5', status: 'normal' },
        { name: 'ESR', value: '12', unit: 'mm/hr', reference_range: '0-20', status: 'normal' },
      ],
      flags: [],
    },
    {
      id: '55555555-5555-5555-5555-555555555552',
      patient_id: patientId,
      title: 'HbA1c & Lipid Profile',
      category: 'blood_test',
      file_url: 'https://placeholder.co/report-hba1c.pdf',
      file_type: 'application/pdf',
      lab_name: 'Thyrocare',
      report_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ocr_text: 'HbA1c & Lipid Profile Report. Patient: Meena Kumari. HbA1c: 7.2% (Target: <7.0%). Total Cholesterol: 210 mg/dL (Desirable: <200). LDL: 135 mg/dL (Optimal: <100). HDL: 48 mg/dL (Good: >50). Triglycerides: 165 mg/dL (Normal: <150). Fasting Blood Sugar: 142 mg/dL (Normal: 70-100).',
      ai_summary: 'Your HbA1c is 7.2% — slightly above the target of 7%. This means your average blood sugar over 3 months needs better control. LDL cholesterol (135) and triglycerides (165) are also elevated. Consider dietary changes: reduce fried foods, increase fiber, and walk daily for 30 minutes.',
      parameters: [
        { name: 'HbA1c', value: '7.2', unit: '%', reference_range: '<7.0', status: 'high' },
        { name: 'Total Cholesterol', value: '210', unit: 'mg/dL', reference_range: '<200', status: 'high' },
        { name: 'LDL', value: '135', unit: 'mg/dL', reference_range: '<100', status: 'high' },
        { name: 'HDL', value: '48', unit: 'mg/dL', reference_range: '>50', status: 'low' },
        { name: 'Triglycerides', value: '165', unit: 'mg/dL', reference_range: '<150', status: 'high' },
        { name: 'Fasting Blood Sugar', value: '142', unit: 'mg/dL', reference_range: '70-100', status: 'high' },
      ],
      flags: ['HbA1c elevated', 'LDL high', 'Triglycerides elevated'],
    },
  ], { onConflict: 'id' })

  if (recordErr) console.error('  ✗ Records error:', recordErr.message)
  else console.log('  ✓ 2 medical records created')

  // 8. Create patient vitals
  console.log('8. Creating patient vitals...')
  const { error: vitalsErr } = await supabase.from('patient_vitals').insert({
    patient_id: patientId,
    appointment_id: '44444444-4444-4444-4444-444444444441',
    bp_systolic: 130,
    bp_diastolic: 85,
    pulse: 78,
    temperature: 98.4,
    weight: 72,
    height: 162,
    spo2: 97,
    recorded_at: new Date().toISOString(),
  })

  if (vitalsErr) console.error('  ✗ Vitals error:', vitalsErr.message)
  else console.log('  ✓ Patient vitals recorded')

  // 9. Create a prescription
  console.log('9. Creating prescription...')
  const { error: rxErr } = await supabase.from('prescriptions').insert({
    appointment_id: '44444444-4444-4444-4444-444444444441',
    patient_id: patientId,
    doctor_id: doctorId,
    diagnosis: 'Type 2 Diabetes Mellitus, Dyslipidemia',
    medicines: [
      { name: 'Metformin 500mg', dosage: '500mg', frequency: 'Twice daily', duration: '30 days', instructions: 'After meals', generic_alternative: null },
      { name: 'Atorvastatin 10mg', dosage: '10mg', frequency: 'Once daily', duration: '30 days', instructions: 'At bedtime', generic_alternative: null },
      { name: 'Vitamin D3 60000 IU', dosage: '60000 IU', frequency: 'Once weekly', duration: '8 weeks', instructions: 'After breakfast on Sundays', generic_alternative: null },
    ],
    follow_up_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: 'Monitor blood sugar daily. Reduce carb intake. Walk 30 min/day. Repeat HbA1c after 3 months.',
  })

  if (rxErr) console.error('  ✗ Prescription error:', rxErr.message)
  else console.log('  ✓ Prescription created')

  // 10. Create a care plan
  console.log('10. Creating care plan...')
  const { error: cpErr } = await supabase.from('care_plans').insert({
    patient_id: patientId,
    appointment_id: '44444444-4444-4444-4444-444444444441',
    doctor_id: doctorId,
    diet_plan: {
      eat_more: ['Green leafy vegetables', 'Whole grains (brown rice, whole wheat roti)', 'Protein (dal, paneer, eggs)', 'Fiber-rich fruits (guava, apple with skin)'],
      reduce: ['White rice', 'Fried foods (samosa, pakora)', 'Sugar and sweets', 'Refined flour (maida)'],
      meal_timing: ['Breakfast before 9 AM', 'Lunch by 1 PM', 'Dinner before 8 PM', 'No snacking after dinner'],
    },
    exercise_plan: {
      weekly_schedule: [
        { day: 'Monday', activity: 'Brisk walking 30 min', time: '6:00 AM' },
        { day: 'Tuesday', activity: 'Yoga + Pranayama', time: '6:00 AM' },
        { day: 'Wednesday', activity: 'Brisk walking 30 min', time: '6:00 AM' },
        { day: 'Thursday', activity: 'Light strength training', time: '6:00 AM' },
        { day: 'Friday', activity: 'Brisk walking 30 min', time: '6:00 AM' },
        { day: 'Saturday', activity: 'Yoga + Meditation', time: '7:00 AM' },
        { day: 'Sunday', activity: 'Rest or light walk', time: '7:00 AM' },
      ],
      goal: 'At least 150 minutes of moderate activity per week',
    },
    hydration: 'Drink at least 8 glasses of water daily. Avoid sugary drinks.',
    sleep_recommendation: 'Aim for 7-8 hours. No screen time 1 hour before bed.',
    valid_from: today,
    valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  })

  if (cpErr) console.error('  ✗ Care plan error:', cpErr.message)
  else console.log('  ✓ Care plan created')

  console.log('\n✅ Seeding complete!')
  console.log('\n📋 Test Accounts:')
  console.log('  Patient: Phone 9000000001, OTP 111111 → /home')
  console.log('  Doctor:  Phone 9000000002, OTP 111111 → /queue')
  console.log('  Admin:   Phone 9000000003, OTP 111111 → /dashboard')
  console.log('  Super:   Phone 9000000000, OTP 111111 → /dashboard')
}

seed().catch(console.error)
