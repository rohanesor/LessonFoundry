# LessonFoundry — Phase 4: Database Design

---

## 4.1 Existing Tables (19)

| # | Table | Purpose | PK | Key FKs | Owner scope | RLS | Required changes |
|---|---|---|---|---|---|---|---|
| 1 | `users` | User identity | `id` (UUID str) | — | self | Owner-read | ADD `email`, `avatar_url`, `role` |
| 2 | `units` | Learning packs | `id` | `owner_id → users` | owner_id | Owner-CRUD | ADD `classroom_id`, `published_at` |
| 3 | `source_documents` | Source files | `id` | `unit_id → units` | via unit | via unit owner | None |
| 4 | `source_versions` | Source revisions | `id` | `source_id → source_documents` | via source | via source owner | None |
| 5 | `source_chunks` | Text passages | `id` | `source_version_id → source_versions` | via version | via version owner | None |
| 6 | `evidence` | Traceable evidence | `id` | `chunk_id → source_chunks` | via chunk | via chunk owner | None |
| 7 | `objectives` | Learning objectives | `id` | `unit_id → units` | via unit | via unit owner | None |
| 8 | `objective_evidence` | Obj ↔ evidence link | composite | `objective_id`, `evidence_id` | via objective | via objective | None |
| 9 | `assets` | Asset slots | `id` | `unit_id → units` | via unit | via unit owner | None |
| 10 | `asset_versions` | Versioned content | `id` | `asset_id → assets` | via asset | via asset owner | None |
| 11 | `asset_evidence` | Version ↔ evidence link | composite | `version_id`, `evidence_id` | via version | via version | None |
| 12 | `claims` | Generated claims | `id` | `version_id → asset_versions` | via version | via version | None |
| 13 | `claim_evidence` | Claim ↔ evidence link | composite | `claim_id`, `evidence_id` | via claim | via claim | None |
| 14 | `quality_checks` | Validation results | `id` | `version_id → asset_versions` | via version | via version | None |
| 15 | `approvals` | Teacher attestations | `id` | `version_id → asset_versions` | via version | via version | None |
| 16 | `pack_events` | Version timeline | `id` | `unit_id → units` | via unit | via unit owner | None |
| 17 | `jobs` | Async tasks | `id` | `unit_id → units` | via unit | via unit owner | ADD `export` kind support |
| 18 | `video_jobs` | Avatar render tasks | `id` | `unit_id`, `job_id` | via unit | via unit owner | None |
| 19 | `resources` | YouTube resources | `id` | `unit_id → units` | via unit | via unit owner | None |

**15 of 19 tables require zero changes.**

---

## 4.2 Modified Tables

### `users` — extend

```sql
ALTER TABLE users ADD COLUMN email VARCHAR;
ALTER TABLE users ADD COLUMN avatar_url VARCHAR;
ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'teacher';
-- Existing: id VARCHAR(36) PK, name VARCHAR
```

Constraints:
- `role` must be `'teacher'` or `'student'` (enforced by CHECK or application).
- `email` is informational (Supabase Auth is the identity source).

Impact on existing code:
- `ensure_user()` in `auth.py` needs to set `email`, `avatar_url`, `role` from JWT claims.
- Existing `User(id=..., name="Teacher")` inserts remain valid (defaults apply).
- All 26 backend tests pass without changes (new columns have defaults or are nullable).

### `units` — extend

```sql
ALTER TABLE units ADD COLUMN classroom_id VARCHAR(36) REFERENCES classrooms(id);
ALTER TABLE units ADD COLUMN published_at VARCHAR;
CREATE INDEX ix_units_classroom_id ON units(classroom_id);
```

Constraints:
- `classroom_id` is nullable (existing packs have no classroom).
- `published_at` is nullable (null = not published).
- A pack can only be published if `classroom_id IS NOT NULL`.

Impact on existing code:
- `owned()` query unchanged (filters by `owner_id`).
- `pack_dict()` needs to include `classroom_id` and `published_at` in response.
- All existing tests create packs without classroom_id (null is fine).

---

## 4.3 New Tables

### `classrooms`

```sql
CREATE TABLE classrooms (
    id          VARCHAR(36) PRIMARY KEY,
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
```

Join code: `LF-XXXXX`, 5 chars from safe alphabet (28 possible chars).
Generated server-side with `secrets.token_bytes` + mapping.

Status values: `active`, `archived`.

### `classroom_members`

```sql
CREATE TABLE classroom_members (
    id            VARCHAR(36) PRIMARY KEY,
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
```

Status values: `active`, `removed`.

### `exports`

```sql
CREATE TABLE exports (
    id           VARCHAR(36) PRIMARY KEY,
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
```

Status values: `pending`, `generating`, `completed`, `failed`.

---

## 4.4 Publication Model

Publication is a **column on `units`**, not a separate table.

```sql
units.published_at VARCHAR  -- ISO timestamp or NULL
```

- `NULL` → not published (students cannot see).
- Non-null → published (students with membership can see approved assets).

Publish: `UPDATE units SET published_at = NOW() WHERE id = :id`
Unpublish: `UPDATE units SET published_at = NULL WHERE id = :id`

No separate publication history table for MVP. A `pack_events` timeline entry
is created on publish/unpublish for audit trail.

---

## 4.5 Versioning

| Entity | Current version field | Approved version field | Published version | Immutable |
|---|---|---|---|---|
| Pack (`units`) | `revision` (bumped on each change) | N/A (derived from assets) | `published_at` (flag) | `revision` is append-only |
| Asset (`assets`) | `current_number` | `published_number` | Same as approved published | Approved versions locked by trigger |
| Source (`source_documents`) | `current_version` | N/A | N/A | Versions append-only |
| Asset version (`asset_versions`) | `number` | `state = 'APPROVED'` | Same | Immutable once approved |

Creating a new draft from an approved asset increments `current_number` but
`published_number` remains at the approved version. Students see `published_number`.

---

## 4.6 RLS Design

### RLS policy matrix

| Table | Teacher (owner) | Student (member) | Worker |
|---|---|---|---|
| `users` | Read/write own | Read own | Full |
| `classrooms` | CRUD where `owner_id = uid` | Read where active member | Full |
| `classroom_members` | CRUD where classroom owned | Read/insert own membership | Full |
| `units` | CRUD where `owner_id = uid` | Read where member of classroom + published | Full |
| `assets` | Via unit ownership | Read via published unit | Full |
| `asset_versions` | Via unit ownership | Read via published unit + approved | Full |
| `source_documents` | Via unit ownership | — | Full |
| `evidence` | Via unit ownership | — | Full |
| `quality_checks` | Via unit ownership | — | Full |
| `approvals` | Via unit ownership | — | Full |
| `exports` | Via unit ownership | Read where member + published | Full |
| All other tables | Via unit ownership | — | Full |

### Student classroom policy (example)

```sql
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
```

### Student published-pack policy (example)

```sql
CREATE POLICY units_student_read ON units
  FOR SELECT TO lessonfoundry_api
  USING (
    published_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM classroom_members m
      WHERE m.classroom_id = units.classroom_id
        AND m.user_id = (current_setting('request.jwt.claims')::json->>'sub')
        AND m.status = 'active'
    )
  );
```

Note: teacher-owner policies also match, so policies use OR semantics.

---

## 4.7 State Machine (formal)

### Pack derived state transitions

| Current | Trigger | Next | Actor | Preconditions |
|---|---|---|---|---|
| DRAFT | Generate clicked | GENERATING | Teacher | ≥1 supported objective, ≥1 evidence |
| GENERATING | Job succeeds | READY_FOR_REVIEW | Worker | All 11 assets created |
| GENERATING | Job fails | DRAFT | Worker | No assets committed |
| READY_FOR_REVIEW | Edit/regenerate | DRAFT | Teacher | — |
| READY_FOR_REVIEW | Approve all | APPROVED | Teacher | No FAIL checks |
| APPROVED | Publish | PUBLISHED | Teacher | `classroom_id IS NOT NULL` |
| PUBLISHED | Unpublish | APPROVED | Teacher | — |
| APPROVED | Create new draft | DRAFT | Teacher | — |
| PUBLISHED | Create new draft | PUBLISHED* | Teacher | Published version remains; new draft is current |

*When a teacher creates a new draft from a published pack, the published
version continues to be served to students while the teacher works on the new
draft. The pack state is effectively both PUBLISHED and has a DRAFT asset.

### Invalid transitions

- Student cannot trigger any transition.
- Cannot publish without classroom.
- Cannot publish without approved assets.
- Cannot approve with FAIL checks.
- Cannot generate without supported objectives.

---

## 4.8 Complete Data Flow

```
TEACHER LOGIN
  Frontend: supabase.auth.signInWithOAuth({provider:'google'})
  Supabase: Google OAuth → JWT with role claim
  Frontend: stores session, reads JWT
  Backend:  teacher() dependency verifies JWT, calls ensure_user()
  DB:       users row created/updated

CREATE CLASSROOM
  Frontend: POST /api/classrooms {name, description}
  Backend:  teacher() → generate join_code → INSERT classrooms
  DB:       classrooms row, pack_events entry

CREATE PACK IN CLASSROOM
  Frontend: POST /api/classrooms/{cid}/packs {title, objectives, ...}
  Backend:  verify classroom ownership → INSERT units with classroom_id
  DB:       units row with classroom_id set

UPLOAD SOURCE
  Frontend: POST /api/packs/{pid}/sources (multipart file)
  Backend:  FileExtractor → ObjectStore.put() → add_source()
  DB:       source_documents, source_versions, source_chunks, evidence
  S3:       sources/{user_id}/{source_id}/{version_id}/original.pdf

GENERATION
  Frontend: POST /api/packs/{pid}/generate
  Backend:  queue(unit, "generate")
  DB:       jobs row (Queued)
  Worker:   claims job → calls Claude → new_version() × 11 → Succeeded
  DB:       assets, asset_versions, quality_checks, claims, etc.

APPROVAL
  Frontend: POST /api/packs/{pid}/approve {note}
  Backend:  verify no FAIL checks → approve() for each asset
  DB:       approvals rows, asset_versions.state=APPROVED, assets.published_number set

PUBLICATION
  Frontend: POST /api/packs/{pid}/publish
  Backend:  verify approved → UPDATE units SET published_at = now()
  DB:       units.published_at set, pack_events entry
  Worker:   (optional) export job queued

STUDENT LOGIN
  Frontend: supabase.auth.signInWithOAuth({provider:'google'})
  Supabase: Google OAuth → JWT with role=student
  Backend:  student() dependency verifies JWT

JOIN CLASSROOM
  Frontend: POST /api/classrooms/{cid}/join {code: "LF-7K29Q"}
  Backend:  verify code matches → INSERT classroom_members
  DB:       classroom_members row

VIEW PUBLISHED PACK
  Frontend: GET /api/student/packs/{pid}
  Backend:  verify membership + published + approved → return assets
  DB:       read assets, asset_versions WHERE state=APPROVED AND source_revision match

DOWNLOAD
  Frontend: POST /api/student/packs/{pid}/download
  Backend:  verify membership + published + approved + export exists
  S3:       create_download_url(key, expires=300)
  Response: { url, expires_in }
```
