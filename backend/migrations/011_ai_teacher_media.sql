-- AI Teacher media library. Additive; does not alter existing source/RLS policies.
BEGIN;
CREATE TABLE IF NOT EXISTS public.avatars (
 id varchar(36) PRIMARY KEY,
 owner_id varchar(36) NOT NULL REFERENCES public.users(id),
 name varchar(200) NOT NULL,
 description text NOT NULL DEFAULT '',
 storage_key text NOT NULL,
 mime_type varchar(100) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'ready',
 created_at text NOT NULL
);
ALTER TABLE public.avatars ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.avatars ADD COLUMN IF NOT EXISTS source varchar(50) NOT NULL DEFAULT 'teacher_upload';
CREATE INDEX IF NOT EXISTS ix_avatars_owner ON public.avatars(owner_id);
CREATE TABLE IF NOT EXISTS public.teacher_videos (
 id varchar(36) PRIMARY KEY,
 owner_id varchar(36) NOT NULL REFERENCES public.users(id),
 pack_id varchar(36) REFERENCES public.units(id),
 avatar_id varchar(36) REFERENCES public.avatars(id),
 script_version_id varchar(36) REFERENCES public.asset_versions(id),
 title varchar(200) NOT NULL,
 description text NOT NULL DEFAULT '',
 storage_key text NOT NULL,
 mime_type varchar(100) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'ready',
 approved boolean NOT NULL DEFAULT false,
 published boolean NOT NULL DEFAULT false,
 is_demo boolean NOT NULL DEFAULT false,
 created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_teacher_videos_owner ON public.teacher_videos(owner_id);
CREATE INDEX IF NOT EXISTS ix_teacher_videos_pack ON public.teacher_videos(pack_id);
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS avatar_id varchar(36) REFERENCES public.avatars(id);
INSERT INTO storage.buckets(id,name,public,file_size_limit)
VALUES ('media','media',false,262144000)
ON CONFLICT(id) DO UPDATE SET public=false, file_size_limit=262144000;
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY lf_avatar_owner ON public.avatars FOR ALL TO authenticated USING (owner_id=(SELECT auth.uid())::text) WITH CHECK (owner_id=(SELECT auth.uid())::text);
CREATE POLICY lf_video_owner ON public.teacher_videos FOR ALL TO authenticated USING (owner_id=(SELECT auth.uid())::text) WITH CHECK (owner_id=(SELECT auth.uid())::text);
CREATE POLICY lf_media_owner_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY lf_media_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND (SELECT auth.jwt())->'app_metadata'->>'role'='teacher');
CREATE POLICY lf_media_owner_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
COMMIT;
