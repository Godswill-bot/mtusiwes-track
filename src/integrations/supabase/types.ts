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
          faculty: string
          id: string
          industry_supervisor_email: string | null
          industry_supervisor_name: string
          industry_supervisor_phone: string | null
          location_size: Database["public"]["Enums"]["location_size"]
          matric_no: string
          nature_of_business: string
          organisation_address: string
          organisation_name: string
          other_info: string | null
          period_of_training: string
          phone: string
          products_services: string
          school_supervisor_email: string | null
          school_supervisor_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          email: string
          faculty: string
          id?: string
          industry_supervisor_email?: string | null
          industry_supervisor_name: string
          industry_supervisor_phone?: string | null
          location_size: Database["public"]["Enums"]["location_size"]
          matric_no: string
          nature_of_business: string
          organisation_address: string
          organisation_name: string
          other_info?: string | null
          period_of_training: string
          phone: string
          products_services: string
          school_supervisor_email?: string | null
          school_supervisor_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          email?: string
          faculty?: string
          id?: string
          industry_supervisor_email?: string | null
          industry_supervisor_name?: string
          industry_supervisor_phone?: string | null
          location_size?: Database["public"]["Enums"]["location_size"]
          matric_no?: string
          nature_of_business?: string
          organisation_address?: string
          organisation_name?: string
          other_info?: string | null
          period_of_training?: string
          phone?: string
          products_services?: string
          school_supervisor_email?: string | null
          school_supervisor_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supervisors: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          supervisor_type: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          supervisor_type: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          supervisor_type?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
