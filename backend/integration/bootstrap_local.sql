-- LOCAL TEST SHIM ONLY. This is not a Supabase deployment or managed-Auth test.
DO $$ BEGIN IF current_database() <> 'lessonfoundry_security_test' THEN RAISE EXCEPTION 'Use isolated local test database'; END IF; END $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE ROLE lf_test_api_login LOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE lf_test_worker_login LOGIN NOINHERIT NOBYPASSRLS;
GRANT lessonfoundry_api, lessonfoundry_student TO lf_test_api_login;
GRANT lessonfoundry_worker TO lf_test_worker_login;
-- Storage schema stand-in to exercise SQL policies, not a Storage HTTP service.
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text, public boolean,file_size_limit bigint);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text UNIQUE);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
