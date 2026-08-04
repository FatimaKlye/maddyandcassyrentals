export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          created_by: string | null
          firebase_uid: string | null
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          firebase_uid?: string | null
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          firebase_uid?: string | null
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agreement_acknowledgements: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledgement_key: string
          agreement_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledgement_key: string
          agreement_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledgement_key?: string
          agreement_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_acknowledgements_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "booking_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_signatures: {
        Row: {
          agreement_id: string
          firebase_id: string | null
          id: string
          ip_address: unknown
          signature_data: Json
          signature_path: string | null
          signed_at: string
          signer_name: string
          signer_role: string
          signer_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          agreement_id: string
          firebase_id?: string | null
          id?: string
          ip_address?: unknown
          signature_data?: Json
          signature_path?: string | null
          signed_at?: string
          signer_name: string
          signer_role: string
          signer_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          agreement_id?: string
          firebase_id?: string | null
          id?: string
          ip_address?: unknown
          signature_data?: Json
          signature_path?: string | null
          signed_at?: string
          signer_name?: string
          signer_role?: string
          signer_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_signatures_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "booking_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          booking_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json
          new_values: Json | null
          previous_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_type?: string
          actor_user_id?: string | null
          booking_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_values?: Json | null
          previous_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          booking_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_values?: Json | null
          previous_values?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_calendar_entries: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          firebase_id: string | null
          id: string
          inventory_unit_id: string | null
          product_id: string
          public_note: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          firebase_id?: string | null
          id?: string
          inventory_unit_id?: string | null
          product_id: string
          public_note?: string | null
          start_date: string
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          firebase_id?: string | null
          id?: string
          inventory_unit_id?: string | null
          product_id?: string
          public_note?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_calendar_entries_inventory_unit_id_fkey"
            columns: ["inventory_unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_calendar_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_agreement_versions: {
        Row: {
          agreement_id: string
          agreement_snapshot: Json
          agreement_version: string | null
          archived_at: string
          archived_reason: string | null
          booking_id: string
          completed_at: string | null
          final_document_path: string | null
          generated_at: string | null
          generated_document_path: string | null
          id: string
          status: string
          version_number: number
        }
        Insert: {
          agreement_id: string
          agreement_snapshot?: Json
          agreement_version?: string | null
          archived_at?: string
          archived_reason?: string | null
          booking_id: string
          completed_at?: string | null
          final_document_path?: string | null
          generated_at?: string | null
          generated_document_path?: string | null
          id?: string
          status: string
          version_number: number
        }
        Update: {
          agreement_id?: string
          agreement_snapshot?: Json
          agreement_version?: string | null
          archived_at?: string
          archived_reason?: string | null
          booking_id?: string
          completed_at?: string | null
          final_document_path?: string | null
          generated_at?: string | null
          generated_document_path?: string | null
          id?: string
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_agreement_versions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "booking_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_agreement_versions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_agreements: {
        Row: {
          agreement_snapshot: Json
          agreement_version: string | null
          booking_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          final_document_path: string | null
          firebase_id: string | null
          generated_at: string | null
          generated_document_path: string | null
          id: string
          status: string
          updated_at: string
          updated_by: string | null
          version_number: number
        }
        Insert: {
          agreement_snapshot?: Json
          agreement_version?: string | null
          booking_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          final_document_path?: string | null
          firebase_id?: string | null
          generated_at?: string | null
          generated_document_path?: string | null
          id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_number?: number
        }
        Update: {
          agreement_snapshot?: Json
          agreement_version?: string | null
          booking_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          final_document_path?: string | null
          firebase_id?: string | null
          generated_at?: string | null
          generated_document_path?: string | null
          id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_agreements_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_documents: {
        Row: {
          booking_id: string
          created_at: string
          document_type: string
          file_size_bytes: number | null
          firebase_id: string | null
          id: string
          mime_type: string | null
          original_filename: string | null
          requirement_key: string | null
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          storage_bucket: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          document_type: string
          file_size_bytes?: number | null
          firebase_id?: string | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          requirement_key?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_bucket: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          document_type?: string
          file_size_bytes?: number | null
          firebase_id?: string | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          requirement_key?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_emergency_contacts: {
        Row: {
          address: string | null
          booking_id: string
          created_at: string
          full_name: string
          id: string
          phone_number: string
          relationship: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          booking_id: string
          created_at?: string
          full_name: string
          id?: string
          phone_number: string
          relationship: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          booking_id?: string
          created_at?: string
          full_name?: string
          id?: string
          phone_number?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_emergency_contacts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_invoices: {
        Row: {
          amount_paid: number
          balance_due: number
          booking_id: string
          created_at: string
          created_by: string | null
          currency_code: string
          delivery_fee: number
          deposit_amount: number
          discount_amount: number
          document_path: string | null
          due_at: string | null
          firebase_id: string | null
          id: string
          invoice_number: string | null
          issued_at: string | null
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          delivery_fee?: number
          deposit_amount?: number
          discount_amount?: number
          document_path?: string | null
          due_at?: string | null
          firebase_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          delivery_fee?: number
          deposit_amount?: number
          discount_amount?: number
          document_path?: string | null
          due_at?: string | null
          firebase_id?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_receipts: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          document_path: string | null
          firebase_id: string | null
          id: string
          is_reissue: boolean
          issued_at: string
          issued_by: string | null
          payment_record_id: string | null
          receipt_number: string | null
          reissue_reason: string | null
          reissued_from_id: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          document_path?: string | null
          firebase_id?: string | null
          id?: string
          is_reissue?: boolean
          issued_at?: string
          issued_by?: string | null
          payment_record_id?: string | null
          receipt_number?: string | null
          reissue_reason?: string | null
          reissued_from_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          document_path?: string | null
          firebase_id?: string | null
          id?: string
          is_reissue?: boolean
          issued_at?: string
          issued_by?: string | null
          payment_record_id?: string | null
          receipt_number?: string | null
          reissue_reason?: string | null
          reissued_from_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_receipts_payment_record_id_fkey"
            columns: ["payment_record_id"]
            isOneToOne: false
            referencedRelation: "payment_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_receipts_reissued_from_id_fkey"
            columns: ["reissued_from_id"]
            isOneToOne: false
            referencedRelation: "booking_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          booking_id: string
          changed_by: string | null
          created_at: string
          firebase_id: string | null
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          created_at?: string
          firebase_id?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          created_at?: string
          firebase_id?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          admin_notes: string | null
          agreement_status: string
          approved_at: string | null
          booking_reference: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_notes: string | null
          customer_snapshot: Json
          daily_rate: number
          delivery_fee: number
          firebase_id: string | null
          fulfillment_method: string
          id: string
          inventory_unit_id: string | null
          location: string | null
          product_id: string
          product_snapshot: Json
          refundable_deposit: number
          released_at: string | null
          rental_days: number | null
          rental_end_date: string
          rental_start_date: string
          rental_subtotal: number
          requirements_status: string
          returned_at: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          agreement_status?: string
          approved_at?: string | null
          booking_reference?: string
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_notes?: string | null
          customer_snapshot?: Json
          daily_rate: number
          delivery_fee?: number
          firebase_id?: string | null
          fulfillment_method: string
          id?: string
          inventory_unit_id?: string | null
          location?: string | null
          product_id: string
          product_snapshot?: Json
          refundable_deposit?: number
          released_at?: string | null
          rental_days?: number | null
          rental_end_date: string
          rental_start_date: string
          rental_subtotal: number
          requirements_status?: string
          returned_at?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          agreement_status?: string
          approved_at?: string | null
          booking_reference?: string
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_notes?: string | null
          customer_snapshot?: Json
          daily_rate?: number
          delivery_fee?: number
          firebase_id?: string | null
          fulfillment_method?: string
          id?: string
          inventory_unit_id?: string | null
          location?: string | null
          product_id?: string
          product_snapshot?: Json
          refundable_deposit?: number
          released_at?: string | null
          rental_days?: number | null
          rental_end_date?: string
          rental_start_date?: string
          rental_subtotal?: number
          requirements_status?: string
          returned_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_inventory_product_fk"
            columns: ["inventory_unit_id", "product_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id", "product_id"]
          },
          {
            foreignKeyName: "bookings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_challenges: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          last_sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          last_sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          last_sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_units: {
        Row: {
          acquired_at: string | null
          condition_notes: string | null
          created_at: string
          firebase_id: string | null
          id: string
          product_id: string
          serial_number: string | null
          status: string
          unit_code: string
          updated_at: string
        }
        Insert: {
          acquired_at?: string | null
          condition_notes?: string | null
          created_at?: string
          firebase_id?: string | null
          id?: string
          product_id: string
          serial_number?: string | null
          status?: string
          unit_code: string
          updated_at?: string
        }
        Update: {
          acquired_at?: string | null
          condition_notes?: string | null
          created_at?: string
          firebase_id?: string | null
          id?: string
          product_id?: string
          serial_number?: string | null
          status?: string
          unit_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total: number
          quantity?: number
          sort_order?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "booking_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          booking_id: string | null
          created_at: string
          expires_at: string | null
          firebase_id: string | null
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          booking_id?: string | null
          created_at?: string
          expires_at?: string | null
          firebase_id?: string | null
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          booking_id?: string | null
          created_at?: string
          expires_at?: string | null
          firebase_id?: string | null
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_event_logs: {
        Row: {
          actor_user_id: string | null
          created_at: string
          details: Json
          event_type: string
          firebase_id: string | null
          from_status: string | null
          id: string
          is_manual_correction: boolean
          payment_record_id: string
          provider_event_id: string | null
          to_status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          event_type: string
          firebase_id?: string | null
          from_status?: string | null
          id?: string
          is_manual_correction?: boolean
          payment_record_id: string
          provider_event_id?: string | null
          to_status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          firebase_id?: string | null
          from_status?: string | null
          id?: string
          is_manual_correction?: boolean
          payment_record_id?: string
          provider_event_id?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_event_logs_payment_record_id_fkey"
            columns: ["payment_record_id"]
            isOneToOne: false
            referencedRelation: "payment_records"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          booking_id: string
          completed_at: string | null
          created_at: string
          currency_code: string
          external_reference: string | null
          failure_code: string | null
          failure_message: string | null
          firebase_id: string | null
          id: string
          idempotency_key: string | null
          payment_kind: string
          payment_method: string | null
          payment_type: string
          paymongo_checkout_session_id: string | null
          paymongo_payment_id: string | null
          paymongo_payment_intent_id: string | null
          paymongo_source_id: string | null
          proof_storage_path: string | null
          provider_metadata: Json
          provider_status: string | null
          refund_amount: number
          refund_status: string
          rejection_reason: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          external_reference?: string | null
          failure_code?: string | null
          failure_message?: string | null
          firebase_id?: string | null
          id?: string
          idempotency_key?: string | null
          payment_kind?: string
          payment_method?: string | null
          payment_type?: string
          paymongo_checkout_session_id?: string | null
          paymongo_payment_id?: string | null
          paymongo_payment_intent_id?: string | null
          paymongo_source_id?: string | null
          proof_storage_path?: string | null
          provider_metadata?: Json
          provider_status?: string | null
          refund_amount?: number
          refund_status?: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          external_reference?: string | null
          failure_code?: string | null
          failure_message?: string | null
          firebase_id?: string | null
          id?: string
          idempotency_key?: string | null
          payment_kind?: string
          payment_method?: string | null
          payment_type?: string
          paymongo_checkout_session_id?: string | null
          paymongo_payment_id?: string | null
          paymongo_payment_intent_id?: string | null
          paymongo_source_id?: string | null
          proof_storage_path?: string | null
          provider_metadata?: Json
          provider_status?: string | null
          refund_amount?: number
          refund_status?: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      paymongo_webhook_events: {
        Row: {
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          payment_record_id: string | null
          processed_at: string | null
          processing_status: string
          provider_event_id: string
          received_at: string
          signature_valid: boolean
        }
        Insert: {
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          payment_record_id?: string | null
          processed_at?: string | null
          processing_status?: string
          provider_event_id: string
          received_at?: string
          signature_valid?: boolean
        }
        Update: {
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payment_record_id?: string | null
          processed_at?: string | null
          processing_status?: string
          provider_event_id?: string
          received_at?: string
          signature_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "paymongo_webhook_events_payment_record_id_fkey"
            columns: ["payment_record_id"]
            isOneToOne: false
            referencedRelation: "payment_records"
            referencedColumns: ["id"]
          },
        ]
      }
      product_availability_summary: {
        Row: {
          available_units: number
          maintenance_units: number
          product_id: string
          rented_units: number
          reserved_units: number
          total_units: number
          updated_at: string
        }
        Insert: {
          available_units?: number
          maintenance_units?: number
          product_id: string
          rented_units?: number
          reserved_units?: number
          total_units?: number
          updated_at?: string
        }
        Update: {
          available_units?: number
          maintenance_units?: number
          product_id?: string
          rented_units?: number
          reserved_units?: number
          total_units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_availability_summary_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          firebase_id: string | null
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          firebase_id?: string | null
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          firebase_id?: string | null
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string
          created_at: string
          created_by: string | null
          daily_rate: number
          description: string | null
          firebase_id: string | null
          id: string
          is_featured: boolean
          name: string
          refundable_deposit: number
          short_description: string | null
          slug: string
          specifications: Json
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          daily_rate: number
          description?: string | null
          firebase_id?: string | null
          id?: string
          is_featured?: boolean
          name: string
          refundable_deposit?: number
          short_description?: string | null
          slug: string
          specifications?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          daily_rate?: number
          description?: string | null
          firebase_id?: string | null
          id?: string
          is_featured?: boolean
          name?: string
          refundable_deposit?: number
          short_description?: string | null
          slug?: string
          specifications?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          created_at: string
          display_name: string
          display_role: string
          email: string
          facebook_link: string | null
          firebase_uid: string | null
          first_name: string | null
          full_address: string | null
          id: string
          instagram_link: string | null
          last_name: string | null
          phone_number: string | null
          photo_path: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          display_name: string
          display_role?: string
          email: string
          facebook_link?: string | null
          firebase_uid?: string | null
          first_name?: string | null
          full_address?: string | null
          id: string
          instagram_link?: string | null
          last_name?: string | null
          phone_number?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          created_at?: string
          display_name?: string
          display_role?: string
          email?: string
          facebook_link?: string | null
          firebase_uid?: string | null
          first_name?: string | null
          full_address?: string | null
          id?: string
          instagram_link?: string | null
          last_name?: string | null
          phone_number?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh_key: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh_key: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh_key?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      requirement_document_reviews: {
        Row: {
          booking_document_id: string
          created_at: string
          firebase_id: string | null
          id: string
          notes: string | null
          reviewed_at: string
          reviewed_by: string | null
          status: string
        }
        Insert: {
          booking_document_id: string
          created_at?: string
          firebase_id?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string
          reviewed_by?: string | null
          status: string
        }
        Update: {
          booking_document_id?: string
          created_at?: string
          firebase_id?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_document_reviews_booking_document_id_fkey"
            columns: ["booking_document_id"]
            isOneToOne: false
            referencedRelation: "booking_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          firebase_id: string | null
          id: string
          product_id: string
          rating: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          firebase_id?: string | null
          id?: string
          product_id: string
          rating: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          firebase_id?: string | null
          id?: string
          product_id?: string
          rating?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      website_content: {
        Row: {
          content: Json
          content_key: string
          created_at: string
          firebase_id: string | null
          id: string
          is_published: boolean
          section: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          content_key: string
          created_at?: string
          firebase_id?: string | null
          id?: string
          is_published?: boolean
          section: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          content_key?: string
          created_at?: string
          firebase_id?: string | null
          id?: string
          is_published?: boolean
          section?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_booking_status: {
        Args: { p_booking_id: string; p_new_status: string; p_note?: string }
        Returns: {
          admin_notes: string | null
          agreement_status: string
          approved_at: string | null
          booking_reference: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_notes: string | null
          customer_snapshot: Json
          daily_rate: number
          delivery_fee: number
          firebase_id: string | null
          fulfillment_method: string
          id: string
          inventory_unit_id: string | null
          location: string | null
          product_id: string
          product_snapshot: Json
          refundable_deposit: number
          released_at: string | null
          rental_days: number | null
          rental_end_date: string
          rental_start_date: string
          rental_subtotal: number
          requirements_status: string
          returned_at: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_own_booking: {
        Args: { p_booking_id: string; p_note?: string }
        Returns: {
          admin_notes: string | null
          agreement_status: string
          approved_at: string | null
          booking_reference: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_notes: string | null
          customer_snapshot: Json
          daily_rate: number
          delivery_fee: number
          firebase_id: string | null
          fulfillment_method: string
          id: string
          inventory_unit_id: string | null
          location: string | null
          product_id: string
          product_snapshot: Json
          refundable_deposit: number
          released_at: string | null
          rental_days: number | null
          rental_end_date: string
          rental_start_date: string
          rental_subtotal: number
          requirements_status: string
          returned_at: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_booking: {
        Args: { p_booking_id: string; p_note?: string }
        Returns: {
          admin_notes: string | null
          agreement_status: string
          approved_at: string | null
          booking_reference: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_notes: string | null
          customer_snapshot: Json
          daily_rate: number
          delivery_fee: number
          firebase_id: string | null
          fulfillment_method: string
          id: string
          inventory_unit_id: string | null
          location: string | null
          product_id: string
          product_snapshot: Json
          refundable_deposit: number
          released_at: string | null
          rental_days: number | null
          rental_end_date: string
          rental_start_date: string
          rental_subtotal: number
          requirements_status: string
          returned_at: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking: {
        Args: {
          p_customer_notes: string
          p_customer_snapshot: Json
          p_delivery_fee: number
          p_discount_amount: number
          p_emergency_contact?: Json
          p_fulfillment_method: string
          p_location: string
          p_product_id: string
          p_product_snapshot: Json
          p_rental_end_date: string
          p_rental_start_date: string
        }
        Returns: {
          admin_notes: string | null
          agreement_status: string
          approved_at: string | null
          booking_reference: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_notes: string | null
          customer_snapshot: Json
          daily_rate: number
          delivery_fee: number
          firebase_id: string | null
          fulfillment_method: string
          id: string
          inventory_unit_id: string | null
          location: string | null
          product_id: string
          product_snapshot: Json
          refundable_deposit: number
          released_at: string | null
          rental_days: number | null
          rental_end_date: string
          rental_start_date: string
          rental_subtotal: number
          requirements_status: string
          returned_at: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_active_admin: { Args: never; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action: string
          p_booking_id?: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_new_values?: Json
          p_previous_values?: Json
        }
        Returns: string
      }
      system_confirm_booking: {
        Args: { p_booking_id: string; p_note?: string }
        Returns: {
          admin_notes: string | null
          agreement_status: string
          approved_at: string | null
          booking_reference: string
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_notes: string | null
          customer_snapshot: Json
          daily_rate: number
          delivery_fee: number
          firebase_id: string | null
          fulfillment_method: string
          id: string
          inventory_unit_id: string | null
          location: string | null
          product_id: string
          product_snapshot: Json
          refundable_deposit: number
          released_at: string | null
          rental_days: number | null
          rental_end_date: string
          rental_start_date: string
          rental_subtotal: number
          requirements_status: string
          returned_at: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
