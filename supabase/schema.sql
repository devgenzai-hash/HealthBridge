-- ============================================================================
-- HealthBridge Database Schema
-- Run this in Supabase SQL Editor (in order)
-- Region: ap-south-1 (Mumbai) for DPDP Act compliance
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CLINICS
-- ============================================================================
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  logo_url TEXT,
  departments TEXT[] DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- DOCTORS
-- ============================================================================
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  specialization TEXT NOT NULL DEFAULT 'General',
  qualification TEXT NOT NULL DEFAULT '',
  registration_number TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  availability JSONB DEFAULT '{}',
  consultation_fee INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

CREATE UNIQUE INDEX doctors_registration_unique
  ON doctors(registration_number)
  WHERE registration_number <> '' AND deleted_at IS NULL;

-- ============================================================================
-- PATIENTS
-- ============================================================================
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),  -- nullable: clinic can create patients without auth account
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  blood_group TEXT,
  address TEXT,
  emergency_contact TEXT,
  language_pref TEXT NOT NULL DEFAULT 'en',
  avatar_url TEXT,
  clinic_id UUID REFERENCES clinics(id),   -- which clinic created this patient (NULL = self-registered)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Unique identifiers: phone is always unique; email unique when provided; user_id unique when linked
CREATE UNIQUE INDEX patients_phone_unique ON patients(phone) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX patients_email_unique ON patients(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX patients_user_id_unique ON patients(user_id) WHERE user_id IS NOT NULL;

-- ============================================================================
-- APPOINTMENTS (Doctor Queue)
-- ============================================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  scheduled_at TIMESTAMPTZ,
  queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  queue_position INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'waiting', 'in_consultation', 'done', 'no_show', 'cancelled')),
  visit_type TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (visit_type IN ('scheduled', 'walkin', 'followup', 'emergency')),
  consultation_fee INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'uploaded', 'verified', 'rejected')),
  payment_screenshot_url TEXT,
  notes TEXT,
  diagnosis TEXT,
  follow_up_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_appointments_doctor_queue ON appointments(doctor_id, queue_date, queue_position)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_patient ON appointments(patient_id, queue_date DESC)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- MEDICAL RECORDS
-- ============================================================================
CREATE TABLE medical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('blood_test', 'urine_test', 'imaging', 'pathology', 'other')),
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  ocr_text TEXT,
  ai_summary TEXT,
  parameters JSONB,
  flags TEXT[],
  lab_name TEXT,
  report_date DATE,
  embedding vector(1024), -- NV-Embed-QA (1024); change if switching to text-embedding-3-large (3072)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_medical_records_patient ON medical_records(patient_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Vector index for RAG similarity search
CREATE INDEX medical_records_embedding_idx
  ON medical_records USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- HEALTH JOURNAL ENTRIES
-- ============================================================================
CREATE TABLE health_journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  category TEXT NOT NULL
    CHECK (category IN ('blood_sugar', 'bp', 'weight', 'steps', 'sleep', 'water', 'mood', 'symptom')),
  value TEXT NOT NULL,
  unit TEXT,
  context TEXT, -- e.g., "fasting", "post-meal", "morning"
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  embedding vector(1024),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_journal_patient_category ON health_journal_entries(patient_id, category, recorded_at DESC)
  WHERE deleted_at IS NULL;

-- Vector index for RAG similarity search
CREATE INDEX journal_embedding_idx
  ON health_journal_entries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- PRESCRIPTIONS
-- ============================================================================
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  diagnosis TEXT NOT NULL,
  medicines JSONB NOT NULL DEFAULT '[]',
  -- medicines: [{name, dosage, frequency, duration, instructions, generic_alternative}]
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- PATIENT VITALS
-- ============================================================================
CREATE TABLE patient_vitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  pulse INTEGER,
  temperature NUMERIC(4,1),
  weight NUMERIC(5,1),
  height NUMERIC(5,1),
  spo2 INTEGER,
  respiratory_rate INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- CARE PLANS
-- ============================================================================
CREATE TABLE care_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  doctor_id UUID REFERENCES doctors(id),
  diet_plan JSONB NOT NULL DEFAULT '{}',
  exercise_plan JSONB NOT NULL DEFAULT '{}',
  hydration TEXT,
  sleep_recommendation TEXT,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- SHARED LINKS (secure record sharing)
-- ============================================================================
CREATE TABLE shared_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  patient_id UUID NOT NULL REFERENCES patients(id),
  record_id UUID, -- nullable: can share multiple records
  record_type TEXT NOT NULL DEFAULT 'medical_record',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  accessed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shared_links_token ON shared_links(token) WHERE expires_at > NOW();

-- ============================================================================
-- AUDIT LOGS (immutable — no updates/deletes)
-- ============================================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  record_id UUID NOT NULL,
  record_type TEXT NOT NULL,
  action TEXT NOT NULL, -- 'view', 'download', 'share', 'update', 'delete'
  metadata JSONB,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_record ON audit_logs(record_id, accessed_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, accessed_at DESC);

-- ============================================================================
-- USER ROLES (maps auth.users to roles)
-- ============================================================================
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
  clinic_id UUID REFERENCES clinics(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- VECTOR SIMILARITY SEARCH FUNCTIONS
-- ============================================================================

-- Search medical records by embedding similarity
CREATE OR REPLACE FUNCTION match_medical_records(
  query_embedding vector(1024),
  match_threshold FLOAT,
  match_count INT,
  patient_id_filter UUID
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  ai_summary TEXT,
  ocr_text TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mr.id,
    mr.title,
    mr.ai_summary,
    mr.ocr_text,
    1 - (mr.embedding <=> query_embedding) AS similarity
  FROM medical_records mr
  WHERE mr.patient_id = patient_id_filter
    AND mr.deleted_at IS NULL
    AND mr.embedding IS NOT NULL
    AND 1 - (mr.embedding <=> query_embedding) > match_threshold
  ORDER BY mr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Search journal entries by embedding similarity
CREATE OR REPLACE FUNCTION match_journal_entries(
  query_embedding vector(1024),
  match_threshold FLOAT,
  match_count INT,
  patient_id_filter UUID
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  value TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    je.id,
    je.category,
    je.value,
    je.notes,
    je.recorded_at,
    1 - (je.embedding <=> query_embedding) AS similarity
  FROM health_journal_entries je
  WHERE je.patient_id = patient_id_filter
    AND je.deleted_at IS NULL
    AND je.embedding IS NOT NULL
    AND 1 - (je.embedding <=> query_embedding) > match_threshold
  ORDER BY je.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function: get user role
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM user_roles WHERE user_id = uid;
$$;

-- Helper: get user's clinic_id
CREATE OR REPLACE FUNCTION get_user_clinic(uid UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT clinic_id FROM user_roles WHERE user_id = uid;
$$;

-- Helper: get patient_id from user_id
CREATE OR REPLACE FUNCTION get_patient_id(uid UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM patients WHERE user_id = uid AND deleted_at IS NULL;
$$;

-- Helper: get doctor_id from user_id
CREATE OR REPLACE FUNCTION get_doctor_id(uid UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM doctors WHERE user_id = uid AND deleted_at IS NULL;
$$;

-- PATIENTS: can see own record; doctors/admins can see patients in their clinic
CREATE POLICY "patients_select" ON patients FOR SELECT USING (
  user_id = auth.uid()
  OR (get_user_role(auth.uid()) = 'doctor' AND id IN (
    SELECT DISTINCT a.patient_id FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    WHERE d.user_id = auth.uid() AND a.deleted_at IS NULL
  ))
  OR (get_user_role(auth.uid()) = 'admin' AND (
    clinic_id = get_user_clinic(auth.uid())
    OR EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = patients.id AND a.clinic_id = get_user_clinic(auth.uid()))
  ))
);

CREATE POLICY "patients_insert" ON patients FOR INSERT WITH CHECK (
  -- Self-registration (user_id = self) or clinic staff creating patient (admin/doctor)
  user_id = auth.uid()
  OR (user_id IS NULL AND get_user_role(auth.uid()) IN ('admin', 'doctor'))
);

CREATE POLICY "patients_update" ON patients FOR UPDATE USING (
  user_id = auth.uid()
  OR (get_user_role(auth.uid()) = 'admin' AND clinic_id = get_user_clinic(auth.uid()))
);

-- DOCTORS: visible to patients who have appointments, admins of same clinic
CREATE POLICY "doctors_select" ON doctors FOR SELECT USING (
  user_id = auth.uid()
  OR clinic_id = get_user_clinic(auth.uid())
  OR get_user_role(auth.uid()) = 'patient' -- patients can browse doctors
);

-- APPOINTMENTS: patient sees own; doctor sees own queue; admin sees clinic's
CREATE POLICY "appointments_select" ON appointments FOR SELECT USING (
  patient_id = get_patient_id(auth.uid())
  OR doctor_id = get_doctor_id(auth.uid())
  OR (get_user_role(auth.uid()) = 'admin' AND clinic_id = get_user_clinic(auth.uid()))
);

CREATE POLICY "appointments_insert" ON appointments FOR INSERT WITH CHECK (
  patient_id = get_patient_id(auth.uid())
  OR doctor_id = get_doctor_id(auth.uid())
  OR (get_user_role(auth.uid()) = 'admin' AND clinic_id = get_user_clinic(auth.uid()))
);

CREATE POLICY "appointments_update" ON appointments FOR UPDATE USING (
  patient_id = get_patient_id(auth.uid())
  OR doctor_id = get_doctor_id(auth.uid())
  OR (get_user_role(auth.uid()) = 'admin' AND clinic_id = get_user_clinic(auth.uid()))
);

-- MEDICAL RECORDS: patient owns; treating doctor can view
CREATE POLICY "records_select" ON medical_records FOR SELECT USING (
  patient_id = get_patient_id(auth.uid())
  OR (get_user_role(auth.uid()) = 'doctor' AND patient_id IN (
    SELECT a.patient_id FROM appointments a WHERE a.doctor_id = get_doctor_id(auth.uid()) AND a.deleted_at IS NULL
  ))
  OR (get_user_role(auth.uid()) = 'admin' AND patient_id IN (
    SELECT a.patient_id FROM appointments a WHERE a.clinic_id = get_user_clinic(auth.uid())
  ))
);

CREATE POLICY "records_insert" ON medical_records FOR INSERT WITH CHECK (
  patient_id = get_patient_id(auth.uid())
);

CREATE POLICY "records_update" ON medical_records FOR UPDATE USING (
  patient_id = get_patient_id(auth.uid())
);

-- HEALTH JOURNAL: patient-only
CREATE POLICY "journal_select" ON health_journal_entries FOR SELECT USING (
  patient_id = get_patient_id(auth.uid())
  OR (get_user_role(auth.uid()) = 'doctor' AND patient_id IN (
    SELECT a.patient_id FROM appointments a WHERE a.doctor_id = get_doctor_id(auth.uid()) AND a.deleted_at IS NULL
  ))
);

CREATE POLICY "journal_insert" ON health_journal_entries FOR INSERT WITH CHECK (
  patient_id = get_patient_id(auth.uid())
);

-- PRESCRIPTIONS: patient can view own; doctor who wrote it; admin of clinic
CREATE POLICY "prescriptions_select" ON prescriptions FOR SELECT USING (
  patient_id = get_patient_id(auth.uid())
  OR doctor_id = get_doctor_id(auth.uid())
);

CREATE POLICY "prescriptions_insert" ON prescriptions FOR INSERT WITH CHECK (
  doctor_id = get_doctor_id(auth.uid())
);

-- VITALS: patient can view; doctor can insert/view for their patients
CREATE POLICY "vitals_select" ON patient_vitals FOR SELECT USING (
  patient_id = get_patient_id(auth.uid())
  OR (get_user_role(auth.uid()) = 'doctor' AND patient_id IN (
    SELECT a.patient_id FROM appointments a WHERE a.doctor_id = get_doctor_id(auth.uid())
  ))
);

CREATE POLICY "vitals_insert" ON patient_vitals FOR INSERT WITH CHECK (
  patient_id = get_patient_id(auth.uid())
  OR get_user_role(auth.uid()) = 'doctor'
);

-- CARE PLANS
CREATE POLICY "care_plans_select" ON care_plans FOR SELECT USING (
  patient_id = get_patient_id(auth.uid())
  OR doctor_id = get_doctor_id(auth.uid())
);

CREATE POLICY "care_plans_insert" ON care_plans FOR INSERT WITH CHECK (
  doctor_id = get_doctor_id(auth.uid())
  OR patient_id = get_patient_id(auth.uid())
);

-- SHARED LINKS: patient owns
CREATE POLICY "shared_links_select" ON shared_links FOR SELECT USING (
  patient_id = get_patient_id(auth.uid())
);

CREATE POLICY "shared_links_insert" ON shared_links FOR INSERT WITH CHECK (
  patient_id = get_patient_id(auth.uid())
);

-- AUDIT LOGS: admins of same clinic can view; users can see own
CREATE POLICY "audit_select" ON audit_logs FOR SELECT USING (
  user_id = auth.uid()
  OR get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (true);

-- USER ROLES: users can see own role
CREATE POLICY "roles_select" ON user_roles FOR SELECT USING (
  user_id = auth.uid()
  OR get_user_role(auth.uid()) = 'admin'
);

-- CLINICS: visible to members
CREATE POLICY "clinics_select" ON clinics FOR SELECT USING (
  id = get_user_clinic(auth.uid())
  OR get_user_role(auth.uid()) = 'patient' -- patients can browse clinics
);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clinics_updated_at BEFORE UPDATE ON clinics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER doctors_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER medical_records_updated_at BEFORE UPDATE ON medical_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================
-- Run in Supabase Dashboard > Storage > Create bucket:
-- Bucket name: medical-files
-- Public: No
-- Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf
-- Max file size: 10MB
