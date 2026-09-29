-- Migration 008: classroom/publication RLS for the Phase 5 classroom model.
-- Apply after 001-007 and 002_staging_security.sql with the migration admin.
-- This migration is additive/idempotent: it does not drop tables or data.
BEGIN;

-- The API login SET LOCAL ROLE lessonfoundry_api for a verified JWT subject.
-- The worker remains intentionally unrestricted within its restricted worker role.
GRANT USAGE ON SCHEMA public TO lessonfoundry_api, lessonfoundry_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.classrooms, public.classroom_members, public.exports TO lessonfoundry_api, lessonfoundry_worker;

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports FORCE ROW LEVEL SECURITY;

-- SECURITY DEFINER helpers avoid recursive RLS evaluation between classrooms and
-- memberships. They are not callable by browser roles and accept only the JWT
-- subject supplied by the API transaction.
CREATE OR REPLACE FUNCTION lf_private.is_classroom_owner(classroom text, person text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom AND c.owner_id = person);
$$;
CREATE OR REPLACE FUNCTION lf_private.is_active_classroom_member(classroom text, person text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.classroom_members cm WHERE cm.classroom_id = classroom AND cm.user_id = person AND cm.status = 'active');
$$;
CREATE OR REPLACE FUNCTION lf_private.is_active_classroom(classroom text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom AND c.status = 'active');
$$;
CREATE OR REPLACE FUNCTION lf_private.can_read_classroom_profile(profile text, requester text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT profile = requester OR EXISTS (
    SELECT 1 FROM public.classrooms c JOIN public.classroom_members cm ON cm.classroom_id = c.id
    WHERE (c.owner_id = profile AND cm.user_id = requester AND cm.status = 'active')
       OR (cm.user_id = profile AND c.owner_id = requester)
  );
$$;
REVOKE ALL ON FUNCTION lf_private.is_classroom_owner(text,text), lf_private.is_active_classroom_member(text,text), lf_private.is_active_classroom(text), lf_private.can_read_classroom_profile(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION lf_private.is_classroom_owner(text,text), lf_private.is_active_classroom_member(text,text), lf_private.is_active_classroom(text), lf_private.can_read_classroom_profile(text,text) TO lessonfoundry_api;

-- Classroom owners can manage their classrooms; active members may only see the
-- classroom to which they belong. Join codes are never exposed by student APIs.
DROP POLICY IF EXISTS classrooms_api_owner ON public.classrooms;
CREATE POLICY classrooms_api_owner ON public.classrooms FOR ALL TO lessonfoundry_api
  USING (owner_id = (SELECT auth.uid())::text)
  WITH CHECK (owner_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS classrooms_api_member_read ON public.classrooms;
CREATE POLICY classrooms_api_member_read ON public.classrooms FOR SELECT TO lessonfoundry_api
  USING (lf_private.is_active_classroom_member(classrooms.id, (SELECT auth.uid())::text));
DROP POLICY IF EXISTS classrooms_worker ON public.classrooms;
CREATE POLICY classrooms_worker ON public.classrooms FOR ALL TO lessonfoundry_worker
  USING (true) WITH CHECK (true);

-- A student may create/reactivate only their own membership in an active class;
-- the teacher may view and manage members of classes they own.
DROP POLICY IF EXISTS classroom_members_api_self_or_owner_read ON public.classroom_members;
CREATE POLICY classroom_members_api_self_or_owner_read ON public.classroom_members FOR SELECT TO lessonfoundry_api
  USING (user_id = (SELECT auth.uid())::text OR lf_private.is_classroom_owner(classroom_id, (SELECT auth.uid())::text));
DROP POLICY IF EXISTS classroom_members_api_student_join ON public.classroom_members;
CREATE POLICY classroom_members_api_student_join ON public.classroom_members FOR INSERT TO lessonfoundry_api
  WITH CHECK (user_id = (SELECT auth.uid())::text AND lf_private.is_active_classroom(classroom_id));
DROP POLICY IF EXISTS classroom_members_api_owner_update ON public.classroom_members;
CREATE POLICY classroom_members_api_owner_update ON public.classroom_members FOR UPDATE TO lessonfoundry_api
  USING (lf_private.is_classroom_owner(classroom_id, (SELECT auth.uid())::text))
  WITH CHECK (lf_private.is_classroom_owner(classroom_id, (SELECT auth.uid())::text));
DROP POLICY IF EXISTS classroom_members_api_owner_delete ON public.classroom_members;
CREATE POLICY classroom_members_api_owner_delete ON public.classroom_members FOR DELETE TO lessonfoundry_api
  USING (lf_private.is_classroom_owner(classroom_id, (SELECT auth.uid())::text));
DROP POLICY IF EXISTS classroom_members_worker ON public.classroom_members;
CREATE POLICY classroom_members_worker ON public.classroom_members FOR ALL TO lessonfoundry_worker
  USING (true) WITH CHECK (true);

-- Students receive only published units in classes where they are active members.
-- Existing *_api_owner policies keep all teacher draft access owner-scoped.
DROP POLICY IF EXISTS units_api_published_classroom_member_read ON public.units;
CREATE POLICY units_api_published_classroom_member_read ON public.units FOR SELECT TO lessonfoundry_api
  USING (
    published_at IS NOT NULL AND classroom_id IS NOT NULL
    AND lf_private.is_active_classroom_member(classroom_id, (SELECT auth.uid())::text)
  );
DROP POLICY IF EXISTS assets_api_published_classroom_member_read ON public.assets;
CREATE POLICY assets_api_published_classroom_member_read ON public.assets FOR SELECT TO lessonfoundry_api
  USING (EXISTS (
    SELECT 1 FROM public.units u WHERE u.id = assets.unit_id AND u.published_at IS NOT NULL
      AND lf_private.is_active_classroom_member(u.classroom_id, (SELECT auth.uid())::text)
  ));
DROP POLICY IF EXISTS asset_versions_api_published_classroom_member_read ON public.asset_versions;
CREATE POLICY asset_versions_api_published_classroom_member_read ON public.asset_versions FOR SELECT TO lessonfoundry_api
  USING (state = 'APPROVED' AND EXISTS (
    SELECT 1 FROM public.assets a JOIN public.units u ON u.id = a.unit_id
    WHERE a.id = asset_versions.asset_id AND a.published_number = asset_versions.number
      AND u.published_at IS NOT NULL
      AND lf_private.is_active_classroom_member(u.classroom_id, (SELECT auth.uid())::text)
  ));
DROP POLICY IF EXISTS resources_api_published_classroom_member_read ON public.resources;
CREATE POLICY resources_api_published_classroom_member_read ON public.resources FOR SELECT TO lessonfoundry_api
  USING (approved AND EXISTS (
    SELECT 1 FROM public.units u WHERE u.id = resources.unit_id AND u.published_at IS NOT NULL
      AND lf_private.is_active_classroom_member(u.classroom_id, (SELECT auth.uid())::text)
  ));
DROP POLICY IF EXISTS exports_api_published_classroom_member_read ON public.exports;
CREATE POLICY exports_api_published_classroom_member_read ON public.exports FOR SELECT TO lessonfoundry_api
  USING (status = 'completed' AND EXISTS (
    SELECT 1 FROM public.units u WHERE u.id = exports.unit_id AND u.published_at IS NOT NULL
      AND lf_private.is_active_classroom_member(u.classroom_id, (SELECT auth.uid())::text)
  ));
DROP POLICY IF EXISTS exports_worker ON public.exports;
CREATE POLICY exports_worker ON public.exports FOR ALL TO lessonfoundry_worker
  USING (true) WITH CHECK (true);

-- Student views need their own profile and their classroom teacher's display
-- profile; classroom owners need member profiles for their roster API only.
DROP POLICY IF EXISTS users_api_classroom_directory_read ON public.users;
CREATE POLICY users_api_classroom_directory_read ON public.users FOR SELECT TO lessonfoundry_api
  USING (lf_private.can_read_classroom_profile(id, (SELECT auth.uid())::text));

CREATE INDEX IF NOT EXISTS ix_classroom_members_active_user_classroom
  ON public.classroom_members(user_id, classroom_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS ix_units_published_classroom
  ON public.units(classroom_id, published_at) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_exports_completed_unit
  ON public.exports(unit_id, created_at DESC) WHERE status = 'completed';
COMMIT;
