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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      affiliate_commissions: {
        Row: {
          cambista_amount: number | null
          cambista_id: string | null
          cambista_percent_of_manager: number | null
          company_id: string
          company_net_amount: number
          created_at: string
          id: string
          manager_gross_amount: number | null
          manager_id: string | null
          manager_net_amount: number | null
          manager_percent: number | null
          payment_id: string
          raffle_id: string
          rates_snapshot: Json
          sale_amount: number
          super_admin_amount: number
          super_admin_percent: number
          ticket_id: string
        }
        Insert: {
          cambista_amount?: number | null
          cambista_id?: string | null
          cambista_percent_of_manager?: number | null
          company_id: string
          company_net_amount: number
          created_at?: string
          id?: string
          manager_gross_amount?: number | null
          manager_id?: string | null
          manager_net_amount?: number | null
          manager_percent?: number | null
          payment_id: string
          raffle_id: string
          rates_snapshot: Json
          sale_amount: number
          super_admin_amount: number
          super_admin_percent: number
          ticket_id: string
        }
        Update: {
          cambista_amount?: number | null
          cambista_id?: string | null
          cambista_percent_of_manager?: number | null
          company_id?: string
          company_net_amount?: number
          created_at?: string
          id?: string
          manager_gross_amount?: number | null
          manager_id?: string | null
          manager_net_amount?: number | null
          manager_percent?: number | null
          payment_id?: string
          raffle_id?: string
          rates_snapshot?: Json
          sale_amount?: number
          super_admin_amount?: number
          super_admin_percent?: number
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_cambista_id_fkey"
            columns: ["cambista_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          commission_percent: number
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          is_sales_paused: boolean
          link_code: string
          name: string
          parent_affiliate_id: string | null
          paused_at: string | null
          paused_by: string | null
          permission_profile_id: string | null
          phone: string | null
          type: Database["public"]["Enums"]["affiliate_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          commission_percent?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_sales_paused?: boolean
          link_code: string
          name: string
          parent_affiliate_id?: string | null
          paused_at?: string | null
          paused_by?: string | null
          permission_profile_id?: string | null
          phone?: string | null
          type: Database["public"]["Enums"]["affiliate_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          commission_percent?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_sales_paused?: boolean
          link_code?: string
          name?: string
          parent_affiliate_id?: string | null
          paused_at?: string | null
          paused_by?: string | null
          permission_profile_id?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["affiliate_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliates_parent_affiliate_id_fkey"
            columns: ["parent_affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliates_permission_profile_id_fkey"
            columns: ["permission_profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changes_json: Json | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          player_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes_json?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          player_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes_json?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          player_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rate_changes: {
        Row: {
          changed_by: string | null
          company_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          field_changed: string
          id: string
          new_value: number | null
          old_value: number | null
        }
        Insert: {
          changed_by?: string | null
          company_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          field_changed: string
          id?: string
          new_value?: number | null
          old_value?: number | null
        }
        Update: {
          changed_by?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_changed?: string
          id?: string
          new_value?: number | null
          old_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_rate_changes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          admin_fee_percentage: number | null
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          payments_enabled: boolean | null
          primary_color: string | null
          secondary_color: string | null
          slug: string
          status: Database["public"]["Enums"]["company_status"] | null
          stripe_secret_key_encrypted: string | null
          stripe_webhook_secret_encrypted: string | null
          updated_at: string
        }
        Insert: {
          admin_fee_percentage?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          payments_enabled?: boolean | null
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          status?: Database["public"]["Enums"]["company_status"] | null
          stripe_secret_key_encrypted?: string | null
          stripe_webhook_secret_encrypted?: string | null
          updated_at?: string
        }
        Update: {
          admin_fee_percentage?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          payments_enabled?: boolean | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["company_status"] | null
          stripe_secret_key_encrypted?: string | null
          stripe_webhook_secret_encrypted?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_banners: {
        Row: {
          company_id: string
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          redirect_url: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          redirect_url?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          redirect_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_banners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_batches: {
        Row: {
          created_at: string
          draw_order: number
          finalized_at: string | null
          id: string
          name: string | null
          raffle_id: string
        }
        Insert: {
          created_at?: string
          draw_order: number
          finalized_at?: string | null
          id?: string
          name?: string | null
          raffle_id: string
        }
        Update: {
          created_at?: string
          draw_order?: number
          finalized_at?: string | null
          id?: string
          name?: string | null
          raffle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draw_batches_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_numbers: {
        Row: {
          created_at: string
          draw_batch_id: string
          id: string
          number: number
          raffle_id: string
        }
        Insert: {
          created_at?: string
          draw_batch_id: string
          id?: string
          number: number
          raffle_id: string
        }
        Update: {
          created_at?: string
          draw_batch_id?: string
          id?: string
          number?: number
          raffle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draw_numbers_draw_batch_id_fkey"
            columns: ["draw_batch_id"]
            isOneToOne: false
            referencedRelation: "draw_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draw_numbers_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_logs: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          admin_fee: number | null
          amount: number
          company_id: string
          created_at: string
          id: string
          net_amount: number
          player_id: string
          processed_at: string | null
          raffle_id: string
          status: Database["public"]["Enums"]["payment_status"] | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          ticket_id: string
          updated_at: string
        }
        Insert: {
          admin_fee?: number | null
          amount: number
          company_id: string
          created_at?: string
          id?: string
          net_amount: number
          player_id: string
          processed_at?: string | null
          raffle_id: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          ticket_id: string
          updated_at?: string
        }
        Update: {
          admin_fee?: number | null
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          net_amount?: number
          player_id?: string
          processed_at?: string | null
          raffle_id?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          company_id: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_profiles: {
        Row: {
          affiliate_type: Database["public"]["Enums"]["affiliate_type"]
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          affiliate_type: Database["public"]["Enums"]["affiliate_type"]
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          affiliate_type?: Database["public"]["Enums"]["affiliate_type"]
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      players: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          city: string | null
          company_id: string
          cpf_encrypted: string | null
          cpf_hash: string
          cpf_last4: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          password_hash: string
          phone: string | null
          status: Database["public"]["Enums"]["player_status"] | null
          updated_at: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          city?: string | null
          company_id: string
          cpf_encrypted?: string | null
          cpf_hash: string
          cpf_last4: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          password_hash: string
          phone?: string | null
          status?: Database["public"]["Enums"]["player_status"] | null
          updated_at?: string
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          city?: string | null
          company_id?: string
          cpf_encrypted?: string | null
          cpf_hash?: string
          cpf_last4?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          password_hash?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["player_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_tiers: {
        Row: {
          created_at: string
          hits_required: number
          id: string
          object_description: string | null
          prize_percentage: number
          prize_type: Database["public"]["Enums"]["prize_type"] | null
          purchase_allowed_until_draw_count: number | null
          raffle_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hits_required: number
          id?: string
          object_description?: string | null
          prize_percentage: number
          prize_type?: Database["public"]["Enums"]["prize_type"] | null
          purchase_allowed_until_draw_count?: number | null
          raffle_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hits_required?: number
          id?: string
          object_description?: string | null
          prize_percentage?: number
          prize_type?: Database["public"]["Enums"]["prize_type"] | null
          purchase_allowed_until_draw_count?: number | null
          raffle_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_tiers_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
        ]
      }
      raffles: {
        Row: {
          company_id: string
          company_profit_percent: number
          created_at: string
          current_draw_count: number | null
          deleted_at: string | null
          description: string | null
          finished_at: string | null
          fixed_prize_value: number | null
          id: string
          image_url: string | null
          name: string
          number_range_end: number
          number_range_start: number
          numbers_per_ticket: number
          prize_mode: Database["public"]["Enums"]["prize_mode"] | null
          prize_percent_of_sales: number | null
          rules_version: number | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["raffle_status"] | null
          ticket_price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          company_profit_percent?: number
          created_at?: string
          current_draw_count?: number | null
          deleted_at?: string | null
          description?: string | null
          finished_at?: string | null
          fixed_prize_value?: number | null
          id?: string
          image_url?: string | null
          name: string
          number_range_end?: number
          number_range_start?: number
          numbers_per_ticket?: number
          prize_mode?: Database["public"]["Enums"]["prize_mode"] | null
          prize_percent_of_sales?: number | null
          rules_version?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["raffle_status"] | null
          ticket_price: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_profit_percent?: number
          created_at?: string
          current_draw_count?: number | null
          deleted_at?: string | null
          description?: string | null
          finished_at?: string | null
          fixed_prize_value?: number | null
          id?: string
          image_url?: string | null
          name?: string
          number_range_end?: number
          number_range_start?: number
          numbers_per_ticket?: number
          prize_mode?: Database["public"]["Enums"]["prize_mode"] | null
          prize_percent_of_sales?: number | null
          rules_version?: number | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["raffle_status"] | null
          ticket_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raffles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action: string
          attempts: number | null
          blocked_until: string | null
          first_attempt_at: string | null
          id: string
          identifier: string
          last_attempt_at: string | null
        }
        Insert: {
          action: string
          attempts?: number | null
          blocked_until?: string | null
          first_attempt_at?: string | null
          id?: string
          identifier: string
          last_attempt_at?: string | null
        }
        Update: {
          action?: string
          attempts?: number | null
          blocked_until?: string | null
          first_attempt_at?: string | null
          id?: string
          identifier?: string
          last_attempt_at?: string | null
        }
        Relationships: []
      }
      ticket_numbers: {
        Row: {
          created_at: string
          id: string
          number: number
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          number: number
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          number?: number
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_numbers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_ranking: {
        Row: {
          company_id: string
          hits: number | null
          id: string
          last_calculated_at: string | null
          missing: number
          player_id: string
          raffle_id: string
          rank_position: number | null
          ticket_id: string
        }
        Insert: {
          company_id: string
          hits?: number | null
          id?: string
          last_calculated_at?: string | null
          missing: number
          player_id: string
          raffle_id: string
          rank_position?: number | null
          ticket_id: string
        }
        Update: {
          company_id?: string
          hits?: number | null
          id?: string
          last_calculated_at?: string | null
          missing?: number
          player_id?: string
          raffle_id?: string
          rank_position?: number | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_ranking_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_ranking_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_ranking_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_ranking_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          affiliate_id: string | null
          company_id: string
          created_at: string
          eligible_prize_tiers: string[] | null
          id: string
          player_id: string
          purchased_at: string | null
          raffle_id: string
          snapshot_data: Json | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          updated_at: string
        }
        Insert: {
          affiliate_id?: string | null
          company_id: string
          created_at?: string
          eligible_prize_tiers?: string[] | null
          id?: string
          player_id: string
          purchased_at?: string | null
          raffle_id: string
          snapshot_data?: Json | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string | null
          company_id?: string
          created_at?: string
          eligible_prize_tiers?: string[] | null
          id?: string
          player_id?: string
          purchased_at?: string | null
          raffle_id?: string
          snapshot_data?: Json | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          company_id: string | null
          created_at: string
          error_message: string | null
          event_id: string | null
          event_type: string
          id: string
          payload: Json
          processing_time_ms: number | null
          status: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          payload?: Json
          processing_time_ms?: number | null
          status?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processing_time_ms?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      affiliate_has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      calculate_ticket_ranking: {
        Args: { p_ticket_id: string }
        Returns: undefined
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_block_seconds?: number
          p_identifier: string
          p_max_attempts?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      get_affiliate_by_link_code: {
        Args: { _link_code: string }
        Returns: {
          company_id: string
          id: string
          is_sales_paused: boolean
          name: string
          parent_affiliate_id: string
          type: Database["public"]["Enums"]["affiliate_type"]
        }[]
      }
      get_user_company_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_company: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_changes?: Json
          p_company_id: string
          p_entity_id: string
          p_entity_type: string
          p_ip_address?: unknown
          p_player_id: string
          p_user_id: string
        }
        Returns: string
      }
      log_financial: {
        Args: {
          p_amount: number
          p_company_id: string
          p_description?: string
          p_reference_id?: string
          p_reference_type?: string
          p_type: string
        }
        Returns: string
      }
      recalculate_raffle_ranking: {
        Args: { p_raffle_id: string }
        Returns: undefined
      }
      settle_raffle_winners: { Args: { p_raffle_id: string }; Returns: Json }
    }
    Enums: {
      affiliate_type: "manager" | "cambista"
      app_role: "SUPER_ADMIN" | "ADMIN_EMPRESA" | "COLABORADOR"
      company_status: "active" | "suspended" | "deleted"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
      player_status: "active" | "blocked" | "deleted"
      prize_mode: "FIXED" | "FIXED_PLUS_PERCENT" | "PERCENT_ONLY"
      prize_type: "money" | "object"
      raffle_status: "draft" | "active" | "paused" | "finished"
      ticket_status: "pending_payment" | "active" | "winner" | "cancelled"
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
    Enums: {
      affiliate_type: ["manager", "cambista"],
      app_role: ["SUPER_ADMIN", "ADMIN_EMPRESA", "COLABORADOR"],
      company_status: ["active", "suspended", "deleted"],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "refunded",
      ],
      player_status: ["active", "blocked", "deleted"],
      prize_mode: ["FIXED", "FIXED_PLUS_PERCENT", "PERCENT_ONLY"],
      prize_type: ["money", "object"],
      raffle_status: ["draft", "active", "paused", "finished"],
      ticket_status: ["pending_payment", "active", "winner", "cancelled"],
    },
  },
} as const
