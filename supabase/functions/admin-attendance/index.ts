import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getAdminContext,
  logAudit,
  supabase,
} from "../_shared/admin-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AttendanceAction =
  | "create_attendance"
  | "update_attendance"
  | "delete_attendance";

interface BasePayload {
  action: AttendanceAction;
}

interface CreateAttendancePayload extends BasePayload {
  action: "create_attendance";
  record: {
    student_id: string;
    date: string;
    check_in_time?: string | null;
    check_out_time?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    verified?: boolean;
  };
}

interface UpdateAttendancePayload extends BasePayload {
  action: "update_attendance";
  attendance_id: string;
  updates: Record<string, unknown>;
}

interface DeleteAttendancePayload extends BasePayload {
  action: "delete_attendance";
  attendance_id: string;
}

type AttendancePayload =
  | CreateAttendancePayload
  | UpdateAttendancePayload
  | DeleteAttendancePayload;

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
    const payload: AttendancePayload = await req.json();

    switch (payload.action) {
      case "create_attendance":
        return await createAttendance(adminCtx.adminId, payload);
      case "update_attendance":
        return await updateAttendance(adminCtx.adminId, payload);
      case "delete_attendance":
        return await deleteAttendance(adminCtx.adminId, payload);
      default:
        return respond({ error: "Unsupported action" }, 400);
    }
  } catch (error) {
    console.error("admin-attendance error", error);
    const message = error?.message ?? "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden"
      ? 403
      : 500;
    return respond({ error: message }, status);
  }
});

const createAttendance = async (
  adminId: string | null,
  payload: CreateAttendancePayload,
) => {
  const { data, error } = await supabase
    .from("attendance")
    .insert(payload.record)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "CREATE",
    tableName: "attendance",
    recordId: data.id,
    newValue: data,
  });

  return respond({ attendance: data });
};

const updateAttendance = async (
  adminId: string | null,
  payload: UpdateAttendancePayload,
) => {
  const { data: before } = await supabase
    .from("attendance")
    .select("*")
    .eq("id", payload.attendance_id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("attendance")
    .update(payload.updates)
    .eq("id", payload.attendance_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "UPDATE",
    tableName: "attendance",
    recordId: payload.attendance_id,
    oldValue: before ?? null,
    newValue: data,
  });

  return respond({ attendance: data });
};

const deleteAttendance = async (
  adminId: string | null,
  payload: DeleteAttendancePayload,
) => {
  const { data: before } = await supabase
    .from("attendance")
    .select("*")
    .eq("id", payload.attendance_id)
    .maybeSingle();

  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("id", payload.attendance_id);

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "DELETE",
    tableName: "attendance",
    recordId: payload.attendance_id,
    oldValue: before ?? null,
  });

  return respond({ success: true });
};


