export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  pgbouncer: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_auth: {
        Args: { p_usename: string }
        Returns: {
          username: string
          password: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_interactions: {
        Row: {
          created_at: string
          denial_id: number | null
          duration_ms: number | null
          id: number
          interaction_type: string
          model_used: string | null
          prompt_summary: string | null
          response_summary: string | null
          tokens_used: number | null
          tool_name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          denial_id?: number | null
          duration_ms?: number | null
          id?: number
          interaction_type: string
          model_used?: string | null
          prompt_summary?: string | null
          response_summary?: string | null
          tokens_used?: number | null
          tool_name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          denial_id?: number | null
          duration_ms?: number | null
          id?: number
          interaction_type?: string
          model_used?: string | null
          prompt_summary?: string | null
          response_summary?: string | null
          tokens_used?: number | null
          tool_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_denial_id_fkey"
            columns: ["denial_id"]
            referencedRelation: "denials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interactions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_events: {
        Row: {
          actor_role_ids: number[]
          actor_user_id: string | null
          count: number | null
          created_at: string
          duration_ms: number | null
          event_name: string
          feature_area: string
          id: number
          metadata: Json
          outcome: string
          permission_key: string | null
          permission_source: string
          request_id: string | null
          resource_id: string | null
          resource_type: string | null
          session_id: string | null
          subject_denial_id: number | null
          subject_patient_id: number | null
        }
        Insert: {
          actor_role_ids?: number[]
          actor_user_id?: string | null
          count?: number | null
          created_at?: string
          duration_ms?: number | null
          event_name: string
          feature_area: string
          id?: number
          metadata?: Json
          outcome: string
          permission_key?: string | null
          permission_source?: string
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          subject_denial_id?: number | null
          subject_patient_id?: number | null
        }
        Update: {
          actor_role_ids?: number[]
          actor_user_id?: string | null
          count?: number | null
          created_at?: string
          duration_ms?: number | null
          event_name?: string
          feature_area?: string
          id?: number
          metadata?: Json
          outcome?: string
          permission_key?: string | null
          permission_source?: string
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          subject_denial_id?: number | null
          subject_patient_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "app_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_events_permission_key_fkey"
            columns: ["permission_key"]
            referencedRelation: "permission_catalog"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "app_events_subject_denial_id_fkey"
            columns: ["subject_denial_id"]
            referencedRelation: "denials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_events_subject_patient_id_fkey"
            columns: ["subject_patient_id"]
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: number
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: number
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: number
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          content: string
          context_snapshot: Json | null
          created_at: string
          id: number
          role: string
          session_id: string
          tool_name: string | null
          user_id: string
        }
        Insert: {
          content: string
          context_snapshot?: Json | null
          created_at?: string
          id?: number
          role: string
          session_id: string
          tool_name?: string | null
          user_id: string
        }
        Update: {
          content?: string
          context_snapshot?: Json | null
          created_at?: string
          id?: number
          role?: string
          session_id?: string
          tool_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      denials: {
        Row: {
          billed_amount: number | null
          created_at: string
          follow_up_date: string | null
          id: number
          is_closed: boolean
          paid_amount: number | null
          patient_id: number
          service_end_date: string | null
          service_start_date: string
          updated_at: string | null
        }
        Insert: {
          billed_amount?: number | null
          created_at?: string
          follow_up_date?: string | null
          id?: number
          is_closed?: boolean
          paid_amount?: number | null
          patient_id: number
          service_end_date?: string | null
          service_start_date: string
          updated_at?: string | null
        }
        Update: {
          billed_amount?: number | null
          created_at?: string
          follow_up_date?: string | null
          id?: number
          is_closed?: boolean
          paid_amount?: number | null
          patient_id?: number
          service_end_date?: string | null
          service_start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_denials_patient_id_fkey"
            columns: ["patient_id"]
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      denials_insurances: {
        Row: {
          created_at: string
          denial_id: number
          insurance_id: number
        }
        Insert: {
          created_at?: string
          denial_id: number
          insurance_id: number
        }
        Update: {
          created_at?: string
          denial_id?: number
          insurance_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "denials_insurances_denial_id_fkey"
            columns: ["denial_id"]
            referencedRelation: "denials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denials_insurances_insurance_id_fkey"
            columns: ["insurance_id"]
            referencedRelation: "insurances"
            referencedColumns: ["id"]
          },
        ]
      }
      denials_labels: {
        Row: {
          created_at: string
          denial_id: number
          label_id: number
        }
        Insert: {
          created_at?: string
          denial_id: number
          label_id: number
        }
        Update: {
          created_at?: string
          denial_id?: number
          label_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "public_denials_labels_denial_id_fkey"
            columns: ["denial_id"]
            referencedRelation: "denials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_denials_labels_label_id_fkey"
            columns: ["label_id"]
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          metadata: Json | null
          mimetype: string | null
          name: string
          size: number | null
        }
        Insert: {
          created_at?: string
          metadata?: Json | null
          mimetype?: string | null
          name: string
          size?: number | null
        }
        Update: {
          created_at?: string
          metadata?: Json | null
          mimetype?: string | null
          name?: string
          size?: number | null
        }
        Relationships: []
      }
      insurances: {
        Row: {
          created_at: string
          id: number
          name: string
          note: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          note?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          note?: string | null
        }
        Relationships: []
      }
      labels: {
        Row: {
          bg_color: string
          created_at: string
          id: number
          label_name: string
          order: number | null
          txt_color: string
        }
        Insert: {
          bg_color: string
          created_at?: string
          id?: number
          label_name: string
          order?: number | null
          txt_color: string
        }
        Update: {
          bg_color?: string
          created_at?: string
          id?: number
          label_name?: string
          order?: number | null
          txt_color?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          created_at: string
          created_by: string | null
          denial_id: number
          id: number
          modified_at: string | null
          modified_by: string | null
          note: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          denial_id: number
          id?: number
          modified_at?: string | null
          modified_by?: string | null
          note: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          denial_id?: number
          id?: number
          modified_at?: string | null
          modified_by?: string | null
          note?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_notes_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_notes_denial_id_fkey"
            columns: ["denial_id"]
            referencedRelation: "denials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_notes_modified_by_fkey"
            columns: ["modified_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notes_files: {
        Row: {
          created_at: string
          file_name: string
          note_id: number
        }
        Insert: {
          created_at?: string
          file_name: string
          note_id: number
        }
        Update: {
          created_at?: string
          file_name?: string
          note_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "notes_files_file_name_fkey"
            columns: ["file_name"]
            referencedRelation: "files"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "notes_files_note_id_fkey"
            columns: ["note_id"]
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string
          date_of_birth: string
          first_name: string
          id: number
          is_active: boolean
          last_name: string
          note: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth: string
          first_name: string
          id?: number
          is_active?: boolean
          last_name: string
          note?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string
          first_name?: string
          id?: number
          is_active?: boolean
          last_name?: string
          note?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      patients_files: {
        Row: {
          created_at: string
          file_name: string
          patient_id: number
        }
        Insert: {
          created_at?: string
          file_name: string
          patient_id: number
        }
        Update: {
          created_at?: string
          file_name?: string
          patient_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "patients_files_file_name_fkey"
            columns: ["file_name"]
            referencedRelation: "files"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "patients_files_patient_id_fkey"
            columns: ["patient_id"]
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_catalog: {
        Row: {
          category: string
          deprecated_at: string | null
          description: string
          introduced_at: string
          is_active: boolean
          is_kpi_relevant: boolean
          key: string
          legacy_keys: string[]
          risk_level: string
        }
        Insert: {
          category: string
          deprecated_at?: string | null
          description: string
          introduced_at?: string
          is_active?: boolean
          is_kpi_relevant?: boolean
          key: string
          legacy_keys?: string[]
          risk_level?: string
        }
        Update: {
          category?: string
          deprecated_at?: string | null
          description?: string
          introduced_at?: string
          is_active?: boolean
          is_kpi_relevant?: boolean
          key?: string
          legacy_keys?: string[]
          risk_level?: string
        }
        Relationships: []
      }
      permission_compatibility_map: {
        Row: {
          direction: string
          is_active: boolean
          legacy_key: string
          notes: string | null
          permission_key: string
        }
        Insert: {
          direction: string
          is_active?: boolean
          legacy_key: string
          notes?: string | null
          permission_key: string
        }
        Update: {
          direction?: string
          is_active?: boolean
          legacy_key?: string
          notes?: string | null
          permission_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_compatibility_map_permission_key_fkey"
            columns: ["permission_key"]
            referencedRelation: "permission_catalog"
            referencedColumns: ["key"]
          },
        ]
      }
      preference_users: {
        Row: {
          created_at: string
          preference_id: number
          user_id: string
          user_value: string | null
        }
        Insert: {
          created_at?: string
          preference_id: number
          user_id: string
          user_value?: string | null
        }
        Update: {
          created_at?: string
          preference_id?: number
          user_id?: string
          user_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preference_users_preference_id_fkey"
            columns: ["preference_id"]
            referencedRelation: "preferences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preference_users_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          created_at: string
          data_type: string
          id: number
          name: string
          value: string | null
        }
        Insert: {
          created_at?: string
          data_type: string
          id?: number
          name: string
          value?: string | null
        }
        Update: {
          created_at?: string
          data_type?: string
          id?: number
          name?: string
          value?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          permission_key: string
          role_id: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          permission_key: string
          role_id: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          permission_key?: string
          role_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            referencedRelation: "permission_catalog"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: number
          is_default: boolean
          is_system: boolean
          permissions: Json | null
          role_name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: number
          is_default?: boolean
          is_system?: boolean
          permissions?: Json | null
          role_name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: number
          is_default?: boolean
          is_system?: boolean
          permissions?: Json | null
          role_name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_updated_by_fkey"
            columns: ["updated_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: number
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          role_id: number
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: number
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id: number
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: number
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_revoked_by_fkey"
            columns: ["revoked_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_role_id_fkey"
            columns: ["role_id"]
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          password_changed_at: string | null
          role: number | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          password_changed_at?: string | null
          role?: number | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          password_changed_at?: string | null
          role?: number | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_users_role_fkey"
            columns: ["role"]
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
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
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          format: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          format?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string }
        Returns: undefined
      }
      can_insert_object: {
        Args: { bucketid: string; name: string; owner: string; metadata: Json }
        Returns: undefined
      }
      delete_prefix: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      extension: {
        Args: { name: string }
        Returns: string
      }
      filename: {
        Args: { name: string }
        Returns: string
      }
      foldername: {
        Args: { name: string }
        Returns: string[]
      }
      get_level: {
        Args: { name: string }
        Returns: number
      }
      get_prefix: {
        Args: { name: string }
        Returns: string
      }
      get_prefixes: {
        Args: { name: string }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          size: number
          bucket_id: string
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
        }
        Returns: {
          key: string
          id: string
          created_at: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          start_after?: string
          next_token?: string
        }
        Returns: {
          name: string
          id: string
          metadata: Json
          updated_at: string
        }[]
      }
      operation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      search: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
      search_legacy_v1: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
      search_v1_optimised: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
      search_v2: {
        Args: {
          prefix: string
          bucket_name: string
          limits?: number
          levels?: number
          start_after?: string
        }
        Returns: {
          key: string
          name: string
          id: string
          updated_at: string
          created_at: string
          metadata: Json
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS"
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
  graphql_public: {
    Enums: {},
  },
  pgbouncer: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS"],
    },
  },
} as const
