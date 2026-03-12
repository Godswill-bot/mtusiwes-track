import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getAdminContext,
  hashPassword,
  logAudit,
  supabase,
} from "../_shared/admin-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type StudentAction =
  | "create_student"
  | "update_student"
  | "delete_student"
  | "assign_supervisors"
  | "set_student_status"
  | "reset_students_for_new_cycle";

interface BasePayload {
  action: StudentAction;
}

interface CreateStudentPayload extends BasePayload {
  action: "create_student";
  email: string;
  password: string;
  full_name: string;
  matric_no: string;
  department: string;
  faculty: string;
  organisation_name: string;
  organisation_address: string;
  nature_of_business: string;
  location_size: string;
  products_services: string;
  industry_supervisor_name: string;
  industry_supervisor_email?: string;
  industry_supervisor_phone?: string;
    supervisor_id?: string;
  user_id: string;
}

interface UpdateStudentPayload extends BasePayload {
  action: "update_student";
  student_id: string;
  updates: Record<string, unknown>;
}

interface DeleteStudentPayload extends BasePayload {
  action: "delete_student";
  student_id: string;
  user_id?: string;
}

interface AssignSupervisorsPayload extends BasePayload {
  action: "assign_supervisors";
  student_id: string;
  supervisor_id?: string | null;
  industry_supervisor_id?: string | null;
}

interface SetStudentStatusPayload extends BasePayload {
  action: "set_student_status";
  student_id: string;
  is_active: boolean;
}

interface ResetStudentsForNewCyclePayload extends BasePayload {
  action: "reset_students_for_new_cycle";
  confirmation_text: string;
}

type StudentsPayload =
  | CreateStudentPayload
  | UpdateStudentPayload
  | DeleteStudentPayload
  | AssignSupervisorsPayload
  | SetStudentStatusPayload
  | ResetStudentsForNewCyclePayload;

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminCtx = await getAdminContext(req);
    const payload: StudentsPayload = await req.json();

    switch (payload.action) {
      case "create_student":
        return await createStudent(adminCtx.adminId, payload);
      case "update_student":
        return await updateStudent(adminCtx.adminId, payload);
      case "delete_student":
        return await deleteStudent(adminCtx.adminId, payload);
      case "assign_supervisors":
        return await assignSupervisors(adminCtx.adminId, payload);
      case "set_student_status":
        return await setStudentStatus(adminCtx.adminId, payload);
      case "reset_students_for_new_cycle":
        return await resetStudentsForNewCycle(adminCtx.adminId, payload);
      default:
        return respond({ error: "Unsupported action" }, 400);
    }
  } catch (error) {
    console.error("admin-students error", error);
    const message = error?.message ?? "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden"
      ? 403
      : 500;
    return respond({ error: message }, status);
  }
});

const createStudent = async (
  adminId: string | null,
  payload: CreateStudentPayload,
) => {
  // Validate required fields
  if (!payload.matric_no || payload.matric_no.trim() === "" || payload.matric_no.startsWith("TEMP-")) {
    throw new Error("Valid matric number is required. Cannot use temporary matric numbers.");
  }
  
  if (!payload.faculty || payload.faculty.trim() === "" || payload.faculty === "TBD") {
    throw new Error("Faculty is required");
  }
  
  if (!payload.department || payload.department.trim() === "" || payload.department === "TBD") {
    throw new Error("Department is required");
  }
  
  if (!payload.phone || payload.phone.trim() === "") {
    throw new Error("Phone number is required");
  }

  // Check if matric number already exists for another student
  const { data: existingMatric } = await supabase
    .from("students")
    .select("user_id, matric_no")
    .eq("matric_no", payload.matric_no.trim())
    .maybeSingle();

  if (existingMatric) {
    throw new Error("This matriculation number is already registered to another student. Please use a different matric number.");
  }

  const hashed = await hashPassword(payload.password);

  const { data: authUser, error: authError } = await supabase
    .auth
    .admin
    .createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.full_name,
        role: "student",
        matric_number: payload.matric_no,
      },
    });

  if (authError || !authUser) {
    throw authError ?? new Error("Failed to create auth user");
  }

  const { data: student, error: insertError } = await supabase
    .from("students")
    .insert({
      user_id: authUser.user.id,
      full_name: payload.full_name,
      matric_no: payload.matric_no.trim(),
      department: payload.department.trim(),
      faculty: payload.faculty.trim(),
      organisation_name: payload.organisation_name,
      organisation_address: payload.organisation_address,
      nature_of_business: payload.nature_of_business,
      location_size: payload.location_size,
      products_services: payload.products_services,
      industry_supervisor_name: payload.industry_supervisor_name,
      industry_supervisor_email: payload.industry_supervisor_email ?? null,
      industry_supervisor_phone: payload.industry_supervisor_phone ?? null,        supervisor_id: payload.supervisor_id ?? null,      school_supervisor_name: payload.school_supervisor_name ?? null,
      school_supervisor_email: payload.school_supervisor_email ?? null,
      period_of_training: payload.period_of_training,
      other_info: payload.other_info ?? null,
      phone: payload.phone,
      email: payload.email,
      hashed_password: hashed,
      created_by_admin_id: adminId,
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  await logAudit(adminId, {
    actionType: "CREATE",
    tableName: "students",
    recordId: student.id,
    newValue: student,
  });

  return respond({ student });
};

const updateStudent = async (
  adminId: string | null,
  payload: UpdateStudentPayload,
) => {
  const { data: before } = await supabase
    .from("students")
    .select("*")
    .eq("id", payload.student_id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("students")
    .update(payload.updates)
    .eq("id", payload.student_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (payload.updates.full_name && before?.user_id) {
    await supabase
      .from("profiles")
      .update({ full_name: payload.updates.full_name })
      .eq("id", before.user_id);
  }

  await logAudit(adminId, {
    actionType: "UPDATE",
    tableName: "students",
    recordId: payload.student_id,
    oldValue: before ?? null,
    newValue: data,
  });

  return respond({ student: data });
};

const deleteStudent = async (
  adminId: string | null,
  payload: DeleteStudentPayload,
) => {
  const { data: before } = await supabase
    .from("students")
    .select("*")
    .eq("id", payload.student_id)
    .maybeSingle();

  try {
    // 1. Try the RPC first
    const { error: rpcError } = await supabase.rpc("force_delete_user", { 
      target_user_id: payload.user_id || payload.student_id, 
      target_student_id: payload.student_id 
    });

    if (rpcError) throw rpcError;
  } catch (e) {
    console.error("RPC Failed, falling back to manual cascade:", e);
    // 2. Manual cascade
    try {
      if (payload.student_id) {
        await supabase.from("logbook_entries").delete().eq("student_id", payload.student_id);
        await supabase.from("weeks").delete().eq("student_id", payload.student_id);
        await supabase.from("attendance").delete().eq("student_id", payload.student_id);
        await supabase.from("student_placements").delete().eq("student_id", payload.student_id);
        // Delete student record
        await supabase.from("students").delete().eq("id", payload.student_id);
      }
      // 3. Delete auth user
      if (payload.user_id) {
        await supabase.auth.admin.deleteUser(payload.user_id).catch(() => {});
        await supabase.from("users").delete().eq("id", payload.user_id).catch(() => {});
      }
    } catch (manualError) {
      console.error("Manual wipe failed:", manualError);
      throw manualError;
    }
  }

  await logAudit(adminId, {
    actionType: "DELETE",
    tableName: "students",
    recordId: payload.student_id,
    oldValue: before ?? null,
  });

  return respond({ success: true });
};

const assignSupervisors = async (
  adminId: string | null,
  payload: AssignSupervisorsPayload,
) => {
  const { data: before } = await supabase
    .from("students")
    .select("supervisor_id, industry_supervisor_id")
    .eq("id", payload.student_id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("students")
    .update({
      supervisor_id: payload.supervisor_id ?? null,
      industry_supervisor_id: payload.industry_supervisor_id ?? null,
    })
    .eq("id", payload.student_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "ASSIGN_SUPERVISOR",
    tableName: "students",
    recordId: payload.student_id,
    oldValue: before ?? null,
    newValue: data,
  });

  return respond({ student: data });
};

const setStudentStatus = async (
  adminId: string | null,
  payload: SetStudentStatusPayload,
) => {
  const { data, error } = await supabase
    .from("students")
    .update({ is_active: payload.is_active })
    .eq("id", payload.student_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "STATUS_CHANGE",
    tableName: "students",
    recordId: payload.student_id,
    newValue: { is_active: payload.is_active },
  });

  return respond({ student: data });
};

const resetStudentsForNewCycle = async (
  adminId: string | null,
  payload: ResetStudentsForNewCyclePayload,
) => {
  if (payload.confirmation_text !== "RESET STUDENTS") {
    throw new Error("Confirmation text mismatch. Type RESET STUDENTS to continue.");
  }

  const { data: portalConfig, error: portalError } = await supabase
    .from("portal_settings")
    .select("student_portal_open")
    .eq("id", "1")
    .maybeSingle();

  if (portalError) {
    throw portalError;
  }

  if (portalConfig?.student_portal_open !== false) {
    throw new Error("Close the student portal before running student reset.");
  }

  const { data: studentRows, error: studentsError } = await supabase
    .from("students")
    .select("id, user_id, email, is_active, siwes_locked")
    .not("user_id", "is", null);

  if (studentsError) {
    throw studentsError;
  }

  const students = studentRows ?? [];
  if (students.length === 0) {
    return respond({
      success: true,
      totalStudents: 0,
      blockedCount: 0,
      deletedAuthCount: 0,
      message: "No student accounts found for reset.",
    });
  }

  const blocklistRows = students
    .filter((student) => !!student.email)
    .map((student) => ({
      email: String(student.email).toLowerCase().trim(),
      blocked_reason: "Blocked after SIWES termination reset",
      blocked_by_admin_id: adminId,
      source_student_id: student.id,
    }));

  if (blocklistRows.length > 0) {
    const { error: blocklistError } = await supabase
      .from("blocked_student_emails")
      .upsert(blocklistRows, { onConflict: "email" });

    if (blocklistError) {
      throw blocklistError;
    }
  }

  const uniqueUserIds = Array.from(new Set(students.map((student) => student.user_id).filter(Boolean)));
  const failedAuthDeletes: string[] = [];
  let deletedAuthCount = 0;

  for (const userId of uniqueUserIds) {
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      failedAuthDeletes.push(userId);
    } else {
      deletedAuthCount += 1;
    }
  }

  if (uniqueUserIds.length > 0) {
    await supabase
      .from("user_roles")
      .delete()
      .in("user_id", uniqueUserIds)
      .eq("role", "student");

    await supabase
      .from("profiles")
      .delete()
      .in("id", uniqueUserIds)
      .eq("role", "student");
  }

  const studentIds = students.map((student) => student.id);
  if (studentIds.length > 0) {
    const { error: updateError } = await supabase
      .from("students")
      .update({
        is_active: false,
        siwes_locked: true,
      })
      .in("id", studentIds);

    if (updateError) {
      throw updateError;
    }
  }

  await logAudit(adminId, {
    actionType: "RESET_STUDENTS",
    tableName: "students",
    newValue: {
      totalStudents: students.length,
      blockedCount: blocklistRows.length,
      deletedAuthCount,
      failedAuthDeletes,
    },
  });

  return respond({
    success: true,
    totalStudents: students.length,
    blockedCount: blocklistRows.length,
    deletedAuthCount,
    failedAuthDeletes,
  });
};

