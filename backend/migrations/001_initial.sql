-- LessonFoundry initial PostgreSQL schema. Apply once with a privileged migration role.

BEGIN;


CREATE TABLE users (
	name VARCHAR NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id)
)

;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE users FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE users FROM anon, authenticated'; END IF; END $$;


CREATE TABLE units (
	owner_id VARCHAR(36) NOT NULL, 
	title VARCHAR NOT NULL, 
	subject VARCHAR NOT NULL, 
	level VARCHAR NOT NULL, 
	exam VARCHAR NOT NULL, 
	summary TEXT NOT NULL, 
	constraints JSON NOT NULL, 
	revision INTEGER NOT NULL, 
	source_revision INTEGER NOT NULL, 
	share_token VARCHAR NOT NULL, 
	created_at VARCHAR NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id), 
	UNIQUE (share_token)
)

;

CREATE INDEX ix_units_owner_id ON units (owner_id);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE units FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE units FROM anon, authenticated'; END IF; END $$;


CREATE TABLE assets (
	unit_id VARCHAR(36) NOT NULL, 
	slot VARCHAR NOT NULL, 
	current_number INTEGER NOT NULL, 
	published_number INTEGER, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (unit_id, slot), 
	FOREIGN KEY(unit_id) REFERENCES units (id)
)

;

CREATE INDEX ix_assets_unit_id ON assets (unit_id);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE assets FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE assets FROM anon, authenticated'; END IF; END $$;


CREATE TABLE objectives (
	unit_id VARCHAR(36) NOT NULL, 
	description TEXT NOT NULL, 
	position INTEGER NOT NULL, 
	status VARCHAR NOT NULL, 
	reason TEXT NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(unit_id) REFERENCES units (id)
)

;

CREATE INDEX ix_objectives_unit_id ON objectives (unit_id);

ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE objectives FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE objectives FROM anon, authenticated'; END IF; END $$;


CREATE TABLE pack_events (
	unit_id VARCHAR(36) NOT NULL, 
	revision INTEGER NOT NULL, 
	title VARCHAR NOT NULL, 
	detail TEXT NOT NULL, 
	created_at VARCHAR NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(unit_id) REFERENCES units (id)
)

;

CREATE INDEX ix_pack_events_unit_id ON pack_events (unit_id);

ALTER TABLE pack_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE pack_events FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE pack_events FROM anon, authenticated'; END IF; END $$;


CREATE TABLE resources (
	unit_id VARCHAR(36) NOT NULL, 
	video_id VARCHAR NOT NULL, 
	title VARCHAR NOT NULL, 
	channel VARCHAR NOT NULL, 
	approved BOOLEAN NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(unit_id) REFERENCES units (id)
)

;

CREATE INDEX ix_resources_unit_id ON resources (unit_id);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE resources FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE resources FROM anon, authenticated'; END IF; END $$;


CREATE TABLE source_documents (
	unit_id VARCHAR(36) NOT NULL, 
	name VARCHAR NOT NULL, 
	current_version INTEGER NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(unit_id) REFERENCES units (id)
)

;

CREATE INDEX ix_source_documents_unit_id ON source_documents (unit_id);

ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE source_documents FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE source_documents FROM anon, authenticated'; END IF; END $$;


CREATE TABLE asset_versions (
	asset_id VARCHAR(36) NOT NULL, 
	number INTEGER NOT NULL, 
	objective_id VARCHAR(36) NOT NULL, 
	payload JSON NOT NULL, 
	state VARCHAR NOT NULL, 
	source_revision INTEGER NOT NULL, 
	model VARCHAR NOT NULL, 
	settings JSON NOT NULL, 
	change_type VARCHAR NOT NULL, 
	created_by VARCHAR(36) NOT NULL, 
	created_at VARCHAR NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (asset_id, number), 
	FOREIGN KEY(asset_id) REFERENCES assets (id), 
	FOREIGN KEY(objective_id) REFERENCES objectives (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
)

;

CREATE INDEX ix_asset_versions_asset_id ON asset_versions (asset_id);

ALTER TABLE asset_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE asset_versions FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE asset_versions FROM anon, authenticated'; END IF; END $$;


CREATE TABLE jobs (
	unit_id VARCHAR(36) NOT NULL, 
	kind VARCHAR NOT NULL, 
	asset_id VARCHAR(36), 
	expected_revision INTEGER NOT NULL, 
	state VARCHAR NOT NULL, 
	message TEXT NOT NULL, 
	created_at VARCHAR NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(unit_id) REFERENCES units (id), 
	FOREIGN KEY(asset_id) REFERENCES assets (id)
)

;

CREATE INDEX ix_jobs_unit_id ON jobs (unit_id);

CREATE INDEX ix_jobs_state ON jobs (state);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE jobs FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE jobs FROM anon, authenticated'; END IF; END $$;


CREATE TABLE source_versions (
	source_id VARCHAR(36) NOT NULL, 
	number INTEGER NOT NULL, 
	hash VARCHAR NOT NULL, 
	storage_key VARCHAR, 
	created_at VARCHAR NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (source_id, number), 
	FOREIGN KEY(source_id) REFERENCES source_documents (id)
)

;

CREATE INDEX ix_source_versions_source_id ON source_versions (source_id);

ALTER TABLE source_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE source_versions FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE source_versions FROM anon, authenticated'; END IF; END $$;


CREATE TABLE approvals (
	version_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	note TEXT NOT NULL, 
	created_at VARCHAR NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (version_id), 
	FOREIGN KEY(version_id) REFERENCES asset_versions (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
)

;

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE approvals FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE approvals FROM anon, authenticated'; END IF; END $$;


CREATE TABLE claims (
	version_id VARCHAR(36) NOT NULL, 
	statement TEXT NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(version_id) REFERENCES asset_versions (id)
)

;

CREATE INDEX ix_claims_version_id ON claims (version_id);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE claims FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE claims FROM anon, authenticated'; END IF; END $$;


CREATE TABLE quality_checks (
	version_id VARCHAR(36) NOT NULL, 
	name VARCHAR NOT NULL, 
	state VARCHAR NOT NULL, 
	detail TEXT NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(version_id) REFERENCES asset_versions (id)
)

;

CREATE INDEX ix_quality_checks_version_id ON quality_checks (version_id);

ALTER TABLE quality_checks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE quality_checks FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE quality_checks FROM anon, authenticated'; END IF; END $$;


CREATE TABLE source_chunks (
	source_version_id VARCHAR(36) NOT NULL, 
	text TEXT NOT NULL, 
	location VARCHAR NOT NULL, 
	position INTEGER NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(source_version_id) REFERENCES source_versions (id)
)

;

CREATE INDEX ix_source_chunks_source_version_id ON source_chunks (source_version_id);

ALTER TABLE source_chunks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE source_chunks FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE source_chunks FROM anon, authenticated'; END IF; END $$;


CREATE TABLE video_jobs (
	unit_id VARCHAR(36) NOT NULL, 
	script_version_id VARCHAR(36) NOT NULL, 
	job_id VARCHAR(36) NOT NULL, 
	provider VARCHAR NOT NULL, 
	state VARCHAR NOT NULL, 
	url VARCHAR, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(unit_id) REFERENCES units (id), 
	FOREIGN KEY(script_version_id) REFERENCES asset_versions (id), 
	FOREIGN KEY(job_id) REFERENCES jobs (id)
)

;

CREATE INDEX ix_video_jobs_unit_id ON video_jobs (unit_id);

ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE video_jobs FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE video_jobs FROM anon, authenticated'; END IF; END $$;


CREATE TABLE evidence (
	chunk_id VARCHAR(36) NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(chunk_id) REFERENCES source_chunks (id)
)

;

CREATE INDEX ix_evidence_chunk_id ON evidence (chunk_id);

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE evidence FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE evidence FROM anon, authenticated'; END IF; END $$;


CREATE TABLE asset_evidence (
	version_id VARCHAR(36) NOT NULL, 
	evidence_id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (version_id, evidence_id), 
	FOREIGN KEY(version_id) REFERENCES asset_versions (id), 
	FOREIGN KEY(evidence_id) REFERENCES evidence (id)
)

;

ALTER TABLE asset_evidence ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE asset_evidence FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE asset_evidence FROM anon, authenticated'; END IF; END $$;


CREATE TABLE claim_evidence (
	claim_id VARCHAR(36) NOT NULL, 
	evidence_id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (claim_id, evidence_id), 
	FOREIGN KEY(claim_id) REFERENCES claims (id), 
	FOREIGN KEY(evidence_id) REFERENCES evidence (id)
)

;

ALTER TABLE claim_evidence ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE claim_evidence FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE claim_evidence FROM anon, authenticated'; END IF; END $$;


CREATE TABLE objective_evidence (
	objective_id VARCHAR(36) NOT NULL, 
	evidence_id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (objective_id, evidence_id), 
	FOREIGN KEY(objective_id) REFERENCES objectives (id), 
	FOREIGN KEY(evidence_id) REFERENCES evidence (id)
)

;

ALTER TABLE objective_evidence ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE objective_evidence FROM PUBLIC;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON TABLE objective_evidence FROM anon, authenticated'; END IF; END $$;

COMMIT;