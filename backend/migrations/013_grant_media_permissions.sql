-- Grant media permissions for avatars and teacher_videos to API and worker roles.
BEGIN;

GRANT USAGE ON SCHEMA public TO lessonfoundry_api, lessonfoundry_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.avatars, public.teacher_videos TO lessonfoundry_api, lessonfoundry_worker;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lessonfoundry_api_login') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO lessonfoundry_api_login';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.avatars, public.teacher_videos TO lessonfoundry_api_login';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lessonfoundry_worker_login') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO lessonfoundry_worker_login';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.avatars, public.teacher_videos TO lessonfoundry_worker_login';
  END IF;
END $$;
UPDATE public.teacher_videos v SET published=true FROM public.units u WHERE v.pack_id=u.id AND v.approved=true AND u.published_at IS NOT NULL;

-- RLS policies for lessonfoundry_api on avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avatars' AND policyname = 'avatars_api_owner'
  ) THEN
    CREATE POLICY avatars_api_owner ON public.avatars FOR ALL TO lessonfoundry_api
      USING (owner_id = (SELECT auth.uid())::text)
      WITH CHECK (owner_id = (SELECT auth.uid())::text);
  END IF;
END $$;

-- RLS policies for lessonfoundry_api on teacher_videos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teacher_videos' AND policyname = 'teacher_videos_api_owner'
  ) THEN
    CREATE POLICY teacher_videos_api_owner ON public.teacher_videos FOR ALL TO lessonfoundry_api
      USING (owner_id = (SELECT auth.uid())::text)
      WITH CHECK (owner_id = (SELECT auth.uid())::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teacher_videos' AND policyname = 'teacher_videos_api_member_read'
  ) THEN
    CREATE POLICY teacher_videos_api_member_read ON public.teacher_videos FOR SELECT TO lessonfoundry_api
      USING (
        published = true
        AND pack_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.units u
          JOIN public.classroom_members cm ON cm.classroom_id = u.classroom_id
          WHERE u.id = teacher_videos.pack_id
            AND cm.user_id = (SELECT auth.uid())::text
            AND cm.status = 'active'
        )
      );
  END IF;
END $$;

-- RLS policies for lessonfoundry_worker
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avatars' AND policyname = 'avatars_worker_all'
  ) THEN
    CREATE POLICY avatars_worker_all ON public.avatars FOR ALL TO lessonfoundry_worker
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teacher_videos' AND policyname = 'teacher_videos_worker_all'
  ) THEN
    CREATE POLICY teacher_videos_worker_all ON public.teacher_videos FOR ALL TO lessonfoundry_worker
      USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;
