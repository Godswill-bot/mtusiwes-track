-- Blocklist table for student self-service signup after reset
CREATE TABLE IF NOT EXISTS public.blocked_student_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  blocked_reason text NOT NULL DEFAULT 'Blocked after SIWES termination reset',
  blocked_by_admin_id uuid NULL,
  source_student_id uuid NULL,
  blocked_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blocked_student_emails_email_lower_key
  ON public.blocked_student_emails (lower(email));

ALTER TABLE public.blocked_student_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage blocked student emails" ON public.blocked_student_emails;
CREATE POLICY "Admins can manage blocked student emails"
  ON public.blocked_student_emails
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_student_email_blocked(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blocked_student_emails
    WHERE lower(email) = lower(trim(p_email))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_student_email_blocked(text) TO anon, authenticated, service_role;
