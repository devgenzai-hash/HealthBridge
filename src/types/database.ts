/**
 * Database type definitions for Supabase.
 * Generated from the schema — update when schema changes.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'patient' | 'doctor' | 'admin'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'waiting' | 'in_consultation' | 'done' | 'no_show' | 'cancelled'
export type VisitType = 'scheduled' | 'walkin' | 'followup' | 'emergency'
export type PaymentStatus = 'pending' | 'uploaded' | 'verified' | 'rejected'
export type ReportCategory = 'blood_test' | 'urine_test' | 'imaging' | 'pathology' | 'other'
export type JournalCategory = 'blood_sugar' | 'bp' | 'weight' | 'steps' | 'sleep' | 'water' | 'mood' | 'symptom'
export type ParameterStatus = 'normal' | 'borderline' | 'abnormal'

export interface Database {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string
          name: string
          address: string
          phone: string
          email: string | null
          logo_url: string | null
          departments: string[]
          settings: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['clinics']['Row'], 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
        Update: Partial<Database['public']['Tables']['clinics']['Insert']>
      }
      doctors: {
        Row: {
          id: string
          user_id: string
          clinic_id: string
          name: string
          phone: string
          email: string | null
          specialization: string
          qualification: string
          registration_number: string
          avatar_url: string | null
          availability: Json
          consultation_fee: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['doctors']['Row'], 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
        Update: Partial<Database['public']['Tables']['doctors']['Insert']>
      }
      patients: {
        Row: {
          id: string
          user_id: string
          name: string
          phone: string
          email: string | null
          date_of_birth: string | null
          gender: string | null
          blood_group: string | null
          address: string | null
          emergency_contact: string | null
          language_pref: string
          avatar_url: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['patients']['Row'], 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
        Update: Partial<Database['public']['Tables']['patients']['Insert']>
      }
      appointments: {
        Row: {
          id: string
          patient_id: string
          doctor_id: string
          clinic_id: string
          scheduled_at: string | null
          queue_date: string
          queue_position: number | null
          status: AppointmentStatus
          visit_type: VisitType
          consultation_fee: number
          payment_status: PaymentStatus
          payment_screenshot_url: string | null
          notes: string | null
          diagnosis: string | null
          follow_up_date: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['appointments']['Row'], 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>
      }
      medical_records: {
        Row: {
          id: string
          patient_id: string
          appointment_id: string | null
          title: string
          category: ReportCategory
          file_url: string
          file_type: string
          ocr_text: string | null
          ai_summary: string | null
          parameters: Json | null
          flags: string[] | null
          lab_name: string | null
          report_date: string | null
          embedding: number[] | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['medical_records']['Row'], 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
        Update: Partial<Database['public']['Tables']['medical_records']['Insert']>
      }
      health_journal_entries: {
        Row: {
          id: string
          patient_id: string
          category: JournalCategory
          value: string
          unit: string | null
          context: string | null
          notes: string | null
          recorded_at: string
          embedding: number[] | null
          created_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['health_journal_entries']['Row'], 'id' | 'created_at' | 'deleted_at'>
        Update: Partial<Database['public']['Tables']['health_journal_entries']['Insert']>
      }
      prescriptions: {
        Row: {
          id: string
          appointment_id: string
          patient_id: string
          doctor_id: string
          diagnosis: string
          medicines: Json
          follow_up_date: string | null
          notes: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['prescriptions']['Row'], 'id' | 'created_at' | 'deleted_at'>
        Update: Partial<Database['public']['Tables']['prescriptions']['Insert']>
      }
      patient_vitals: {
        Row: {
          id: string
          patient_id: string
          appointment_id: string | null
          bp_systolic: number | null
          bp_diastolic: number | null
          pulse: number | null
          temperature: number | null
          weight: number | null
          height: number | null
          spo2: number | null
          respiratory_rate: number | null
          recorded_at: string
          created_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['patient_vitals']['Row'], 'id' | 'created_at' | 'deleted_at'>
        Update: Partial<Database['public']['Tables']['patient_vitals']['Insert']>
      }
      care_plans: {
        Row: {
          id: string
          patient_id: string
          appointment_id: string | null
          doctor_id: string | null
          diet_plan: Json
          exercise_plan: Json
          hydration: string | null
          sleep_recommendation: string | null
          valid_from: string
          valid_until: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['care_plans']['Row'], 'id' | 'created_at' | 'deleted_at'>
        Update: Partial<Database['public']['Tables']['care_plans']['Insert']>
      }
      shared_links: {
        Row: {
          id: string
          token: string
          patient_id: string
          record_id: string | null
          record_type: string
          expires_at: string
          accessed_count: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['shared_links']['Row'], 'id' | 'created_at' | 'accessed_count'>
        Update: Partial<Database['public']['Tables']['shared_links']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string
          record_id: string
          record_type: string
          action: string
          metadata: Json | null
          accessed_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'accessed_at'>
        Update: never
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: UserRole
          clinic_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_roles']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>
      }
    }
    Functions: {
      match_medical_records: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
          patient_id_filter: string
        }
        Returns: Array<{
          id: string
          title: string
          ai_summary: string
          ocr_text: string
          similarity: number
        }>
      }
      match_journal_entries: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
          patient_id_filter: string
        }
        Returns: Array<{
          id: string
          category: string
          value: string
          notes: string
          recorded_at: string
          similarity: number
        }>
      }
    }
  }
}
