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

type SupervisorType = "industry_supervisor" | "school_supervisor";

type SupervisorAction =
  | "create_supervisor"
  | "update_supervisor"
  | "delete_supervisor"
  | "set_supervisor_status"
  | "assign_students";

interface BasePayload {
  action: SupervisorAction;
}

interface CreateSupervisorPayload extends BasePayload {
  action: "create_supervisor";
  email: string;
  password: string;
  name: string;
  phone?: string;
  supervisor_type: SupervisorType;
}

interface UpdateSupervisorPayload extends BasePayload {
  action: "update_supervisor";
  supervisor_id: string;
  updates: Partial<{
    name: string;
    email: string;
    phone: string | null;
  }>;
}

interface DeleteSupervisorPayload extends BasePayload {
  action: "delete_supervisor";
  supervisor_id: string;
  user_id: string;
}

interface SetSupervisorStatusPayload extends BasePayload {
  action: "set_supervisor_status";
  supervisor_id: string;
  is_active: boolean;
}

interface AssignStudentsPayload extends BasePayload {
  action: "assign_students";
  supervisor_id: string;
  supervisor_type: SupervisorType;
  student_ids: string[];
}

type SupervisorPayload =
  | CreateSupervisorPayload
  | UpdateSupervisorPayload
  | DeleteSupervisorPayload
  | SetSupervisorStatusPayload
  | AssignStudentsPayload;

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
    const payload: SupervisorPayload = await req.json();

    switch (payload.action) {
      case "create_supervisor":
        return await createSupervisor(adminCtx.adminId, payload);
      case "update_supervisor":
        return await updateSupervisor(adminCtx.adminId, payload);
      case "delete_supervisor":
        return await deleteSupervisor(adminCtx.adminId, payload);
      case "set_supervisor_status":
        return await setSupervisorStatus(adminCtx.adminId, payload);
      case "assign_students":
        return await assignStudents(adminCtx.adminId, payload);
      default:
        return respond({ error: "Unsupported action" }, 400);
    }
  } catch (error) {
    console.error("admin-supervisors error", error);
    const message = error?.message ?? "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden"
      ? 403
      : 500;
    return respond({ error: message }, status);
  }
});

const createSupervisor = async (
  adminId: string | null,
  payload: CreateSupervisorPayload,
) => {
  const hashed = await hashPassword(payload.password);

  const { data: authUser, error: authError } = await supabase
    .auth
    .admin
    .createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.name,
        role: payload.supervisor_type,
      },
    });

  if (authError || !authUser) {
    throw authError ?? new Error("Failed to create auth user");
  }

  const { data: supervisor, error: insertError } = await supabase
    .from("supervisors")
    .insert({
      user_id: authUser.user.id,
      name: payload.name,
      email: payload.email,
      phone: payload.phone ?? null,
      supervisor_type: payload.supervisor_type,
      hashed_password: hashed,
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  await logAudit(adminId, {
    actionType: "CREATE",
    tableName: "supervisors",
    recordId: supervisor.id,
    newValue: supervisor,
  });

  return respond({ supervisor });
};

const updateSupervisor = async (
  adminId: string | null,
  payload: UpdateSupervisorPayload,
) => {
  const { data: before } = await supabase
    .from("supervisors")
    .select("*")
    .eq("id", payload.supervisor_id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("supervisors")
    .update(payload.updates)
    .eq("id", payload.supervisor_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "UPDATE",
    tableName: "supervisors",
    recordId: payload.supervisor_id,
    oldValue: before ?? null,
    newValue: data,
  });

  return respond({ supervisor: data });
};

const deleteSupervisor = async (
  adminId: string | null,
  payload: DeleteSupervisorPayload,
) => {
  const { data: before } = await supabase
    .from("supervisors")
    .select("*")
    .eq("id", payload.supervisor_id)
    .maybeSingle();

  const { error } = await supabase
    .from("supervisors")
    .delete()
    .eq("id", payload.supervisor_id);

  if (error) {
    throw error;
  }

  await supabase.auth.admin.deleteUser(payload.user_id);

  await logAudit(adminId, {
    actionType: "DELETE",
    tableName: "supervisors",
    recordId: payload.supervisor_id,
    oldValue: before ?? null,
  });

  return respond({ success: true });
};

const setSupervisorStatus = async (
  adminId: string | null,
  payload: SetSupervisorStatusPayload,
) => {
  const { data, error } = await supabase
    .from("supervisors")
    .update({ is_active: payload.is_active })
    .eq("id", payload.supervisor_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "STATUS_CHANGE",
    tableName: "supervisors",
    recordId: payload.supervisor_id,
    newValue: { is_active: payload.is_active },
  });

  return respond({ supervisor: data });
};

const assignStudents = async (
  adminId: string | null,
  payload: AssignStudentsPayload,
) => {
  if (!payload.student_ids.length) {
    return respond({ success: true });
  }

  const column =
    payload.supervisor_type === "school_supervisor"
      ? "supervisor_id"
      : "industry_supervisor_id";

  const { error } = await supabase
    .from("students")
    .update({ [column]: payload.supervisor_id })
    .in("id", payload.student_ids);

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "ASSIGN_STUDENTS",
    tableName: "students",
    recordId: payload.supervisor_id,
    newValue: { student_ids: payload.student_ids, column },
  });

  return respond({ success: true });
};

