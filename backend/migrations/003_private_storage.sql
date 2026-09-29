-- Supabase-specific. Apply only to a dedicated staging project after 002.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit)
VALUES ('sources','sources',false,10485760)
ON CONFLICT(id) DO UPDATE SET public=false, file_size_limit=10485760;
-- Object names: {auth.uid}/{owned-unit-id}/{upload-uuid}/{filename}.
-- Existing bucket policies must be audited separately; permissive policies OR together.
CREATE POLICY lf_source_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='sources' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND EXISTS (SELECT 1 FROM public.units u WHERE u.id=(storage.foldername(name))[2] AND u.owner_id=(SELECT auth.uid())::text));
CREATE POLICY lf_source_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='sources' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND (SELECT auth.jwt())->'app_metadata'->>'role'='teacher'
 AND EXISTS (SELECT 1 FROM public.units u WHERE u.id=(storage.foldername(name))[2] AND u.owner_id=(SELECT auth.uid())::text));
-- Source versions are immutable: there is intentionally no UPDATE policy (no upsert).
-- DELETE permits compensating cleanup after a failed database commit.
CREATE POLICY lf_source_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='sources' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND EXISTS (SELECT 1 FROM public.units u WHERE u.id=(storage.foldername(name))[2] AND u.owner_id=(SELECT auth.uid())::text));
COMMIT;
