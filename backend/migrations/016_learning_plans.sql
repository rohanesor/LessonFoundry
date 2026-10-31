-- Migration 016: Learning plans and coding problems for adaptive learning
-- Supports Requirements 3 and 4

BEGIN;

-- Learning plans table
CREATE TABLE learning_plans (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES users(id),
    classroom_id VARCHAR(36) NOT NULL REFERENCES classrooms(id),
    weak_topics JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at VARCHAR NOT NULL,
    completed_at VARCHAR
);

CREATE INDEX ix_learning_plans_student ON learning_plans(student_id);
CREATE INDEX ix_learning_plans_classroom ON learning_plans(classroom_id);
CREATE INDEX ix_learning_plans_status ON learning_plans(status);

-- Plan items table
CREATE TABLE plan_items (
    id VARCHAR(36) PRIMARY KEY,
    plan_id VARCHAR(36) NOT NULL REFERENCES learning_plans(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 3),
    position INTEGER NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    asset_version_id VARCHAR(36) REFERENCES asset_versions(id),
    coding_problem_id VARCHAR(36),
    estimated_minutes INTEGER DEFAULT 15,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at VARCHAR
);

CREATE INDEX ix_plan_items_plan ON plan_items(plan_id);
CREATE INDEX ix_plan_items_day ON plan_items(plan_id, day_number);

-- Coding problems table
CREATE TABLE coding_problems (
    id VARCHAR(36) PRIMARY KEY,
    unit_id VARCHAR(36) REFERENCES units(id),
    topic VARCHAR(100) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    starter_code TEXT NOT NULL DEFAULT '',
    test_cases JSON NOT NULL,
    solution TEXT NOT NULL,
    hints JSON DEFAULT '[]',
    language VARCHAR(20) NOT NULL DEFAULT 'python',
    created_at VARCHAR NOT NULL
);

CREATE INDEX ix_coding_problems_topic ON coding_problems(topic);
CREATE INDEX ix_coding_problems_unit ON coding_problems(unit_id);

-- Code submissions table
CREATE TABLE code_submissions (
    id VARCHAR(36) PRIMARY KEY,
    problem_id VARCHAR(36) NOT NULL REFERENCES coding_problems(id),
    student_id VARCHAR(36) NOT NULL REFERENCES users(id),
    code TEXT NOT NULL,
    language VARCHAR(20) NOT NULL DEFAULT 'python',
    status VARCHAR(20) NOT NULL,
    stdout TEXT,
    stderr TEXT,
    test_results JSON,
    feedback TEXT,
    execution_time_ms INTEGER,
    submitted_at VARCHAR NOT NULL
);

CREATE INDEX ix_code_submissions_problem ON code_submissions(problem_id);
CREATE INDEX ix_code_submissions_student ON code_submissions(student_id, submitted_at DESC);

-- RLS for all tables
ALTER TABLE learning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_items FORCE ROW LEVEL SECURITY;
ALTER TABLE coding_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_problems FORCE ROW LEVEL SECURITY;
ALTER TABLE code_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_submissions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE learning_plans FROM PUBLIC;
REVOKE ALL ON TABLE plan_items FROM PUBLIC;
REVOKE ALL ON TABLE coding_problems FROM PUBLIC;
REVOKE ALL ON TABLE code_submissions FROM PUBLIC;

-- Grant permissions to API role
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lessonfoundry_api') THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON learning_plans TO lessonfoundry_api';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON plan_items TO lessonfoundry_api';
        EXECUTE 'GRANT SELECT, INSERT ON coding_problems TO lessonfoundry_api';
        EXECUTE 'GRANT SELECT, INSERT ON code_submissions TO lessonfoundry_api';
    END IF;
END $$;

-- Grant permissions to student role
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lessonfoundry_student') THEN
        EXECUTE 'GRANT SELECT ON learning_plans TO lessonfoundry_student';
        EXECUTE 'GRANT SELECT ON plan_items TO lessonfoundry_student';
        EXECUTE 'GRANT SELECT ON coding_problems TO lessonfoundry_student';
        EXECUTE 'GRANT SELECT ON code_submissions TO lessonfoundry_student';
    END IF;
END $$;

-- Student can only see their own plans
CREATE POLICY learning_plans_student_read ON learning_plans
    FOR SELECT
    USING (
        student_id = current_setting('request.jwt.claims', true)::json->>'sub'
    );

-- Students can see items of their own plans
CREATE POLICY plan_items_student_read ON plan_items
    FOR SELECT
    USING (
        plan_id IN (
            SELECT id FROM learning_plans 
            WHERE student_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- Coding problems are readable by all authenticated users
CREATE POLICY coding_problems_read ON coding_problems
    FOR SELECT
    USING (true);

-- Students can only see their own submissions
CREATE POLICY code_submissions_student_read ON code_submissions
    FOR SELECT
    USING (
        student_id = current_setting('request.jwt.claims', true)::json->>'sub'
    );

-- API role has full access
CREATE POLICY learning_plans_api ON learning_plans FOR ALL TO lessonfoundry_api USING (true);
CREATE POLICY plan_items_api ON plan_items FOR ALL TO lessonfoundry_api USING (true);
CREATE POLICY coding_problems_api ON coding_problems FOR ALL TO lessonfoundry_api USING (true);
CREATE POLICY code_submissions_api ON code_submissions FOR ALL TO lessonfoundry_api USING (true);

COMMIT;
