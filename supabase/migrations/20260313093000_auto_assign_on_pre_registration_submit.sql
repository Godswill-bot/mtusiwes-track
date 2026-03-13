-- Ensure school supervisor assignment exists whenever pre-registration is submitted/updated.
-- This makes assignment reliable even if frontend fallback logic fails.

CREATE OR REPLACE FUNCTION public.ensure_school_supervisor_assignment_on_pre_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_supervisor_id UUID;
  v_current_session_id UUID;
BEGIN
  -- We only care about records tied to a student and session.
  IF NEW.student_id IS NULL OR NEW.session_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Keep assignment scoped to the current active session only.
  SELECT id INTO v_current_session_id
  FROM public.academic_sessions
  WHERE is_current = TRUE
  LIMIT 1;

  IF v_current_session_id IS NULL OR NEW.session_id <> v_current_session_id THEN
    RETURN NEW;
  END IF;

  -- If already assigned for this student/session/type, sync pre_registration.supervisor_id and exit.
  SELECT sa.supervisor_id
  INTO v_existing_supervisor_id
  FROM public.supervisor_assignments sa
  WHERE sa.student_id = NEW.student_id
    AND sa.session_id = NEW.session_id
    AND sa.assignment_type = 'school_supervisor'
  ORDER BY sa.assigned_at DESC NULLS LAST
  LIMIT 1;

  IF v_existing_supervisor_id IS NOT NULL THEN
    IF NEW.supervisor_id IS DISTINCT FROM v_existing_supervisor_id THEN
      UPDATE public.pre_registration
      SET supervisor_id = v_existing_supervisor_id
      WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  -- No assignment found yet: create one via the canonical RPC-backed function.
  v_existing_supervisor_id := public.assign_student_to_school_supervisor(NEW.student_id);

  -- If assignment succeeded, mirror it on pre_registration row.
  IF v_existing_supervisor_id IS NOT NULL THEN
    UPDATE public.pre_registration
    SET supervisor_id = v_existing_supervisor_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Do not break submission flow; assignment can be retried by admin tools.
    RAISE WARNING 'ensure_school_supervisor_assignment_on_pre_registration failed for pre_registration %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_school_supervisor_assignment_trigger ON public.pre_registration;

CREATE TRIGGER ensure_school_supervisor_assignment_trigger
  AFTER INSERT OR UPDATE OF status, session_id ON public.pre_registration
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_school_supervisor_assignment_on_pre_registration();

COMMENT ON FUNCTION public.ensure_school_supervisor_assignment_on_pre_registration() IS
'Ensures a school supervisor assignment exists for a student when pre-registration is created/updated for a session.';
