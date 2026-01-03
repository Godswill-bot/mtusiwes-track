// @ts-expect-error: Deno std library - available in Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: Deno edge function - .ts extension is required in Deno
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

type TargetRole =
  | "student"
  | "industry_supervisor"
  | "school_supervisor"
  | "admin";

interface ResetPasswordPayload {
  action: "reset_password";
  target_user_id: string;
  target_role: TargetRole;
  new_password: string;
}

type AdminAuthPayload = ResetPasswordPayload;

const tableMap: Record<
  TargetRole,
  { table: string; keyColumn: string }
> = {
  student: { table: "students", keyColumn: "user_id" },
  industry_supervisor: { table: "supervisors", keyColumn: "user_id" },
  school_supervisor: { table: "supervisors", keyColumn: "user_id" },
  admin: { table: "admins", keyColumn: "user_id" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminCtx = await getAdminContext(req);
    const payload: AdminAuthPayload = await req.json();

    if (payload.action !== "reset_password") {
      return new Response(
        JSON.stringify({ error: "Unsupported action" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const target = tableMap[payload.target_role];
    if (!target) {
      return new Response(
        JSON.stringify({ error: "Unknown target role" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const hashed = await hashPassword(payload.new_password);

    const { error: authError } = await supabase.auth.admin.updateUserById(
      payload.target_user_id,
      { password: payload.new_password },
    );

    if (authError) {
      throw authError;
    }

    const { data: recordBefore } = await supabase
      .from(target.table)
      .select("id, hashed_password")
      .eq(target.keyColumn, payload.target_user_id)
      .maybeSingle();

    const { error: updateError } = await supabase
      .from(target.table)
      .update({ hashed_password: hashed })
      .eq(target.keyColumn, payload.target_user_id);

    if (updateError) {
      throw updateError;
    }

    await logAudit(adminCtx.adminId, {
      actionType: "RESET_PASSWORD",
      tableName: target.table,
      recordId: recordBefore?.id ?? payload.target_user_id,
      oldValue: { hashed_password: recordBefore?.hashed_password ?? null },
      newValue: { hashed_password: "UPDATED" },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("admin-auth-sync error", error);
    const message = (error instanceof Error ? error.message : String(error)) ?? "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden"
      ? 403
      : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


