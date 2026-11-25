import { createClient } from '@supabase/supabase-js'

const s = createClient(
  'https://uajlbqcyxaobnyaykvpx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamxicWN5eGFvYm55YXlrdnB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkxNzYzNywiZXhwIjoyMDg3NDkzNjM3fQ.EkyVMgRcfk_IryapTRxd9lIWeWyow1lvXhkAWzxOmeM',
  { auth: { persistSession: false } }
)

// Fix patient record to use the correct user_id (919000000001 format)
const r1 = await s.from('patients').update({ user_id: '73b0320e-769b-49b3-b431-5c0f775708a5' }).eq('id', '33333333-3333-3333-3333-333333333333')
console.log('patient update:', r1.error ? r1.error.message : 'success')

// Verify
const r2 = await s.from('patients').select('id, user_id, name').eq('id', '33333333-3333-3333-3333-333333333333')
console.log('patient now:', JSON.stringify(r2.data))

// Also update user_roles for the patient to include clinic_id
const r3 = await s.from('user_roles').update({ clinic_id: '11111111-1111-1111-1111-111111111111' }).eq('user_id', '73b0320e-769b-49b3-b431-5c0f775708a5')
console.log('patient role update:', r3.error ? r3.error.message : 'success')

console.log('Done!')
