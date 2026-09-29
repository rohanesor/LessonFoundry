-- Migration 010: Fix classroom join lookup under RLS.
-- Classroom join codes must be verifiable by un-enrolled students during the join handshake,
-- while continuing to prevent un-enrolled students from enumerating all classrooms.
BEGIN;

GRANT USAGE ON SCHEMA lf_private TO lessonfoundry_api;

DROP FUNCTION IF EXISTS lf_private.find_classroom_by_join_code(text);
DROP FUNCTION IF EXISTS lf_private.get_classroom_for_join(text);

CREATE OR REPLACE FUNCTION lf_private.find_classroom_by_join_code(code text)
RETURNS SETOF public.classrooms
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT *
  FROM public.classrooms c
  WHERE upper(trim(c.join_code)) = upper(trim(code))
    AND c.status = 'active';
$$;

CREATE OR REPLACE FUNCTION lf_private.get_classroom_for_join(classroom_id text)
RETURNS SETOF public.classrooms
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT *
  FROM public.classrooms c
  WHERE c.id = classroom_id
    AND c.status = 'active';
$$;

REVOKE ALL ON FUNCTION lf_private.find_classroom_by_join_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lf_private.get_classroom_for_join(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION lf_private.find_classroom_by_join_code(text) TO lessonfoundry_api;
GRANT EXECUTE ON FUNCTION lf_private.get_classroom_for_join(text) TO lessonfoundry_api;

COMMIT;
