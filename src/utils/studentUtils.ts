/**
 * Student utility functions
 * Safe operations that work with RLS policies
 */

import { supabase } from "@/integrations/supabase/client";

export interface StudentRecord {
  id: string;
  user_id: string;
  matric_no: string;
  department: string;
  faculty: string;
  full_name?: string;
  email?: string;
  phone?: string;
  organisation_name?: string;
  organisation_address?: string;
  nature_of_business?: string;
  location_size?: string;
  products_services?: string;
  industry_supervisor_name?: string;
  period_of_training?: string;
  // Grading and lock fields
  siwes_locked?: boolean;
  siwes_locked_at?: string;
  graded?: boolean;
  graded_at?: string;
}

export interface GetOrCreateStudentResult {
  student: StudentRecord | null;
  error: string | null;
  created: boolean;
}

/**
 * Get existing student record or create a minimal one for the current user.
 * This function respects RLS policies - only works for authenticated users.
 * 
 * @param userId - The auth.uid() of the current user
 * @param userEmail - The email of the current user (for creating new record)
 * @param userName - The full name of the current user (optional)
 * @returns Student record, error message, and whether it was newly created
 */
export async function getOrCreateStudent(
  userId: string,
  userEmail: string,
  userName?: string
): Promise<GetOrCreateStudentResult> {
  try {
    // Step 1: Try to fetch existing student record
    const { data: existingStudent, error: fetchError } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // If fetch succeeded and student exists, return it
    if (existingStudent) {
      return {
        student: existingStudent as StudentRecord,
        error: null,
        created: false,
      };
    }

    // If there was a fetch error (not just "no rows"), log it
    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching student record:", fetchError);
      return {
        student: null,
        error: `Failed to fetch student: ${fetchError.message}`,
        created: false,
      };
    }

    // Step 2: No student record exists - create a minimal one
    // This requires the user to complete their profile later via Pre-SIWES form
    console.log("No student record found for user, creating minimal record...");

    // Generate a temporary matric number (user must update via Pre-SIWES)
    const tempMatricNo = `TEMP-${Date.now()}`;

    const newStudentData = {
      user_id: userId,
      email: userEmail,
      full_name: userName || "Student",
      matric_no: tempMatricNo,
      department: "TBD", // To Be Determined - user must update
      faculty: "TBD",
      organisation_name: "TBD",
      organisation_address: "TBD",
      nature_of_business: "TBD",
      location_size: "medium" as const,
      products_services: "TBD",
      industry_supervisor_name: "TBD",
      period_of_training: "TBD",
      phone: "",
    };

    const { data: newStudent, error: insertError } = await supabase
      .from("students")
      .insert(newStudentData)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating student record:", insertError);
      
      // Check for specific error types
      if (insertError.code === "23505") {
        // Duplicate key - record might exist now (race condition)
        // Try fetching again
        const { data: retryStudent } = await supabase
          .from("students")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        
        if (retryStudent) {
          return {
            student: retryStudent as StudentRecord,
            error: null,
            created: false,
          };
        }
      }
      
      return {
        student: null,
        error: `Failed to create student: ${insertError.message}`,
        created: false,
      };
    }

    console.log("Created new student record:", newStudent?.id);

    // Step 3: Automatically assign to a school supervisor
    // The database trigger should handle this for MTU emails, but we also call the RPC as a backup
    if (newStudent?.id) {
      try {
        const { error: assignError } = await supabase.rpc(
          "assign_student_to_school_supervisor",
          { p_student_id: newStudent.id }
        );
        if (assignError) {
          console.warn("Auto-assignment failed (may already be assigned by trigger):", assignError.message);
          // Don't fail - the trigger might have already assigned
        } else {
          console.log("Student auto-assigned to school supervisor");
        }
      } catch (assignErr) {
        console.warn("Auto-assignment error:", assignErr);
        // Don't fail - this is non-critical
      }
    }
    
    return {
      student: newStudent as StudentRecord,
      error: null,
      created: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Unexpected error in getOrCreateStudent:", error);
    return {
      student: null,
      error: errorMessage,
      created: false,
    };
  }
}

/**
 * Check if a student has completed their profile (has real matric number)
 */
export function isStudentProfileComplete(student: StudentRecord | null): boolean {
  if (!student) return false;
  
  // Check if matric_no is a temporary value
  if (student.matric_no.startsWith("TEMP-")) return false;
  if (student.matric_no === "TBD") return false;
  
  // Check required fields
  if (student.department === "TBD") return false;
  if (student.faculty === "TBD") return false;
  
  return true;
}

/**
 * Get student ID for the current authenticated user
 * Returns null if no student record exists
 */
export async function getStudentId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching student ID:", error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error("Unexpected error fetching student ID:", error);
    return null;
  }
}
