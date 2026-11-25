import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Pool } = pg;

const url = 'https://uajlbqcyxaobnyaykvpx.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamxicWN5eGFvYm55YXlrdnB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkxNzYzNywiZXhwIjoyMDg3NDkzNjM3fQ.EkyVMgRcfk_IryapTRxd9lIWeWyow1lvXhkAWzxOmeM';

const s = createClient(url, key);

async function run() {
  // Create tables via individual SQL statements using fetch
  const statements = [
    `CREATE TABLE IF NOT EXISTS chat_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      patient_id UUID NOT NULL REFERENCES patients(id),
      title TEXT DEFAULT 'New Chat',
      context_type TEXT NOT NULL DEFAULT 'general',
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chat_sessions_patient ON chat_sessions(patient_id, updated_at DESC) WHERE deleted_at IS NULL`,
    `CREATE TABLE IF NOT EXISTS patient_vital_configs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      patient_id UUID NOT NULL REFERENCES patients(id),
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      unit TEXT,
      icon TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      UNIQUE(patient_id, category)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_vital_configs_patient ON patient_vital_configs(patient_id, sort_order) WHERE deleted_at IS NULL`,
    `CREATE TABLE IF NOT EXISTS ai_health_insights (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      patient_id UUID NOT NULL REFERENCES patients(id),
      insight_text TEXT NOT NULL,
      data_summary JSONB,
      generated_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ,
      UNIQUE(patient_id)
    )`,
  ];

  for (const sql of statements) {
    const res = await fetch(`${url}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'exec_sql', params: { sql_text: sql } }),
    });
    // Try direct SQL endpoint
    if (res.status === 404) {
      break;
    }
  }

  // Use the pg package directly
  try {
    const pool = new Pool({
      host: 'aws-0-ap-south-1.pooler.supabase.com',
      port: 6543,
      database: 'postgres',
      user: 'postgres.uajlbqcyxaobnyaykvpx',
      password: process.env.SUPABASE_DB_PASSWORD || 'healthbridge2024!',
      ssl: { rejectUnauthorized: false },
    });

    for (const sql of statements) {
      try {
        await pool.query(sql);
        console.log('✓', sql.substring(0, 50) + '...');
      } catch (e) {
        console.log('✗', sql.substring(0, 50) + '...', e.message);
      }
    }

    // Also create RPC functions
    await pool.query(`
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
      LANGUAGE plpgsql AS $$
      BEGIN
        RETURN QUERY
        SELECT
          hje.id, hje.category, hje.value, hje.unit, hje.context, hje.notes, hje.recorded_at,
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
    `);
    console.log('✓ match_journal_entries function created');

    await pool.query(`
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
      LANGUAGE plpgsql AS $$
      BEGIN
        RETURN QUERY
        SELECT
          mr.id, mr.title, mr.category, mr.ai_summary, mr.ocr_text, mr.report_date,
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
    `);
    console.log('✓ match_medical_records function created');

    await pool.end();
    console.log('\n✅ Migration complete!');
  } catch (e) {
    console.error('DB connection error:', e.message);
    console.log('\nPlease run the SQL in supabase/migrations/001_chat_and_embeddings.sql manually via the Supabase SQL editor.');
  }
}

run();
