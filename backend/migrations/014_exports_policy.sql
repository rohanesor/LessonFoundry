-- Grant INSERT/UPDATE/SELECT on exports to lessonfoundry_api for pack owners
BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exports TO lessonfoundry_api, lessonfoundry_api_login;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'exports' AND policyname = 'exports_api_owner'
  ) THEN
    CREATE POLICY exports_api_owner ON public.exports FOR ALL TO lessonfoundry_api
      USING (
        requested_by = (SELECT auth.uid())::text
        OR EXISTS (
          SELECT 1 FROM public.units u
          WHERE u.id = exports.unit_id AND u.owner_id = (SELECT auth.uid())::text
        )
      )
      WITH CHECK (
        requested_by = (SELECT auth.uid())::text
        OR EXISTS (
          SELECT 1 FROM public.units u
          WHERE u.id = exports.unit_id AND u.owner_id = (SELECT auth.uid())::text
        )
      );
  END IF;
END $$;

COMMIT;
