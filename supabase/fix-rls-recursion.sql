-- ============================================================================
-- HealthBridge Schema Fixes (run in Supabase SQL Editor)
-- ============================================================================
-- 1. Fix RLS infinite recursion (SECURITY DEFINER)
-- 2. Make patients.user_id nullable (clinic-created patients)
-- 3. Add unique indexes for patient claim flow
-- 4. Add doctor registration number uniqueness
-- 5. Add vector indexes for RAG performance
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fix RLS recursion: helper functions must bypass RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM user_roles WHERE user_id = uid;
$$;

CREATE OR REPLACE FUNCTION get_user_clinic(uid UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT clinic_id FROM user_roles WHERE user_id = uid;
$$;

CREATE OR REPLACE FUNCTION get_patient_id(uid UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM patients WHERE user_id = uid AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION get_doctor_id(uid UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM doctors WHERE user_id = uid AND deleted_at IS NULL;
$$;

-- ---------------------------------------------------------------------------
-- 2. Make patients.user_id nullable + add clinic_id for "created by clinic"
-- ---------------------------------------------------------------------------
ALTER TABLE patients ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id);

-- ---------------------------------------------------------------------------
-- 3. Unique indexes for patient identity (phone/email are claim keys)
-- ---------------------------------------------------------------------------
-- Drop old constraints if they exist (idempotent)
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_user_id_key;
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_phone_key;

-- Partial unique indexes: only enforce on non-deleted records
CREATE UNIQUE INDEX IF NOT EXISTS patients_phone_unique
  ON patients(phone) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS patients_email_unique
  ON patients(email) WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS patients_user_id_unique
  ON patients(user_id) WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Doctor registration number uniqueness
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS doctors_registration_unique
  ON doctors(registration_number)
  WHERE registration_number <> '' AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Vector indexes for RAG similarity search performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS medical_records_embedding_idx
  ON medical_records USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS journal_embedding_idx
  ON health_journal_entries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- 6. Update RLS policies for clinic-created patients
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "patients_insert" ON patients;
CREATE POLICY "patients_insert" ON patients FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR (user_id IS NULL AND get_user_role(auth.uid()) IN ('admin', 'doctor'))
);

DROP POLICY IF EXISTS "patients_update" ON patients;
CREATE POLICY "patients_update" ON patients FOR UPDATE USING (
  user_id = auth.uid()
  OR (get_user_role(auth.uid()) = 'admin' AND clinic_id = get_user_clinic(auth.uid()))
);

DROP POLICY IF EXISTS "patients_select" ON patients;
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
