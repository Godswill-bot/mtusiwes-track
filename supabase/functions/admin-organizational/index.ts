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

type OrgAction =
  | "update_registration"
  | "update_supervisor_contacts";

interface BasePayload {
  action: OrgAction;
  student_id: string;
}

interface UpdateRegistrationPayload extends BasePayload {
  action: "update_registration";
  organisation_name?: string;
  organisation_address?: string;
  nature_of_business?: string;
  location_size?: string;
  products_services?: string;
  period_of_training?: string;
}

interface UpdateSupervisorContactsPayload extends BasePayload {
  action: "update_supervisor_contacts";
  industry_supervisor_name?: string;
  industry_supervisor_email?: string | null;
  industry_supervisor_phone?: string | null;
  school_supervisor_name?: string | null;
  school_supervisor_email?: string | null;
}

type OrgPayload =
  | UpdateRegistrationPayload
  | UpdateSupervisorContactsPayload;

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
    const payload: OrgPayload = await req.json();

    switch (payload.action) {
      case "update_registration":
        return await updateRegistration(adminCtx.adminId, payload);
      case "update_supervisor_contacts":
        return await updateSupervisorContacts(adminCtx.adminId, payload);
      default:
        return respond({ error: "Unsupported action" }, 400);
    }
  } catch (error) {
    console.error("admin-organizational error", error);
    const message = error?.message ?? "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden"
      ? 403
      : 500;
    return respond({ error: message }, status);
  }
});

const updateRegistration = async (
  adminId: string | null,
  payload: UpdateRegistrationPayload,
) => {
  const updates = {
    organisation_name: payload.organisation_name,
    organisation_address: payload.organisation_address,
    nature_of_business: payload.nature_of_business,
    location_size: payload.location_size,
    products_services: payload.products_services,
    period_of_training: payload.period_of_training,
  };

  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  );

  const { data, error } = await supabase
    .from("students")
    .update(filteredUpdates)
    .eq("id", payload.student_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "UPDATE_ORGANIZATION",
    tableName: "students",
    recordId: payload.student_id,
    newValue: filteredUpdates,
  });

  return respond({ student: data });
};

const updateSupervisorContacts = async (
  adminId: string | null,
  payload: UpdateSupervisorContactsPayload,
) => {
  const updates = {
    industry_supervisor_name: payload.industry_supervisor_name,
    industry_supervisor_email: payload.industry_supervisor_email,
    industry_supervisor_phone: payload.industry_supervisor_phone,
    school_supervisor_name: payload.school_supervisor_name,
    school_supervisor_email: payload.school_supervisor_email,
  };

  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  );

  const { data, error } = await supabase
    .from("students")
    .update(filteredUpdates)
    .eq("id", payload.student_id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await logAudit(adminId, {
    actionType: "UPDATE_SUPERVISOR_CONTACTS",
    tableName: "students",
    recordId: payload.student_id,
    newValue: filteredUpdates,
  });

  return respond({ student: data });
};

