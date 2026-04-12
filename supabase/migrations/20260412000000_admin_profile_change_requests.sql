-- Pending admin profile changes for email/password updates

CREATE TABLE IF NOT EXISTS public.admin_profile_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  encrypted_new_password TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_profile_change_requests_admin_user_id_idx
  ON public.admin_profile_change_requests (admin_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS admin_profile_change_requests_new_email_idx
  ON public.admin_profile_change_requests (new_email);

ALTER TABLE public.admin_profile_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages admin profile change requests"
  ON public.admin_profile_change_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.set_admin_profile_change_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_profile_change_requests_updated_at ON public.admin_profile_change_requests;
CREATE TRIGGER trg_admin_profile_change_requests_updated_at
BEFORE UPDATE ON public.admin_profile_change_requests
FOR EACH ROW EXECUTE FUNCTION public.set_admin_profile_change_requests_updated_at();
