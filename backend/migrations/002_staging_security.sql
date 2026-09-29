-- Apply after 001_initial.sql in a dedicated Supabase STAGING project.
-- No passwords or real project identifiers belong in migrations.
BEGIN;
CREATE SCHEMA IF NOT EXISTS lf_private;
REVOKE ALL ON SCHEMA lf_private FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lessonfoundry_api') THEN CREATE ROLE lessonfoundry_api NOLOGIN NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lessonfoundry_worker') THEN CREATE ROLE lessonfoundry_worker NOLOGIN NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lessonfoundry_student') THEN CREATE ROLE lessonfoundry_student NOLOGIN NOINHERIT NOBYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public, auth TO lessonfoundry_api, lessonfoundry_worker;
GRANT EXECUTE ON FUNCTION auth.uid() TO lessonfoundry_api, lessonfoundry_worker;
GRANT USAGE ON SCHEMA lf_private TO lessonfoundry_student;
-- The API login must be a member of api + student only. The worker uses a separate login.
-- Provision login passwords out of band; see docs/SUPABASE_STAGING.md.


ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY users_owner_read ON public.users FOR SELECT TO authenticated USING (id = (SELECT auth.uid())::text);
CREATE POLICY users_api_owner ON public.users FOR ALL TO lessonfoundry_api USING (id = (SELECT auth.uid())::text) WITH CHECK (id = (SELECT auth.uid())::text);
CREATE POLICY users_worker ON public.users FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.units FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.units TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY units_owner_read ON public.units FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid())::text);
CREATE POLICY units_api_owner ON public.units FOR ALL TO lessonfoundry_api USING (owner_id = (SELECT auth.uid())::text) WITH CHECK (owner_id = (SELECT auth.uid())::text);
CREATE POLICY units_worker ON public.units FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_documents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.source_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.source_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.source_documents TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY source_documents_owner_read ON public.source_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = source_documents.unit_id AND u.owner_id = (SELECT auth.uid())::text));
CREATE POLICY source_documents_api_owner ON public.source_documents FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = source_documents.unit_id AND u.owner_id = (SELECT auth.uid())::text)) WITH CHECK (EXISTS (SELECT 1 FROM public.units u WHERE u.id = source_documents.unit_id AND u.owner_id = (SELECT auth.uid())::text));
CREATE POLICY source_documents_worker ON public.source_documents FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.source_documents ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.source_documents ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.source_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_versions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.source_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.source_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.source_versions TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY source_versions_owner_read ON public.source_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.source_documents d WHERE d.id = source_versions.source_id));
CREATE POLICY source_versions_api_owner ON public.source_versions FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.source_documents d WHERE d.id = source_versions.source_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.source_documents d WHERE d.id = source_versions.source_id));
CREATE POLICY source_versions_worker ON public.source_versions FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.source_versions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.source_versions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_chunks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.source_chunks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.source_chunks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.source_chunks TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY source_chunks_owner_read ON public.source_chunks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.source_versions v WHERE v.id = source_chunks.source_version_id));
CREATE POLICY source_chunks_api_owner ON public.source_chunks FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.source_versions v WHERE v.id = source_chunks.source_version_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.source_versions v WHERE v.id = source_chunks.source_version_id));
CREATE POLICY source_chunks_worker ON public.source_chunks FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.source_chunks ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.source_chunks ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.evidence TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY evidence_owner_read ON public.evidence FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.source_chunks c WHERE c.id = evidence.chunk_id));
CREATE POLICY evidence_api_owner ON public.evidence FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.source_chunks c WHERE c.id = evidence.chunk_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.source_chunks c WHERE c.id = evidence.chunk_id));
CREATE POLICY evidence_worker ON public.evidence FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.evidence ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectives FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.objectives FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.objectives TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.objectives TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY objectives_owner_read ON public.objectives FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = objectives.unit_id AND u.owner_id = (SELECT auth.uid())::text));
CREATE POLICY objectives_api_owner ON public.objectives FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = objectives.unit_id AND u.owner_id = (SELECT auth.uid())::text)) WITH CHECK (EXISTS (SELECT 1 FROM public.units u WHERE u.id = objectives.unit_id AND u.owner_id = (SELECT auth.uid())::text));
CREATE POLICY objectives_worker ON public.objectives FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.assets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assets TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY assets_owner_read ON public.assets FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = assets.unit_id AND u.owner_id = (SELECT auth.uid())::text));
CREATE POLICY assets_api_owner ON public.assets FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = assets.unit_id AND u.owner_id = (SELECT auth.uid())::text)) WITH CHECK (EXISTS (SELECT 1 FROM public.units u WHERE u.id = assets.unit_id AND u.owner_id = (SELECT auth.uid())::text));
CREATE POLICY assets_worker ON public.assets FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.asset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_versions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.asset_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.asset_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.asset_versions TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY asset_versions_owner_read ON public.asset_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.assets a JOIN public.objectives o ON o.unit_id = a.unit_id WHERE a.id = asset_versions.asset_id AND o.id = asset_versions.objective_id) AND created_by = (SELECT auth.uid())::text);
CREATE POLICY asset_versions_api_owner ON public.asset_versions FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.assets a JOIN public.objectives o ON o.unit_id = a.unit_id WHERE a.id = asset_versions.asset_id AND o.id = asset_versions.objective_id) AND created_by = (SELECT auth.uid())::text) WITH CHECK (EXISTS (SELECT 1 FROM public.assets a JOIN public.objectives o ON o.unit_id = a.unit_id WHERE a.id = asset_versions.asset_id AND o.id = asset_versions.objective_id) AND created_by = (SELECT auth.uid())::text);
CREATE POLICY asset_versions_worker ON public.asset_versions FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.asset_versions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.asset_versions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.claims FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.claims TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.claims TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY claims_owner_read ON public.claims FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.asset_versions v WHERE v.id = claims.version_id));
CREATE POLICY claims_api_owner ON public.claims FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.asset_versions v WHERE v.id = claims.version_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.asset_versions v WHERE v.id = claims.version_id));
CREATE POLICY claims_worker ON public.claims FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_checks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quality_checks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.quality_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quality_checks TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY quality_checks_owner_read ON public.quality_checks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.asset_versions v WHERE v.id = quality_checks.version_id));
CREATE POLICY quality_checks_api_owner ON public.quality_checks FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.asset_versions v WHERE v.id = quality_checks.version_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.asset_versions v WHERE v.id = quality_checks.version_id));
CREATE POLICY quality_checks_worker ON public.quality_checks FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.approvals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.approvals TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY approvals_owner_read ON public.approvals FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid())::text AND EXISTS (SELECT 1 FROM public.asset_versions v WHERE v.id = approvals.version_id));
CREATE POLICY approvals_api_owner ON public.approvals FOR ALL TO lessonfoundry_api USING (user_id = (SELECT auth.uid())::text AND EXISTS (SELECT 1 FROM public.asset_versions v WHERE v.id = approvals.version_id)) WITH CHECK (user_id = (SELECT auth.uid())::text AND EXISTS (SELECT 1 FROM public.asset_versions v WHERE v.id = approvals.version_id));
CREATE POLICY approvals_worker ON public.approvals FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.pack_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pack_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pack_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pack_events TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY pack_events_owner_read ON public.pack_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = pack_events.unit_id AND u.owner_id = (SELECT auth.uid())::text));
CREATE POLICY pack_events_api_owner ON public.pack_events FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = pack_events.unit_id AND u.owner_id = (SELECT auth.uid())::text)) WITH CHECK (EXISTS (SELECT 1 FROM public.units u WHERE u.id = pack_events.unit_id AND u.owner_id = (SELECT auth.uid())::text));
CREATE POLICY pack_events_worker ON public.pack_events FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.pack_events ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.pack_events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jobs TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY jobs_owner_read ON public.jobs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = jobs.unit_id AND u.owner_id = (SELECT auth.uid())::text) AND (asset_id IS NULL OR EXISTS (SELECT 1 FROM public.assets a WHERE a.id = jobs.asset_id AND a.unit_id = jobs.unit_id)));
CREATE POLICY jobs_api_owner ON public.jobs FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = jobs.unit_id AND u.owner_id = (SELECT auth.uid())::text) AND (asset_id IS NULL OR EXISTS (SELECT 1 FROM public.assets a WHERE a.id = jobs.asset_id AND a.unit_id = jobs.unit_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.units u WHERE u.id = jobs.unit_id AND u.owner_id = (SELECT auth.uid())::text) AND (asset_id IS NULL OR EXISTS (SELECT 1 FROM public.assets a WHERE a.id = jobs.asset_id AND a.unit_id = jobs.unit_id)));
CREATE POLICY jobs_worker ON public.jobs FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_jobs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.video_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.video_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.video_jobs TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY video_jobs_owner_read ON public.video_jobs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.asset_versions v JOIN public.assets a ON a.id = v.asset_id JOIN public.jobs j ON j.unit_id = a.unit_id WHERE v.id = video_jobs.script_version_id AND j.id = video_jobs.job_id AND a.unit_id = video_jobs.unit_id));
CREATE POLICY video_jobs_api_owner ON public.video_jobs FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.asset_versions v JOIN public.assets a ON a.id = v.asset_id JOIN public.jobs j ON j.unit_id = a.unit_id WHERE v.id = video_jobs.script_version_id AND j.id = video_jobs.job_id AND a.unit_id = video_jobs.unit_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.asset_versions v JOIN public.assets a ON a.id = v.asset_id JOIN public.jobs j ON j.unit_id = a.unit_id WHERE v.id = video_jobs.script_version_id AND j.id = video_jobs.job_id AND a.unit_id = video_jobs.unit_id));
CREATE POLICY video_jobs_worker ON public.video_jobs FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.resources FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.resources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resources TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY resources_owner_read ON public.resources FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = resources.unit_id AND u.owner_id = (SELECT auth.uid())::text));
CREATE POLICY resources_api_owner ON public.resources FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = resources.unit_id AND u.owner_id = (SELECT auth.uid())::text)) WITH CHECK (EXISTS (SELECT 1 FROM public.units u WHERE u.id = resources.unit_id AND u.owner_id = (SELECT auth.uid())::text));
CREATE POLICY resources_worker ON public.resources FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.objective_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_evidence FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.objective_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.objective_evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.objective_evidence TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY objective_evidence_owner_read ON public.objective_evidence FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.objectives o JOIN public.evidence e ON e.id = objective_evidence.evidence_id JOIN public.source_chunks c ON c.id = e.chunk_id JOIN public.source_versions sv ON sv.id = c.source_version_id JOIN public.source_documents sd ON sd.id = sv.source_id WHERE o.id = objective_evidence.objective_id AND o.unit_id = sd.unit_id));
CREATE POLICY objective_evidence_api_owner ON public.objective_evidence FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.objectives o JOIN public.evidence e ON e.id = objective_evidence.evidence_id JOIN public.source_chunks c ON c.id = e.chunk_id JOIN public.source_versions sv ON sv.id = c.source_version_id JOIN public.source_documents sd ON sd.id = sv.source_id WHERE o.id = objective_evidence.objective_id AND o.unit_id = sd.unit_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.objectives o JOIN public.evidence e ON e.id = objective_evidence.evidence_id JOIN public.source_chunks c ON c.id = e.chunk_id JOIN public.source_versions sv ON sv.id = c.source_version_id JOIN public.source_documents sd ON sd.id = sv.source_id WHERE o.id = objective_evidence.objective_id AND o.unit_id = sd.unit_id));
CREATE POLICY objective_evidence_worker ON public.objective_evidence FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.objective_evidence ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.objective_evidence ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.asset_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_evidence FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.asset_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.asset_evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.asset_evidence TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY asset_evidence_owner_read ON public.asset_evidence FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.asset_versions v JOIN public.assets a ON a.id = v.asset_id JOIN public.evidence e ON e.id = asset_evidence.evidence_id JOIN public.source_chunks c ON c.id = e.chunk_id JOIN public.source_versions sv ON sv.id = c.source_version_id JOIN public.source_documents sd ON sd.id = sv.source_id WHERE v.id = asset_evidence.version_id AND a.unit_id = sd.unit_id));
CREATE POLICY asset_evidence_api_owner ON public.asset_evidence FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.asset_versions v JOIN public.assets a ON a.id = v.asset_id JOIN public.evidence e ON e.id = asset_evidence.evidence_id JOIN public.source_chunks c ON c.id = e.chunk_id JOIN public.source_versions sv ON sv.id = c.source_version_id JOIN public.source_documents sd ON sd.id = sv.source_id WHERE v.id = asset_evidence.version_id AND a.unit_id = sd.unit_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.asset_versions v JOIN public.assets a ON a.id = v.asset_id JOIN public.evidence e ON e.id = asset_evidence.evidence_id JOIN public.source_chunks c ON c.id = e.chunk_id JOIN public.source_versions sv ON sv.id = c.source_version_id JOIN public.source_documents sd ON sd.id = sv.source_id WHERE v.id = asset_evidence.version_id AND a.unit_id = sd.unit_id));
CREATE POLICY asset_evidence_worker ON public.asset_evidence FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.asset_evidence ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.asset_evidence ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_evidence FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.claim_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.claim_evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.claim_evidence TO lessonfoundry_api, lessonfoundry_worker;
CREATE POLICY claim_evidence_owner_read ON public.claim_evidence FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.claims cl JOIN public.asset_versions v ON v.id = cl.version_id JOIN public.assets a ON a.id = v.asset_id JOIN public.evidence e ON e.id = claim_evidence.evidence_id JOIN public.source_chunks c ON c.id = e.chunk_id JOIN public.source_versions sv ON sv.id = c.source_version_id JOIN public.source_documents sd ON sd.id = sv.source_id WHERE cl.id = claim_evidence.claim_id AND a.unit_id = sd.unit_id));
CREATE POLICY claim_evidence_api_owner ON public.claim_evidence FOR ALL TO lessonfoundry_api USING (EXISTS (SELECT 1 FROM public.claims cl JOIN public.asset_versions v ON v.id = cl.version_id JOIN public.assets a ON a.id = v.asset_id JOIN public.evidence e ON e.id = claim_evidence.evidence_id JOIN public.source_chunks c ON c.id = e.chunk_id JOIN public.source_versions sv ON sv.id = c.source_version_id JOIN public.source_documents sd ON sd.id = sv.source_id WHERE cl.id = claim_evidence.claim_id AND a.unit_id = sd.unit_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.claims cl JOIN public.asset_versions v ON v.id = cl.version_id JOIN public.assets a ON a.id = v.asset_id JOIN public.evidence e ON e.id = claim_evidence.evidence_id JOIN public.source_chunks c ON c.id = e.chunk_id JOIN public.source_versions sv ON sv.id = c.source_version_id JOIN public.source_documents sd ON sd.id = sv.source_id WHERE cl.id = claim_evidence.claim_id AND a.unit_id = sd.unit_id));
CREATE POLICY claim_evidence_worker ON public.claim_evidence FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);
ALTER TABLE public.claim_evidence ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.claim_evidence ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();


-- Tie app identity to Auth without rewriting the existing string PK/FK graph.
ALTER TABLE public.users ADD COLUMN auth_user_id uuid UNIQUE REFERENCES auth.users(id);
UPDATE public.users u SET auth_user_id = a.id FROM auth.users a WHERE a.id::text = u.id;
ALTER TABLE public.users ALTER COLUMN auth_user_id SET DEFAULT auth.uid();
ALTER TABLE public.users ADD CONSTRAINT users_verified_auth_identity CHECK (auth_user_id IS NOT NULL AND id = auth_user_id::text);
CREATE UNIQUE INDEX IF NOT EXISTS ux_evidence_chunk ON public.evidence(chunk_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_objective_position ON public.objectives(unit_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS ux_resource_video ON public.resources(unit_id, video_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pack_event_revision ON public.pack_events(unit_id, revision);
CREATE INDEX IF NOT EXISTS ix_asset_versions_objective ON public.asset_versions(objective_id);
CREATE INDEX IF NOT EXISTS ix_source_chunks_order ON public.source_chunks(source_version_id, position);
CREATE INDEX IF NOT EXISTS ix_video_jobs_script ON public.video_jobs(script_version_id);
CREATE INDEX IF NOT EXISTS ix_jobs_queue ON public.jobs(state, created_at);
CREATE INDEX IF NOT EXISTS ix_asset_evidence_evidence ON public.asset_evidence(evidence_id);
CREATE INDEX IF NOT EXISTS ix_claim_evidence_evidence ON public.claim_evidence(evidence_id);
CREATE INDEX IF NOT EXISTS ix_objective_evidence_evidence ON public.objective_evidence(evidence_id);
ALTER TABLE public.assets ADD CONSTRAINT assets_published_version_fk FOREIGN KEY (id, published_number) REFERENCES public.asset_versions(asset_id,number) DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION lf_private.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION lf_private.touch_updated_at() FROM PUBLIC;

CREATE FUNCTION lf_private.lock_approved_version() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.state = 'APPROVED' THEN RAISE EXCEPTION 'Approved asset versions are immutable' USING ERRCODE='42501'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION lf_private.lock_approved_version() FROM PUBLIC;
CREATE TRIGGER asset_version_lock BEFORE UPDATE OR DELETE ON public.asset_versions FOR EACH ROW EXECUTE FUNCTION lf_private.lock_approved_version();


CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER source_documents_updated_at BEFORE UPDATE ON public.source_documents FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER source_versions_updated_at BEFORE UPDATE ON public.source_versions FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER source_chunks_updated_at BEFORE UPDATE ON public.source_chunks FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER evidence_updated_at BEFORE UPDATE ON public.evidence FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER objectives_updated_at BEFORE UPDATE ON public.objectives FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER asset_versions_updated_at BEFORE UPDATE ON public.asset_versions FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER claims_updated_at BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER quality_checks_updated_at BEFORE UPDATE ON public.quality_checks FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER approvals_updated_at BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER pack_events_updated_at BEFORE UPDATE ON public.pack_events FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER video_jobs_updated_at BEFORE UPDATE ON public.video_jobs FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER resources_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER objective_evidence_updated_at BEFORE UPDATE ON public.objective_evidence FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER asset_evidence_updated_at BEFORE UPDATE ON public.asset_evidence FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();

CREATE TRIGGER claim_evidence_updated_at BEFORE UPDATE ON public.claim_evidence FOR EACH ROW EXECUTE FUNCTION lf_private.touch_updated_at();


-- Student connections have no table privileges. These narrow functions deliberately
-- preserve the existing capability-share-link semantics and return only approved fields.
-- SECURITY DEFINER owner must be the migration administrator (BYPASSRLS).
CREATE FUNCTION lf_private.student_pack(capability text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT jsonb_build_object('title',u.title,'subject',u.subject,'level',u.level,
 'assets',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'slot',a.slot,'title',v.payload->>'title','body',v.payload->>'body','options',v.payload->'options','flowchart',v.payload->'flowchart') ORDER BY a.slot)
 FROM public.assets a JOIN public.asset_versions v ON v.asset_id=a.id AND v.number=a.published_number
 WHERE a.unit_id=u.id AND a.slot <> 'video_script' AND v.state='APPROVED' AND v.source_revision=u.source_revision),'[]'::jsonb),
 'resources',COALESCE((SELECT jsonb_agg(jsonb_build_object('title',r.title,'url','https://www.youtube.com/watch?v='||r.video_id)) FROM public.resources r WHERE r.unit_id=u.id AND r.approved),'[]'::jsonb))
FROM public.units u WHERE u.share_token=capability;
$$;
CREATE FUNCTION lf_private.student_answer(capability text, version_id text, choice integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT jsonb_build_object('correct',choice=(v.payload->>'answer')::integer) ||
 CASE WHEN COALESCE((u.constraints->>'answer_reveal')::boolean,false) THEN jsonb_build_object('solution',v.payload->>'solution') ELSE '{}'::jsonb END
FROM public.units u JOIN public.assets a ON a.unit_id=u.id JOIN public.asset_versions v ON v.asset_id=a.id AND v.number=a.published_number
WHERE u.share_token=capability AND v.id=version_id AND v.state='APPROVED' AND v.source_revision=u.source_revision AND a.slot LIKE 'quiz%' AND choice BETWEEN 0 AND 3;
$$;
REVOKE ALL ON FUNCTION lf_private.student_pack(text), lf_private.student_answer(text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION lf_private.student_pack(text), lf_private.student_answer(text,text,integer) TO lessonfoundry_student;
COMMIT;
