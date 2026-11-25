-- Chat sessions persistence
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  title TEXT DEFAULT 'New Chat',
  context_type TEXT NOT NULL DEFAULT 'general', -- general, journal, reports
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_chat_sessions_patient ON chat_sessions(patient_id, updated_at DESC) WHERE deleted_at IS NULL;

-- Custom vitals configuration per patient
CREATE TABLE IF NOT EXISTS patient_vital_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  unit TEXT,
  icon TEXT, -- emoji or icon name
  sort_order INT NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(patient_id, category)
);

CREATE INDEX idx_vital_configs_patient ON patient_vital_configs(patient_id, sort_order) WHERE deleted_at IS NULL;

-- AI health insights cache
CREATE TABLE IF NOT EXISTS ai_health_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  insight_text TEXT NOT NULL,
  data_summary JSONB, -- snapshot of data used to generate
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(patient_id)
);

-- Add payment fields to appointments if not exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='payment_reminder_sent') THEN
    ALTER TABLE appointments ADD COLUMN payment_reminder_sent BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='reminder_sent_at') THEN
    ALTER TABLE appointments ADD COLUMN reminder_sent_at TIMESTAMPTZ;
  END IF;
END $$;

-- RLS for chat_sessions
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can manage own chats" ON chat_sessions
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- RLS for patient_vital_configs
ALTER TABLE patient_vital_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can manage own vital configs" ON patient_vital_configs
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- RLS for ai_health_insights
ALTER TABLE ai_health_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own insights" ON ai_health_insights
  FOR ALL USING (
    patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  );

-- Function to match journal entries by embedding similarity
CREATE OR REPLACE FUNCTION match_journal_entries(
  query_embedding vector(1024),
  match_patient_id UUID,
  match_threshold FLOAT DEFAULT 0.4,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  value TEXT,
  unit TEXT,
  context TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    hje.id,
    hje.category,
    hje.value,
    hje.unit,
    hje.context,
    hje.notes,
    hje.recorded_at,
    1 - (hje.embedding <=> query_embedding) AS similarity
  FROM health_journal_entries hje
  WHERE hje.patient_id = match_patient_id
    AND hje.deleted_at IS NULL
    AND hje.embedding IS NOT NULL
    AND 1 - (hje.embedding <=> query_embedding) > match_threshold
  ORDER BY hje.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to match medical records by embedding similarity
CREATE OR REPLACE FUNCTION match_medical_records(
  query_embedding vector(1024),
  match_patient_id UUID,
  match_threshold FLOAT DEFAULT 0.4,
  match_count INT DEFAULT 7
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  category TEXT,
  ai_summary TEXT,
  ocr_text TEXT,
  report_date DATE,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mr.id,
    mr.title,
    mr.category,
    mr.ai_summary,
    mr.ocr_text,
    mr.report_date,
    1 - (mr.embedding <=> query_embedding) AS similarity
  FROM medical_records mr
  WHERE mr.patient_id = match_patient_id
    AND mr.deleted_at IS NULL
    AND mr.embedding IS NOT NULL
    AND 1 - (mr.embedding <=> query_embedding) > match_threshold
  ORDER BY mr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
