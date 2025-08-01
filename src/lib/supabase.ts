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
        Args: {
          p_usename: string
        }
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
      denials: {
        Row: {
          billed_amount: number | null
          created_at: string
          id: number
          is_closed: boolean
          paid_amount: number | null
          patient_id: number
          service_end_date: string | null
          service_start_date: string
        }
        Insert: {
          billed_amount?: number | null
          created_at?: string
          id?: number
          is_closed?: boolean
          paid_amount?: number | null
          patient_id: number
          service_end_date?: string | null
          service_start_date: string
        }
        Update: {
          billed_amount?: number | null
          created_at?: string
          id?: number
          is_closed?: boolean
          paid_amount?: number | null
          patient_id?: number
          service_end_date?: string | null
          service_start_date?: string
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
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          denial_id: number
          id?: number
          modified_at?: string | null
          modified_by?: string | null
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          denial_id?: number
          id?: number
          modified_at?: string | null
          modified_by?: string | null
          note?: string
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
          last_name: string
          note: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth: string
          first_name: string
          id?: number
          last_name: string
          note?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string
          first_name?: string
          id?: number
          last_name?: string
          note?: string | null
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
            foreignKeyName: "patients_files_patient_id_fkey"
            columns: ["patient_id"]
            referencedRelation: "patients"
            referencedColumns: ["id"]
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
      roles: {
        Row: {
          created_at: string
          id: number
          permissions: Json | null
          role_name: string
        }
        Insert: {
          created_at?: string
          id?: number
          permissions?: Json | null
          role_name: string
        }
        Update: {
          created_at?: string
          id?: number
          permissions?: Json | null
          role_name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          id: string
          role: number | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          role?: number | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: number | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_users_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
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
          updated_at?: string | null
        }
        Relationships: []
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
      can_insert_object: {
        Args: {
          bucketid: string
          name: string
          owner: string
          metadata: Json
        }
        Returns: undefined
      }
      extension: {
        Args: {
          name: string
        }
        Returns: string
      }
      filename: {
        Args: {
          name: string
        }
        Returns: string
      }
      foldername: {
        Args: {
          name: string
        }
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
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
