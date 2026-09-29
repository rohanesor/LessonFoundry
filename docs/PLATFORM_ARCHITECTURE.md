# LessonFoundry — Phase 3: Target Platform Architecture

---

## 3.1 System Architecture

```
                         INTERNET
                            │
                          HTTPS
                            │
                   ┌────────┴────────┐
                   │  Nginx (TLS)    │
                   └────────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
         Next.js 15    FastAPI 0.115   Worker
         (port 3000)   (port 8000)    (same image)
              │             │             │
              └──────┬──────┘             │
                     │                    │
            ┌────────┼──────────┐         │
            │        │          │         │
        Supabase  Supabase   AWS S3   Claude API
          Auth    PostgreSQL  (private)
         (Google    + RLS
          OAuth)
```

- **Next.js** serves both teacher and student UIs. API requests are proxied
  to FastAPI via the existing `rewrites()` in `next.config.ts`.
- **FastAPI** handles all business logic, authorization, and API contracts.
- **Worker** is the same Docker image with a different entrypoint
  (`python -m app.jobs.worker`). Polls `jobs` table with `SKIP LOCKED`.
- **Supabase Auth** provides Google OAuth, JWT issuance, and session management.
- **Supabase PostgreSQL** is the single source of truth. RLS enforces row-level
  access for the API and student roles.
- **AWS S3** stores uploaded source originals and generated export PDFs.
- **Claude API** generates structured learning assets. Called by the worker only.

Redis/Valkey is **not required for MVP**. The DB-polling worker is sufficient for
a single-EC2 deployment. A Redis queue can be added later without schema changes.

---

## 3.2 Domain Architecture

### Identity

- **Responsibility**: Authentication, user profiles, role management.
- **Entities**: `users`
- **Services**: `auth.py` (JWT verification, `teacher()` / `student()` / `authenticated()` dependencies)
- **APIs**: Login is handled by Supabase client-side. `ensure_user()` upserts on first API call.
- **Auth boundary**: JWT `app_metadata.role` determines teacher vs student.

### Classroom

- **Responsibility**: Organizing students and packs into groups.
- **Entities**: `classrooms`, `classroom_members`
- **Services**: Classroom creation, join-code generation, membership management.
- **APIs**: `/api/classrooms`, `/api/classrooms/{id}/join`, `/api/classrooms/{id}/members`
- **Auth boundary**: Teacher owns classroom. Student joins via code.

### Learning Pack

- **Responsibility**: The core content unit. Unchanged from MVP.
- **Entities**: `units` (extended with `classroom_id`, `published_at`)
- **Services**: `services/packs.py` (unchanged) + new publish/unpublish.
- **APIs**: Existing pack CRUD + new classroom-scoped creation + publish/unpublish.
- **Auth boundary**: Teacher owns pack via `owner_id`. Student accesses via
  classroom membership + published + approved.

### Source & Evidence

- **Responsibility**: Trusted teaching material and traceable passages.
- **Entities**: `source_documents`, `source_versions`, `source_chunks`, `evidence`
- **Services**: `extraction.py`, `packs.py → add_source()`
- **Auth boundary**: Teacher-owner only. Unchanged.

### Generation

- **Responsibility**: Async AI content production.
- **Entities**: `jobs`, `assets`, `asset_versions`
- **Services**: Worker + LLM provider.
- **Auth boundary**: Teacher queues jobs. Worker runs as privileged role.

### Validation

- **Responsibility**: Deterministic quality checks.
- **Entities**: `quality_checks`
- **Services**: `validators/quality.py`
- **Auth boundary**: Teacher reads results. Checks run automatically.

### Approval

- **Responsibility**: Teacher attestation + immutable version lock.
- **Entities**: `approvals`
- **Services**: `packs.py → approve()`
- **Auth boundary**: Teacher-owner only. DB trigger prevents mutation.

### Publication

- **Responsibility**: Making approved packs visible to students in a classroom.
- **Entities**: `units.published_at` column.
- **Services**: New publish/unpublish functions.
- **Auth boundary**: Teacher-owner only. Requires approved assets.

### Student Learning

- **Responsibility**: Delivering approved content to authenticated students.
- **Entities**: Read-only views of `assets`, `asset_versions`, `resources`.
- **APIs**: `/api/student/classrooms`, `/api/student/packs/{id}`
- **Auth boundary**: Student + classroom member + pack published + assets approved.

### Export

- **Responsibility**: Generating downloadable PDFs from approved content.
- **Entities**: `exports` table.
- **Services**: Worker export job + PDF renderer.
- **APIs**: `/api/student/packs/{id}/download`
- **Auth boundary**: Same as student learning + export completed.

### Storage

- **Responsibility**: Object storage for sources and exports.
- **Services**: `ObjectStore` interface → `LocalObjectStore`, `SupabaseObjectStore`, `S3ObjectStore`.
- **Auth boundary**: All access via backend. No direct client-to-S3 for MVP.

### Jobs

- **Responsibility**: Async task execution.
- **Entities**: `jobs`
- **Services**: Worker poll loop.
- **Job kinds**: `gap`, `generate`, `regenerate`, `video`, `export`

---

## 3.3 User Roles

### Authentication (who you are)

Handled by Supabase Auth. Results in a JWT with:
```json
{
  "sub": "uuid",
  "app_metadata": { "role": "teacher" | "student" },
  "user_metadata": { "full_name": "...", "avatar_url": "..." }
}
```

### Authorization (what you can do)

Determined by the backend from trusted JWT claims. Never from frontend input.

```
authenticated()  → any valid JWT → yields user_id, role
teacher()        → role == "teacher" → yields user_id
student()        → role == "student" → yields user_id
```

In `AUTH_MODE=local`:
- `LOCAL_TEACHER_TOKEN` → `user_id="local-teacher"`, `role="teacher"`
- `LOCAL_STUDENT_TOKEN` → `user_id="local-student"`, `role="student"`

---

## 3.4 Classroom Architecture

```
Teacher A
   │
   ├── Classroom "Data Structures" (LF-7K29Q)
   │       ├── Student 1 (member)
   │       ├── Student 2 (member)
   │       ├── Pack: Arrays & Strings (PUBLISHED)
   │       └── Pack: Linked Lists (DRAFT)
   │
   └── Classroom "Algorithms" (LF-M4X8P)
           ├── Student 1 (member, overlapping)
           ├── Student 3 (member)
           └── Pack: Sorting (APPROVED, not yet published)
```

### Ownership

- Only the teacher who created a classroom can manage it.
- A teacher can have multiple classrooms.
- A student can be in multiple classrooms.

### Join code

- Format: `LF-XXXXX` where X ∈ `{2-9, A-H, J-N, P-T, W-Z}` (28 chars, no 0/O/1/I/L/U/V).
- ~17 million combinations. Rate-limited join endpoint prevents enumeration.
- Teacher can regenerate code via `POST /api/classrooms/{id}/regenerate-code`.

### Visibility

| Actor | Sees classroom | Sees members | Sees packs |
|---|---|---|---|
| Owner teacher | Full CRUD | Full list + remove | All (draft + approved + published) |
| Member student | Name + description | Count only | Published + approved only |
| Non-member | — | — | — |

---

## 3.5 Learning Pack Lifecycle

### State model

Pack state is **derived**, not stored as a single enum column:

| Derived state | Condition |
|---|---|
| `DRAFT` | Has no assets, OR has assets but none approved |
| `GENERATING` | Active job (`Queued` or `Running`) |
| `READY_FOR_REVIEW` | All assets generated, none approved yet |
| `APPROVED` | All assets approved, `published_at IS NULL` |
| `PUBLISHED` | All assets approved, `published_at IS NOT NULL` |
| `UNPUBLISHED` | Was published, `published_at` cleared |

This avoids a new enum column and keeps compatibility with the existing
asset-level state machine.

### Valid transitions

```
DRAFT → GENERATING                (teacher clicks Generate)
GENERATING → DRAFT                (generation fails)
GENERATING → READY_FOR_REVIEW     (generation succeeds)
READY_FOR_REVIEW → DRAFT          (teacher edits/regenerates)
READY_FOR_REVIEW → APPROVED       (teacher approves all)
APPROVED → PUBLISHED              (teacher publishes)
PUBLISHED → UNPUBLISHED           (teacher unpublishes)
UNPUBLISHED → PUBLISHED           (teacher re-publishes)
PUBLISHED → DRAFT                 (teacher creates new version → new assets are drafts)
```

### Editing approved content

Creating a "new draft" from an approved asset (existing `POST /api/assets/{id}/draft`)
does **not** change the approved version. The approved version remains published.
The new draft becomes the `current_number` but `published_number` stays at the
approved version. Students continue to see the approved version.

---

## 3.6 Core Pipeline Architecture

```
Step 1: Upload Source
  Input:  file (PDF/PPTX/DOCX/TXT) or text
  Output: Source + SourceVersion + Chunks + Evidence
  DB:     source_documents, source_versions, source_chunks, evidence
  Job:    synchronous (extraction is fast)
  Fail:   HTTPException returned; no partial state

Step 2: Objective Mapping
  Input:  objectives + evidence
  Output: objective.status, objective_evidence links
  DB:     objectives, objective_evidence
  Job:    async (kind="gap")
  Fail:   job.state="Failed"; objectives unchanged

Step 3: Generation
  Input:  supported objectives + evidence + constraints
  Output: 11 AssetVersions with checks
  DB:     assets, asset_versions, quality_checks, claims, claim_evidence, asset_evidence
  Job:    async (kind="generate")
  Fail:   job.state="Failed"; no assets created
  Idempotency: revision check prevents stale commit

Step 4: Teacher Review
  Input:  generated assets + validation results
  Output: teacher edits, regenerations, approvals
  DB:     asset_versions (new versions), approvals
  Job:    regeneration is async (kind="regenerate")
  Fail:   individual asset failure; pack remains reviewable

Step 5: Approval
  Input:  reviewed assets
  Output: all assets locked at APPROVED; published_number set
  DB:     asset_versions.state, assets.published_number, approvals
  Job:    synchronous
  Fail:   failing checks block approval (409)

Step 6: Publication
  Input:  approved pack + classroom
  Output: published_at set; optionally triggers export job
  DB:     units.published_at
  Job:    optional export job (kind="export")
  Fail:   pack remains approved but not published

Step 7: Export (optional)
  Input:  approved asset payloads
  Output: PDF file in S3
  DB:     exports table
  Job:    async (kind="export")
  Fail:   export.status="failed"; download unavailable; pack still published

Step 8: Student Access
  Input:  authenticated student + classroom membership + published pack
  Output: approved asset payloads (filtered)
  DB:     read-only queries
  Auth:   membership + published_at + APPROVED + source_revision match
```

---

## 3.7 Job Architecture

Reuse existing `jobs` table. Add `export` kind.

| Field | Type | Purpose |
|---|---|---|
| `id` | UUID PK | Job identifier |
| `unit_id` | FK → units | Pack being processed |
| `kind` | VARCHAR | `gap`, `generate`, `regenerate`, `video`, `export` |
| `asset_id` | FK → assets (nullable) | For `regenerate` |
| `expected_revision` | INT | Optimistic concurrency check |
| `state` | VARCHAR | `Queued`, `Running`, `Succeeded`, `Failed`, `Cancelled` |
| `message` | TEXT | Human-readable status/error |
| `created_at` | VARCHAR (ISO) | When queued |

### Claiming & locking

- Worker polls: `SELECT ... WHERE state='Queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`.
- Atomically sets `state='Running'`.
- If worker crashes mid-job, the row remains `Running` (stale).

### Stale job recovery

A job in `Running` for more than 10 minutes can be considered stale.
Teacher can cancel it manually. Future: automatic timeout in worker.

### Duplicate prevention

`queue()` function rejects if any `Queued` or `Running` job exists for the
same unit. This prevents double-generation.

---

## 3.8 Storage Architecture

### Interface (`ObjectStore`)

```python
class ObjectStore(Protocol):
    def put(self, key: str, data: bytes) -> None: ...
    def delete(self, key: str) -> None: ...
    def create_download_url(self, key: str, expires: int = 300) -> str: ...
```

### Implementations

| Provider | Config | Purpose |
|---|---|---|
| `LocalObjectStore` | `STORAGE_PROVIDER=local` | Development |
| `SupabaseObjectStore` | `STORAGE_PROVIDER=supabase` | Existing staging |
| `S3ObjectStore` | `STORAGE_PROVIDER=s3` | Production |

### S3 bucket structure

```
lessonfoundry-{env}/
  sources/
    {user_id}/{source_id}/{version_id}/original.{ext}
  exports/
    {classroom_id}/{pack_id}/v{revision}/learning-pack.pdf
```

### S3 security

- Private bucket, no public access.
- IAM role (on EC2) or access key (env vars, backend only).
- Presigned GET URLs with 5-minute expiry for downloads.
- Backend uploads directly (not presigned PUT for MVP).
- Content-Type validation on upload.
- 10 MB limit on source uploads (already enforced by `FileExtractor`).

### Download flow

```
Student clicks Download
    → POST /api/student/packs/{id}/download
    → Backend checks: authenticated + member + published + approved + export exists
    → Backend calls S3ObjectStore.create_download_url(key, expires=300)
    → Returns { "url": "https://s3.../...", "expires_in": 300 }
    → Browser navigates to presigned URL
```

---

## 3.9 Student Access Architecture

```
1. Student authenticates via Supabase (Google OAuth)
2. JWT contains: sub=uuid, app_metadata.role="student"
3. GET /api/student/classrooms → list classrooms where membership exists
4. GET /api/student/classrooms/{id}/packs → list published packs
5. GET /api/student/packs/{id} → approved assets for one pack
6. POST /api/student/packs/{id}/answers/{vid} → check quiz answer

Authorization chain for every student endpoint:
  JWT valid
    → role == "student"
      → classroom_members row exists with status="active"
        → unit.classroom_id matches
          → unit.published_at IS NOT NULL
            → asset_version.state == "APPROVED"
              → asset_version.source_revision == unit.source_revision
```

Student CANNOT:
- View drafts, unpublished packs, or non-approved assets.
- Access evidence, validation, generation controls, or teacher metadata.
- Access packs in classrooms they haven't joined.
- Access another student's quiz answers.

---

## 3.10 API Architecture

Prefix: `/api` (existing convention).

### Endpoint groups

| Domain | Prefix | Auth |
|---|---|---|
| Health | `/api/health`, `/api/ready` | None |
| Auth bootstrap | (handled by Supabase client) | — |
| Classrooms | `/api/classrooms` | Teacher |
| Join | `/api/classrooms/{id}/join` | Student |
| Members | `/api/classrooms/{id}/members` | Teacher |
| Packs (teacher) | `/api/packs`, `/api/classrooms/{id}/packs` | Teacher |
| Assets (teacher) | `/api/assets` | Teacher |
| Jobs | `/api/jobs` | Teacher |
| Student classrooms | `/api/student/classrooms` | Student |
| Student packs | `/api/student/packs` | Student |
| Student download | `/api/student/packs/{id}/download` | Student |
| Legacy student | `/api/student/{token}` | None (backward compat) |

---

## 3.11 Frontend Architecture

### Routes (target)

```
/login                              Login page (Google OAuth + role)
/auth/callback                      Supabase OAuth callback

/teacher                            Teacher dashboard
/teacher/classrooms                 Classroom list
/teacher/classrooms/[id]            Classroom detail
/teacher/classrooms/[id]/packs      Pack list
/teacher/packs/[id]                 Pack studio (existing SPA)

/student                            Student dashboard
/student/classrooms                 Classroom list
/student/classrooms/[id]            Classroom packs
/student/packs/[id]                 Learning view (existing StudentView, authenticated)

/student/[token]                    Legacy anonymous student view (kept)
```

### Migration from SPA to routes

The existing `Studio` component at `/` becomes `/teacher/packs/[id]`. The existing
client-side screen navigation is preserved inside that route. The new routes
(`/login`, `/teacher`, `/student`) are new pages that wrap existing components.

---

## 3.12 UI Boundary

### Teacher sees

Classrooms, members, pack creation, Studio (source → evidence → generate →
validate → approve → publish), version history, evidence drawer.

### Student sees

Classrooms, published packs, Learn, Practice, Revise, Watch, Resources, Download.

### Never crosses the boundary

Students never see: validation internals, evidence raw data, generation controls,
drafts, approval UI, version history, teacher notes, source documents, join codes.
