-- Migration 015: Quiz attempts storage for adaptive learning
-- Tracks every student answer for performance analysis

BEGIN;

-- Quiz attempts table
CREATE TABLE quiz_attempts (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES users(id),
    asset_version_id VARCHAR(36) NOT NULL REFERENCES asset_versions(id),
    unit_id VARCHAR(36) NOT NULL REFERENCES units(id),
    classroom_id VARCHAR(36) REFERENCES classrooms(id),
    slot VARCHAR(50) NOT NULL,
    choice INTEGER NOT NULL CHECK (choice >= 0 AND choice <= 3),
    correct_answer INTEGER NOT NULL CHECK (correct_answer >= 0 AND correct_answer <= 3),
    is_correct BOOLEAN NOT NULL,
    objective_id VARCHAR(36) REFERENCES objectives(id),
    attempted_at VARCHAR NOT NULL
);

-- Performance query indexes
CREATE INDEX ix_quiz_attempts_student ON quiz_attempts(student_id, attempted_at DESC);
CREATE INDEX ix_quiz_attempts_unit ON quiz_attempts(unit_id);
CREATE INDEX ix_quiz_attempts_classroom ON quiz_attempts(classroom_id);
CREATE INDEX ix_quiz_attempts_objective ON quiz_attempts(objective_id);
CREATE INDEX ix_quiz_attempts_slot ON quiz_attempts(slot);

-- RLS
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE quiz_attempts FROM PUBLIC;

-- Student can read own attempts
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lessonfoundry_student') THEN
        EXECUTE 'GRANT SELECT ON quiz_attempts TO lessonfoundry_student';
    END IF;
END $$;

-- API role can read/write
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lessonfoundry_api') THEN
        EXECUTE 'GRANT SELECT, INSERT ON quiz_attempts TO lessonfoundry_api';
    END IF;
END $$;

-- Worker role can read
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lessonfoundry_worker') THEN
        EXECUTE 'GRANT SELECT ON quiz_attempts TO lessonfoundry_worker';
    END IF;
END $$;

-- RLS policies
CREATE POLICY quiz_attempts_student_read ON quiz_attempts
    FOR SELECT
    USING (
        student_id = current_setting('request.jwt.claims', true)::json->>'sub'
    );

CREATE POLICY quiz_attempts_api_read ON quiz_attempts
    FOR SELECT
    TO lessonfoundry_api
    USING (true);

CREATE POLICY quiz_attempts_api_insert ON quiz_attempts
    FOR INSERT
    TO lessonfoundry_api
    WITH CHECK (true);

-- Add topic_tags to objectives for curriculum retrieval
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS topic_tags JSON DEFAULT '[]';

COMMIT;
