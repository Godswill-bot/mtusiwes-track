// @ts-expect-error: Deno edge function - imports work at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-expect-error: Deno edge function - imports work at runtime
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// @ts-expect-error: Deno global is available in Deno runtime
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
// @ts-expect-error: Deno global is available in Deno runtime
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface AdminContext {
  userId: string;
  adminId: string | null;
}

export const getAdminContext = async (req: Request): Promise<AdminContext> => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError || !roleData) {
    throw new Error("Forbidden");
  }

  const { data: adminRecord } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    adminId: adminRecord?.id ?? null,
  };
};

export const hashPassword = async (password: string) => {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  return await hash(password);
};

interface AuditPayload {
  actionType: string;
  tableName: string;
  recordId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

export const logAudit = async (
  adminId: string | null,
  payload: AuditPayload,
) => {
  // Get admin email for logging
  let adminEmail = null;
  if (adminId) {
    const { data: admin } = await supabase
      .from("admins")
      .select("email")
      .eq("id", adminId)
      .maybeSingle();
    adminEmail = admin?.email || null;
  }

  // Create audit log with enhanced fields
  await supabase.from("audit_logs").insert({
    admin_id: adminId,
    user_id: null, // Admin action
    user_type: "admin",
    user_email: adminEmail,
    action_type: payload.actionType,
    table_name: payload.tableName,
    record_id: payload.recordId ?? null,
    old_value: payload.oldValue ?? null,
    new_value: payload.newValue ?? null,
    description: `${payload.actionType} on ${payload.tableName}${payload.recordId ? ` (ID: ${payload.recordId})` : ""}`,
  });

  // Create notification for other admins about admin actions
  if (adminId && payload.actionType !== "READ") {
    const { data: otherAdmins } = await supabase
      .from("admins")
      .select("id")
      .eq("is_active", true)
      .neq("id", adminId);

    if (otherAdmins && otherAdmins.length > 0) {
      const notificationTitle = `${payload.actionType} on ${payload.tableName}`;
      const notificationMessage = `Admin performed ${payload.actionType.toLowerCase()} on ${payload.tableName}${payload.recordId ? ` (ID: ${payload.recordId})` : ""}`;

      for (const otherAdmin of otherAdmins) {
        await supabase.from("admin_notifications").insert({
          admin_id: otherAdmin.id,
          notification_type: "other",
          title: notificationTitle,
          message: notificationMessage,
          related_table: payload.tableName,
          related_record_id: payload.recordId ?? null,
          is_read: false,
        });
      }
    }
  }
};

