export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          clerk_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          clerk_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          clerk_id?: string
          name?: string
          created_at?: string
        }
      }
      system_settings: {
        Row: {
          id: string
          fee_percentage: number
          min_fee: number
          max_fee: number
          target_margin_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          fee_percentage?: number
          min_fee?: number
          max_fee?: number
          target_margin_rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          fee_percentage?: number
          min_fee?: number
          max_fee?: number
          target_margin_rate?: number
          created_at?: string
          updated_at?: string
        }
      }
      mall_whitelist: {
        Row: {
          id: string
          name: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          is_active?: boolean
          created_at?: string
        }
      }
      source_malls: {
        Row: {
          id: string
          key: string
          label: string
          is_active: boolean
          sort_order: number
          notes: string | null
          last_checked_at: string | null
          last_check_status: "ok" | "empty" | "failed" | null
          last_check_message: string | null
          last_check_offer_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          label: string
          is_active?: boolean
          sort_order?: number
          notes?: string | null
          last_checked_at?: string | null
          last_check_status?: "ok" | "empty" | "failed" | null
          last_check_message?: string | null
          last_check_offer_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          label?: string
          is_active?: boolean
          sort_order?: number
          notes?: string | null
          last_checked_at?: string | null
          last_check_status?: "ok" | "empty" | "failed" | null
          last_check_message?: string | null
          last_check_offer_count?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
          last_seen_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
          last_seen_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          created_at?: string
          last_seen_at?: string
        }
      }
      user_configs: {
        Row: {
          user_id: string
          poizon_app_key: string | null
          poizon_app_secret: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          poizon_app_key?: string | null
          poizon_app_secret?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          poizon_app_key?: string | null
          poizon_app_secret?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
