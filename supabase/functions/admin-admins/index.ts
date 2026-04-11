/// <reference lib="dom" />
// @ts-expect-error: Deno std library - available in Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getAdminContext,
  hashPassword,
  logAudit,
  supabase,
} from "../_shared/admin-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminAction = "create_admin" | "set_admin_status";

interface BasePayload {
  action: AdminAction;
}

interface CreateAdminPayload extends BasePayload {
  action: "create_admin";
  full_name: string;
  email: string;
  password: string;
}

interface SetAdminStatusPayload extends BasePayload {
  action: "set_admin_status";
  admin_id: string;
  is_active: boolean;
}

type AdminPayload = CreateAdminPayload | SetAdminStatusPayload;

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
    const payload: AdminPayload = await req.json();

    switch (payload.action) {
      case "create_admin":
        return await createAdmin(adminCtx.adminId, payload);
      case "set_admin_status":
        return await setAdminStatus(adminCtx.adminId, payload);
      default:
        return respond({ error: "Unsupported action" }, 400);
    }
  } catch (error) {
    console.error("admin-admins error", error);
    const message = (error as Error)?.message ?? "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return respond({ error: message }, status);
  }
});

const createAdmin = async (actorAdminId: string | null, payload: CreateAdminPayload) => {
  if (!payload.full_name?.trim()) {
    throw new Error("Full name is required");
  }

  if (!payload.email?.includes("@")) {
    throw new Error("Valid email address is required");
  }

  if (!payload.password || payload.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  const hashed = await hashPassword(payload.password);

  const { data: existingAdmins } = await supabase
    .from("admins")
    .select("id")
    .eq("email", normalizedEmail)
    .limit(1);

  if ((existingAdmins || []).length > 0) {
    throw new Error("An admin account with this email already exists");
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      full_name: payload.full_name.trim(),
      role: "admin",
    },
  });

  if (authError || !authUser?.user?.id) {
    throw authError ?? new Error("Failed to create auth user");
  }

  const userId = authUser.user.id;

  const { data: adminRecord, error: adminError } = await supabase
    .from("admins")
    .insert({
      user_id: userId,
      full_name: payload.full_name.trim(),
      email: normalizedEmail,
      hashed_password: hashed,
      is_active: true,
      last_active_at: new Date().toISOString(),
    })
    .select("id, user_id, full_name, email, is_active, last_active_at, created_at, updated_at")
    .single();

  if (adminError) {
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
    throw adminError;
  }

  await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id" });

  await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        full_name: payload.full_name.trim(),
        role: "admin",
        email_verified: true,
      },
      { onConflict: "id" },
    );

  await logAudit(actorAdminId, {
    actionType: "CREATE",
    tableName: "admins",
    recordId: adminRecord.id,
    newValue: {
      id: adminRecord.id,
      email: adminRecord.email,
      full_name: adminRecord.full_name,
      is_active: adminRecord.is_active,
    },
  });

  return respond({ admin: adminRecord });
};

const setAdminStatus = async (actorAdminId: string | null, payload: SetAdminStatusPayload) => {
  const { data: before } = await supabase
    .from("admins")
    .select("id, user_id, full_name, email, is_active")
    .eq("id", payload.admin_id)
    .maybeSingle();

  if (!before) {
    throw new Error("Admin account not found");
  }

  if (actorAdminId && before.id === actorAdminId && !payload.is_active) {
    throw new Error("You cannot deactivate your own admin account");
  }

  const { data: admin, error } = await supabase
    .from("admins")
    .update({ is_active: payload.is_active })
    .eq("id", payload.admin_id)
    .select("id, user_id, full_name, email, is_active, last_active_at, created_at, updated_at")
    .single();

  if (error) throw error;

  await logAudit(actorAdminId, {
    actionType: "STATUS_CHANGE",
    tableName: "admins",
    recordId: payload.admin_id,
    oldValue: before,
    newValue: { is_active: payload.is_active },
  });

  return respond({ admin });
};
