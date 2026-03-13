-- Backfill school supervisor assignments for already-submitted pre-registration rows.
-- This is a one-time catch-up for students who submitted before the new trigger existed.

DO $$
DECLARE
  v_current_session_id UUID;
  v_student_id UUID;
BEGIN
  SELECT id
  INTO v_current_session_id
  FROM public.academic_sessions
  WHERE is_current = TRUE
  LIMIT 1;

  IF v_current_session_id IS NULL THEN
    RAISE NOTICE 'No current academic session. Backfill skipped.';
    RETURN;
  END IF;

  -- Step 1: Ensure assignment exists for each student with pre-registration in current session.
  FOR v_student_id IN
    SELECT DISTINCT pr.student_id
    FROM public.pre_registration pr
    WHERE pr.session_id = v_current_session_id
      AND pr.student_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.supervisor_assignments sa
        WHERE sa.student_id = pr.student_id
          AND sa.session_id = pr.session_id
          AND sa.assignment_type = 'school_supervisor'
      )
  LOOP
    BEGIN
      PERFORM public.assign_student_to_school_supervisor(v_student_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Backfill assignment failed for student %: %', v_student_id, SQLERRM;
    END;
  END LOOP;

  -- Step 2: Mirror latest assignment into pre_registration.supervisor_id.
  WITH latest_assignment AS (
    SELECT DISTINCT ON (sa.student_id, sa.session_id)
      sa.student_id,
      sa.session_id,
      sa.supervisor_id
    FROM public.supervisor_assignments sa
    WHERE sa.assignment_type = 'school_supervisor'
      AND sa.session_id = v_current_session_id
    ORDER BY sa.student_id, sa.session_id, sa.assigned_at DESC NULLS LAST
  )
  UPDATE public.pre_registration pr
  SET supervisor_id = la.supervisor_id,
      updated_at = NOW()
  FROM latest_assignment la
  WHERE pr.student_id = la.student_id
    AND pr.session_id = la.session_id
    AND pr.session_id = v_current_session_id
    AND pr.supervisor_id IS DISTINCT FROM la.supervisor_id;

  -- Step 3: Ensure students table fields used by Admin UI are synced too.
  WITH latest_assignment AS (
    SELECT DISTINCT ON (sa.student_id, sa.session_id)
      sa.student_id,
      sa.session_id,
      sa.supervisor_id
    FROM public.supervisor_assignments sa
    WHERE sa.assignment_type = 'school_supervisor'
      AND sa.session_id = v_current_session_id
    ORDER BY sa.student_id, sa.session_id, sa.assigned_at DESC NULLS LAST
  )
  UPDATE public.students s
  SET school_supervisor_name = sup.name,
      school_supervisor_email = sup.email,
      updated_at = NOW()
  FROM latest_assignment la
  JOIN public.supervisors sup ON sup.id = la.supervisor_id
  WHERE s.id = la.student_id
    AND s.school_supervisor_name IS DISTINCT FROM sup.name;
END;
$$;
