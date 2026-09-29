# LessonFoundry — Database Migration Plan

Existing migrations: `001_initial.sql`, `002_staging_security.sql`, `003_private_storage.sql`.

---

## Migration 004: User profile extension

**Purpose**: Add email, avatar and role columns to the existing `users` table.

```sql
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'teacher';

-- Backfill: existing rows get role='teacher' (the default).
-- No data migration needed.

COMMIT;
```

**Rollback**: `ALTER TABLE users DROP COLUMN email, DROP COLUMN avatar_url, DROP COLUMN role;`

**Risk**: None. All new columns are nullable or have safe defaults. Existing
queries do not select these columns and are unaffected.

---

## Migration 005: Classrooms and membership

**Purpose**: Create the classroom and membership tables.

```sql
BEGIN;

CREATE TABLE classrooms (
    id          VARCHAR(36) NOT NULL PRIMARY KEY,
    owner_id    VARCHAR(36) NOT NULL REFERENCES users(id),
    name        VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    join_code   VARCHAR(10) NOT NULL UNIQUE,
    status      VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at  VARCHAR NOT NULL,
    updated_at  VARCHAR NOT NULL
);

CREATE INDEX ix_classrooms_owner_id ON classrooms(owner_id);
CREATE INDEX ix_classrooms_join_code ON classrooms(join_code);

ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms FORCE ROW LEVEL SECURITY;

CREATE TABLE classroom_members (
    id            VARCHAR(36) NOT NULL PRIMARY KEY,
    classroom_id  VARCHAR(36) NOT NULL REFERENCES classrooms(id),
    user_id       VARCHAR(36) NOT NULL REFERENCES users(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'active',
    joined_at     VARCHAR NOT NULL,
    UNIQUE (classroom_id, user_id)
);

CREATE INDEX ix_classroom_members_classroom ON classroom_members(classroom_id);
CREATE INDEX ix_classroom_members_user ON classroom_members(user_id);

ALTER TABLE classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_members FORCE ROW LEVEL SECURITY;

COMMIT;
```

**Rollback**: `DROP TABLE classroom_members; DROP TABLE classrooms;`

**Risk**: None. New tables, no existing data affected.

---

## Migration 006: Unit classroom and publication

**Purpose**: Link learning packs to classrooms and add publication state.

```sql
BEGIN;

ALTER TABLE units ADD COLUMN IF NOT EXISTS classroom_id VARCHAR(36) REFERENCES classrooms(id);
ALTER TABLE units ADD COLUMN IF NOT EXISTS published_at VARCHAR;

CREATE INDEX ix_units_classroom_id ON units(classroom_id);

COMMIT;
```

**Backfill**: Existing units get `classroom_id = NULL` and `published_at = NULL`.
They remain functional as standalone packs accessible via share-token.

**Rollback**: `ALTER TABLE units DROP COLUMN classroom_id, DROP COLUMN published_at;`

**Risk**: Low. Nullable FK, no existing query breaks. The `owned()` function
continues to filter by `owner_id` regardless of `classroom_id`.

---

## Migration 007: Exports table

**Purpose**: Track generated PDF exports.

```sql
BEGIN;

CREATE TABLE exports (
    id           VARCHAR(36) NOT NULL PRIMARY KEY,
    unit_id      VARCHAR(36) NOT NULL REFERENCES units(id),
    revision     INTEGER NOT NULL,
    storage_key  VARCHAR,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at   VARCHAR NOT NULL,
    completed_at VARCHAR,
    error        TEXT
);

CREATE INDEX ix_exports_unit ON exports(unit_id);

ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports FORCE ROW LEVEL SECURITY;

COMMIT;
```

**Rollback**: `DROP TABLE exports;`

---

## Migration 008: Classroom RLS policies

**Purpose**: Add RLS policies for classroom and membership tables, and extend
unit policies for student access.

```sql
BEGIN;

-- Teacher can CRUD own classrooms
CREATE POLICY classrooms_teacher_all ON classrooms
  FOR ALL TO lessonfoundry_api
  USING (owner_id = (current_setting('request.jwt.claims')::json->>'sub'))
  WITH CHECK (owner_id = (current_setting('request.jwt.claims')::json->>'sub'));

-- Student can read classrooms they've joined
CREATE POLICY classrooms_student_read ON classrooms
  FOR SELECT TO lessonfoundry_api
  USING (
    EXISTS (
      SELECT 1 FROM classroom_members m
      WHERE m.classroom_id = classrooms.id
        AND m.user_id = (current_setting('request.jwt.claims')::json->>'sub')
        AND m.status = 'active'
    )
  );

-- Worker full access
CREATE POLICY classrooms_worker ON classrooms
  FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);

-- Teacher can manage members of owned classrooms
CREATE POLICY members_teacher_all ON classroom_members
  FOR ALL TO lessonfoundry_api
  USING (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = classroom_members.classroom_id
        AND c.owner_id = (current_setting('request.jwt.claims')::json->>'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = classroom_members.classroom_id
        AND c.owner_id = (current_setting('request.jwt.claims')::json->>'sub')
    )
  );

-- Student can read own membership and insert (join)
CREATE POLICY members_student_self ON classroom_members
  FOR SELECT TO lessonfoundry_api
  USING (user_id = (current_setting('request.jwt.claims')::json->>'sub'));

CREATE POLICY members_student_join ON classroom_members
  FOR INSERT TO lessonfoundry_api
  WITH CHECK (user_id = (current_setting('request.jwt.claims')::json->>'sub'));

-- Worker full access
CREATE POLICY members_worker ON classroom_members
  FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);

-- Student can read published packs in joined classrooms
CREATE POLICY units_student_published ON units
  FOR SELECT TO lessonfoundry_api
  USING (
    published_at IS NOT NULL
    AND classroom_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM classroom_members m
      WHERE m.classroom_id = units.classroom_id
        AND m.user_id = (current_setting('request.jwt.claims')::json->>'sub')
        AND m.status = 'active'
    )
  );

-- Exports: teacher can see own; student can see for published packs
CREATE POLICY exports_teacher ON exports
  FOR ALL TO lessonfoundry_api
  USING (
    EXISTS (
      SELECT 1 FROM units u
      WHERE u.id = exports.unit_id
        AND u.owner_id = (current_setting('request.jwt.claims')::json->>'sub')
    )
  );

CREATE POLICY exports_student_read ON exports
  FOR SELECT TO lessonfoundry_api
  USING (
    status = 'completed'
    AND EXISTS (
      SELECT 1 FROM units u
      WHERE u.id = exports.unit_id
        AND u.published_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM classroom_members m
          WHERE m.classroom_id = u.classroom_id
            AND m.user_id = (current_setting('request.jwt.claims')::json->>'sub')
            AND m.status = 'active'
        )
    )
  );

CREATE POLICY exports_worker ON exports
  FOR ALL TO lessonfoundry_worker USING (true) WITH CHECK (true);

COMMIT;
```

**Rollback**: Drop each policy by name.

**Risk**: Medium. Policies use OR semantics with existing teacher-owner policies.
Must verify that teacher policies on `units` still match (they do — existing
policies check `owner_id`, new policy checks `published_at + membership`; both
allow SELECT so a teacher-owner OR a member-student can read).

---

## Migration order and dependencies

```
004 (user profile)     — no dependencies
005 (classrooms)       — depends on 004 (users.id FK)
006 (unit extension)   — depends on 005 (classrooms.id FK)
007 (exports)          — depends on 006 (units.id FK)
008 (RLS)              — depends on 005, 006, 007
```

All migrations are additive. They can be applied to a database with existing
data without data loss or downtime.
