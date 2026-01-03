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

type WeekAction =
  | "update_week"
  | "set_week_status"
  | "delete_week";

interface BasePayload {
  action: WeekAction;
}

interface UpdateWeekPayload extends BasePayload {
  action: "update_week";
  week_id: string;
  updates: Record<string, unknown>;
}

interface SetWeekStatusPayload extends BasePayload {
  action: "set_week_status";
  week_id: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  school_supervisor_comments?: string | null;
  rejection_reason?: string | null;
  forwarded_to_school?: boolean;
}

interface DeleteWeekPayload extends BasePayload {
  action: "delete_week";
  week_id: string;
}

type WeekPayload =
  | UpdateWeekPayload
  | SetWeekStatusPayload
  | DeleteWeekPayload;

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
    const payload: WeekPayload = await req.json();

    switch (payload.action) {
      case "update_week":
        return await updateWeek(adminCtx.adminId, payload);
      case "set_week_status":
        return await setWeekStatus(adminCtx.adminId, payload);
      case "delete_week":
        return await deleteWeek(adminCtx.adminId, payload);
      default:
        return respond({ error: "Unsupported action" }, 400);
    }
  } catch (error) {
    console.error("admin-weekly error", error);
    const message = error?.message ?? "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden"
      ? 403
      : 500;
    return respond({ error: message }, status);
  }
});

const updateWeek = async (
  adminId: string | null,
  payload: UpdateWeekPayload,
) => {
  const { data: before } = await supabase
    .from("weeks")
    .select("*")
    .eq("id", payload.week_id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("weeks")
    .update(payload.updates)
    .eq("id", payload.week_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "UPDATE",
    tableName: "weeks",
    recordId: payload.week_id,
    oldValue: before ?? null,
    newValue: data,
  });

  return respond({ week: data });
};

const setWeekStatus = async (
  adminId: string | null,
  payload: SetWeekStatusPayload,
) => {
  const updates: Record<string, unknown> = {
    status: payload.status,
    school_supervisor_comments: payload.school_supervisor_comments ?? null,
    rejection_reason: payload.rejection_reason ?? null,
  };

  if (typeof payload.forwarded_to_school === "boolean") {
    updates.forwarded_to_school = payload.forwarded_to_school;
  }

  if (payload.status === "approved") {
    updates.school_approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("weeks")
    .update(updates)
    .eq("id", payload.week_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "STATUS_CHANGE",
    tableName: "weeks",
    recordId: payload.week_id,
    newValue: updates,
  });

  return respond({ week: data });
};

const deleteWeek = async (
  adminId: string | null,
  payload: DeleteWeekPayload,
) => {
  const { data: before } = await supabase
    .from("weeks")
    .select("*")
    .eq("id", payload.week_id)
    .maybeSingle();

  const { error } = await supabase
    .from("weeks")
    .delete()
    .eq("id", payload.week_id);

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "DELETE",
    tableName: "weeks",
    recordId: payload.week_id,
    oldValue: before ?? null,
  });

  return respond({ success: true });
};


