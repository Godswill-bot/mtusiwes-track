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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          date: string
          id: string
          latitude: number | null
          longitude: number | null
          student_id: string
          verified: boolean | null
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          date: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          student_id: string
          verified?: boolean | null
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          student_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string | null
          day_of_week: string
          description: string | null
          id: string
          image_url: string
          uploaded_at: string | null
          week_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: string
          description?: string | null
          id?: string
          image_url: string
          uploaded_at?: string | null
          week_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: string
          description?: string | null
          id?: string
          image_url?: string
          uploaded_at?: string | null
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      stamps: {
        Row: {
          created_at: string
          forwarded_at: string | null
          id: string
          image_path: string | null
          ip_address: string | null
          latitude: number | null
          longitude: number | null
          method: Database["public"]["Enums"]["stamp_method"]
          notes: string | null
          proof_hash: string
          signed_at: string
          supervisor_id: string | null
          week_id: string
        }
        Insert: {
          created_at?: string
          forwarded_at?: string | null
          id?: string
          image_path?: string | null
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          method: Database["public"]["Enums"]["stamp_method"]
          notes?: string | null
          proof_hash: string
          signed_at?: string
          supervisor_id?: string | null
          week_id: string
        }
        Update: {
          created_at?: string
          forwarded_at?: string | null
          id?: string
          image_path?: string | null
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          method?: Database["public"]["Enums"]["stamp_method"]
          notes?: string | null
          proof_hash?: string
          signed_at?: string
          supervisor_id?: string | null
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stamps_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          department: string
          email: string
          full_name: string | null
          hashed_password: string | null
          industry_supervisor_id: string | null
          faculty: string
          id: string
          industry_supervisor_email: string | null
          industry_supervisor_name: string
          industry_supervisor_phone: string | null
          is_active: boolean
          level: string | null
          location_size: Database["public"]["Enums"]["location_size"]
          matric_no: string
          nature_of_business: string
          organisation_address: string
          organisation_name: string
          other_info: string | null
          period_of_training: string
          phone: string
          products_services: string
          profile_image_url: string | null
          school_supervisor_email: string | null
          school_supervisor_name: string | null
          start_date: string | null
          end_date: string | null
          supervisor_id: string | null
          siwes_locked: boolean | null
          siwes_locked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          email: string
          full_name?: string | null
          hashed_password?: string | null
          industry_supervisor_id?: string | null
          faculty: string
          id?: string
          industry_supervisor_email?: string | null
          industry_supervisor_name: string
          industry_supervisor_phone?: string | null
          is_active?: boolean
          level?: string | null
          location_size: Database["public"]["Enums"]["location_size"]
          matric_no: string
          nature_of_business: string
          organisation_address: string
          organisation_name: string
          other_info?: string | null
          period_of_training: string
          phone: string
          products_services: string
          profile_image_url?: string | null
          school_supervisor_email?: string | null
          school_supervisor_name?: string | null
          start_date?: string | null
          end_date?: string | null
          supervisor_id?: string | null
          siwes_locked?: boolean | null
          siwes_locked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          email?: string
          full_name?: string | null
          hashed_password?: string | null
          industry_supervisor_id?: string | null
          faculty?: string
          id?: string
          industry_supervisor_email?: string | null
          industry_supervisor_name?: string
          industry_supervisor_phone?: string | null
          is_active?: boolean
          level?: string | null
          location_size?: Database["public"]["Enums"]["location_size"]
          matric_no?: string
          nature_of_business?: string
          organisation_address?: string
          organisation_name?: string
          other_info?: string | null
          period_of_training?: string
          phone?: string
          products_services?: string
          profile_image_url?: string | null
          school_supervisor_email?: string | null
          school_supervisor_name?: string | null
          start_date?: string | null
          end_date?: string | null
          supervisor_id?: string | null
          siwes_locked?: boolean | null
          siwes_locked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supervisors: {
        Row: {
          created_at: string
          email: string
          hashed_password: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          supervisor_type: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          hashed_password?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          supervisor_type: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          hashed_password?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          supervisor_type?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          created_at: string
          email: string
          full_name: string
          hashed_password: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          hashed_password: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          hashed_password?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weeks: {
        Row: {
          comments: string | null
          created_at: string
          end_date: string
          forwarded_to_school: boolean | null
          friday_activity: string | null
          id: string
          monday_activity: string | null
          rejection_reason: string | null
          saturday_activity: string | null
          school_approved_at: string | null
          school_supervisor_comments: string | null
          start_date: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
          thursday_activity: string | null
          tuesday_activity: string | null
          updated_at: string
          wednesday_activity: string | null
          week_number: number
        }
        Insert: {
          comments?: string | null
          created_at?: string
          end_date: string
          forwarded_to_school?: boolean | null
          friday_activity?: string | null
          id?: string
          monday_activity?: string | null
          rejection_reason?: string | null
          saturday_activity?: string | null
          school_approved_at?: string | null
          school_supervisor_comments?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string | null
          thursday_activity?: string | null
          tuesday_activity?: string | null
          updated_at?: string
          wednesday_activity?: string | null
          week_number: number
        }
        Update: {
          comments?: string | null
          created_at?: string
          end_date?: string
          forwarded_to_school?: boolean | null
          friday_activity?: string | null
          id?: string
          monday_activity?: string | null
          rejection_reason?: string | null
          saturday_activity?: string | null
          school_approved_at?: string | null
          school_supervisor_comments?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string | null
          thursday_activity?: string | null
          tuesday_activity?: string | null
          updated_at?: string
          wednesday_activity?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "weeks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_registration: {
        Row: {
          created_at: string
          id: string
          remark: string | null
          session_id: string | null
          status: string
          student_id: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          remark?: string | null
          session_id?: string | null
          status?: string
          student_id: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          remark?: string | null
          session_id?: string | null
          status?: string
          student_id?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_registration_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_registration_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_registration_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_sessions: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp: string
          type: string
          used: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp: string
          type: string
          used?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp?: string
          type?: string
          used?: boolean
        }
        Relationships: []
      }
      student_placements: {
        Row: {
          created_at: string
          id: string
          organisation_address: string | null
          organisation_name: string | null
          placement_date: string | null
          session_id: string
          student_id: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_address?: string | null
          organisation_name?: string | null
          placement_date?: string | null
          session_id: string
          student_id: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_address?: string | null
          organisation_name?: string | null
          placement_date?: string | null
          session_id?: string
          student_id?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_placements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_placements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_placements_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_assignments: {
        Row: {
          assignment_type: string
          created_at: string
          id: string
          session_id: string
          student_id: string
          supervisor_id: string
          updated_at: string
        }
        Insert: {
          assignment_type: string
          created_at?: string
          id?: string
          session_id: string
          student_id: string
          supervisor_id: string
          updated_at?: string
        }
        Update: {
          assignment_type?: string
          created_at?: string
          id?: string
          session_id?: string
          student_id?: string
          supervisor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_assignments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "supervisors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activities: {
        Row: {
          activity_details: Json | null
          activity_type: string
          created_at: string
          error_message: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
          user_email: string
          user_id: string | null
          user_type: string | null
        }
        Insert: {
          activity_details?: Json | null
          activity_type: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_email: string
          user_id?: string | null
          user_type?: string | null
        }
        Update: {
          activity_details?: Json | null
          activity_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_email?: string
          user_id?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_student_to_school_supervisor: {
        Args: {
          p_student_id: string
        }
        Returns: string | null
      }
      get_lagos_timestamp: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "student"
        | "industry_supervisor"
        | "school_supervisor"
        | "admin"
      location_size: "small" | "medium" | "large"
      stamp_method: "upload" | "signature_pad" | "qr" | "otp"
      submission_status: "draft" | "submitted" | "approved" | "rejected"
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
    : never,
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
      app_role: [
        "student",
        "industry_supervisor",
        "school_supervisor",
        "admin",
      ],
      location_size: ["small", "medium", "large"],
      stamp_method: ["upload", "signature_pad", "qr", "otp"],
      submission_status: ["draft", "submitted", "approved", "rejected"],
    },
  },
} as const
