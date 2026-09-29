# LessonFoundry — Platform Architecture Audit

Date: Phase 0 audit before classroom/platform implementation.

---

## Existing Architecture

### Stack

| Layer | Technology | Status |
|---|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, TanStack Query v5, Radix UI | Running |
| Backend | FastAPI (Python 3.14), SQLAlchemy 2, Pydantic v2 | Running |
| Database | SQLite (local), PostgreSQL (staging/production via Supabase) | Working |
| Worker | Single-process DB-poll loop (`SKIP LOCKED` for PG) | Running |
| Auth | Local token (dev), Supabase JWT (production) | Working |
| Storage | Local filesystem (dev), Supabase Storage (production) | Working |
| LLM | MockLLMProvider (dev), ClaudeProvider (production) | Both implemented |
| Avatar | MockAvatarProvider only | Interface exists |
| Icons | Official LFIcon set (37 icons) from handoff | Integrated |
| Brand | Official handoff tokens, logos, favicon | Integrated |

### Frontend routes

| Route | Component | Purpose |
|---|---|---|
| `/` | `Studio` (SPA) | Teacher workspace — all screens via client-side nav |
| `/student/[token]` | `StudentView` | Student learning via share-token URL |

The entire teacher experience is a single-page application rendered by `Studio`.
Navigation is client-side state (`screen` in `studio.tsx`), not URL-based routes.
The student view is a separate Next.js dynamic route.

### Frontend component tree

```
Studio (root orchestrator)
├── Login
├── Dashboard
├── CreatePack (modal)
├── Shell (sidebar + topbar + pack header)
│   ├── Sources
│   ├── Overview
│   ├── AssetEditor (Explanation / Assessment / Quiz)
│   ├── Approval (modal)
│   ├── EvidenceDrawer
│   ├── Versions
│   ├── Validation
│   ├── AnswerKey
│   ├── Resources
│   └── VideoWorkflow (AI Teacher)
└── StudentView (separate route)
    └── Question (quiz interaction)
```

### Frontend state management

- TanStack Query for server data (packs, versions, resources).
- React `useState` for screen, editing, review, evidence, toast.
- `sessionStorage` for local-dev token.
- Supabase client for hosted sessions (persistent, auto-refresh).
- `lf-auth-required` / `lf-signed-out` custom events for session lifecycle.

### API client

`lib/api.ts` wraps `fetch` with:
- Bearer token injection via `accessToken()`.
- Next.js rewrite proxy: `/api/:path*` → `http://127.0.0.1:8000/api/:path*`.
- 401 → dispatches `lf-auth-required` event → returns to login.

---

## Existing Data Model

### Tables (19 total)

```
users
units (= learning packs)
source_documents
source_versions
source_chunks
evidence
objectives
objective_evidence
assets
asset_versions
asset_evidence
claims
claim_evidence
quality_checks
approvals
pack_events (timeline)
jobs
video_jobs
resources
```

### Key relationships

```
User 1──* Unit (owner_id)
Unit 1──* Source 1──* SourceVersion 1──* Chunk 1──1 Evidence
Unit 1──* Objective *──* Evidence (via objective_evidence)
Unit 1──* Asset 1──* AssetVersion *──* Evidence (via asset_evidence)
AssetVersion 1──* Claim *──* Evidence (via claim_evidence)
AssetVersion 1──* Check
AssetVersion 1──0..1 Approval
Unit 1──* Timeline
Unit 1──* Job
Unit 1──* VideoJob
Unit 1──* Resource
```

### Primary keys

All tables use UUID v4 strings (`VARCHAR(36)`).

### Ownership model

- `Unit.owner_id` → `users.id` (teacher owns pack).
- All child entities are scoped to a unit. The `owned()` repository function
  enforces `Unit.owner_id == authenticated_user` on every request.
- Student access uses `Unit.share_token` (capability URL), not user identity.

### RLS (PostgreSQL only)

Migrations `002_staging_security.sql` and `003_private_storage.sql` define:
- Forced RLS on all 19 tables.
- Restricted roles: `lessonfoundry_api` (NOINHERIT, NOBYPASSRLS),
  `lessonfoundry_student`, `lessonfoundry_worker`.
- Policies based on `(request.jwt.claims->>'sub')`.
- SECURITY DEFINER functions for student access: `lf_private.student_pack()`,
  `lf_private.student_answer()`.
- Immutable-approved-version trigger.

### Indexes

Owner lookups (`ix_units_owner_id`), unit scoping on assets/objectives/sources,
job state, asset version uniqueness constraints.

---

## Existing APIs

### Teacher endpoints (require Bearer token)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/packs` | List owned packs |
| POST | `/api/packs` | Create pack |
| GET | `/api/packs/{pid}` | Full pack detail |
| POST | `/api/packs/{pid}/sources/text` | Add text source |
| POST | `/api/packs/{pid}/sources` | Upload file source |
| POST | `/api/packs/{pid}/gap-check` | Queue objective mapping |
| POST | `/api/packs/{pid}/generate` | Queue full generation |
| GET | `/api/packs/{pid}/status` | Job status |
| POST | `/api/packs/{pid}/approve` | Approve all assets |
| POST | `/api/packs/{pid}/resources/search` | YouTube search |
| GET | `/api/packs/{pid}/resources` | List resources |
| GET | `/api/packs/{pid}/validation` | Validation detail |
| GET | `/api/packs/{pid}/versions` | Version timeline |
| GET | `/api/packs/{pid}/answer-key` | Published answer key |
| PATCH | `/api/assets/{aid}` | Edit asset |
| POST | `/api/assets/{aid}/regenerate` | Queue single-asset regen |
| POST | `/api/assets/{aid}/approve` | Approve single asset |
| POST | `/api/assets/{aid}/draft` | Create new draft from approved |
| GET | `/api/assets/{aid}/evidence` | Asset evidence |
| POST | `/api/video-jobs` | Queue video render |
| GET | `/api/video-jobs/{vid}` | Video job status |
| POST | `/api/resources/{rid}/approve` | Approve resource |
| POST | `/api/jobs/{jid}/cancel` | Cancel job |
| PATCH | `/api/objectives/{oid}` | Edit objective |
| POST | `/api/demo` | Load Newton demo fixture |

### Student endpoints (no auth required)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/student/{token}` | Published pack content |
| POST | `/api/student/{token}/answers/{vid}` | Check quiz answer |

### Rate limiting

Per-user token-bucket on expensive endpoints. Disabled in local/test mode.

---

## Existing Authentication

### Local mode (`AUTH_MODE=local`)

- Single shared token (`LOCAL_TEACHER_TOKEN`).
- `secrets.compare_digest` comparison.
- User ID hardcoded to `"local-teacher"`.
- Token stored in `sessionStorage`.

### Supabase mode (`AUTH_MODE=supabase`)

- JWT verification: signature (JWKS), issuer, audience, expiry.
- Requires `app_metadata.role == "teacher"`.
- UUID `sub` claim extracted as user identity.
- `ensure_user()` upserts into `users` table on first request.
- Session managed by Supabase JS client (persistent, auto-refresh).

### Authorization

- All teacher endpoints use `Depends(teacher)` dependency.
- `owned()` function checks `Unit.owner_id == user`.
- Student endpoints bypass auth entirely (capability-URL model).
- **No student authentication exists** — students are anonymous visitors.
- **No role distinction** — all authenticated users are teachers.

---

## Existing AI Pipeline

```
Teacher uploads source
    ↓
FileExtractor: PDF/PPTX/DOCX/TXT → (location, text) pairs
    ↓
add_source: Source → SourceVersion → Chunk → Evidence
    ↓
Gap check job: MockLLM/Claude maps objectives to evidence
    ↓
Generate job: MockLLM/Claude produces 11 structured assets
    ↓
new_version: Pydantic validation → AssetVersion + Checks
    ↓
CoreValidator: 13 deterministic quality checks
    ↓
Teacher reviews → Approve (immutable lock)
```

### Asset slots (11)

```
explanation
assessment_easy, assessment_medium, assessment_advanced
quiz1, quiz2, quiz3, quiz4, quiz5
exam_focus
video_script
```

### Validation checks (13)

Schema, Length, Evidence existence, Source location, Answer validity,
Answer-key consistency, Answer leakage, Instruction safety, Duplicates,
Difficulty, Grounding, Cross-artifact consistency, Terminology.

---

## Existing Storage

### Local mode

- Files saved to `LOCAL_STORAGE_PATH` (default `.local-files/`).
- Path: `{user_id}/{unit_id}/{uuid}/{filename}`.
- No signed URLs.

### Supabase mode

- Private `sources` bucket.
- Upload/download via teacher JWT + anon key (no service-role bypass).
- `ObjectStore.put()`, `ObjectStore.delete()`, `ObjectStore.sign()`.

---

## Existing Worker System

- Single Python process polling `jobs` table every 1 second.
- `SKIP LOCKED` for PostgreSQL (multi-worker safe).
- Atomic state transitions: `Queued → Running → Succeeded/Failed`.
- Revision check prevents committing stale results.
- Cancelled jobs detected before commit.
- Structured JSON logging via `observability.py`.

---

## Existing Security Model

- Owner-scoped queries (teacher can only see own packs).
- Approved versions immutable (DB trigger + application check).
- Student sees only `APPROVED` + `current source_revision` assets.
- Video scripts excluded from student view.
- Server-side answer checking (key never sent to client).
- RLS policies for PostgreSQL (not enforced in SQLite dev mode).
- No secrets in client bundles (verified by scan script).

---

## Existing Student Experience

- Anonymous access via capability URL: `/student/{share_token}`.
- Tabs: Learn, Practice, Watch, Revise, Explore.
- Only approved, non-stale assets shown.
- Quiz answers checked server-side with answer-reveal policy.
- Print/save-PDF via browser print.
- **No student identity, classroom, or download system.**

---

## Existing Teacher Experience

- Login → Dashboard → Create Pack → Sources → Overview → Studio.
- Full CRUD on packs, sources, objectives.
- Evidence inspection, validation review, version history.
- Per-asset and per-pack approval with attestation.
- Controlled single-asset regeneration.
- Mock AI Teacher workflow.
- YouTube resource search and approval.
- **No classrooms, publishing, or multi-student management.**

---

## Current Limitations

| # | Limitation | Impact |
|---|---|---|
| 1 | **No classroom/group model** | Teacher cannot organize students; each pack is isolated |
| 2 | **No student authentication** | Students are anonymous; no progress tracking possible |
| 3 | **No publish/unpublish control** | Approved = visible to anyone with share link |
| 4 | **No downloadable exports** | Students cannot download PDF/ZIP learning packs |
| 5 | **No S3 storage** | Production files stored on Supabase Storage only |
| 6 | **Single role (teacher)** | No student role; no role-based routing |
| 7 | **No Google OAuth** | Only email/password or local token |
| 8 | **No classroom join flow** | No join codes, invitations, or membership |
| 9 | **Single-page teacher app** | No URL-based routing; browser back/refresh loses state |
| 10 | **`Unit` naming** | "Unit" is internal; UI says "Learning Pack" |
| 11 | **No stream/announcements** | No teacher → student communication |
| 12 | **No readiness endpoint** | `/health` exists but no `/ready` with dependency checks |
| 13 | **No export pipeline** | No PDF/ZIP generation from approved assets |
| 14 | **Worker is poll-based** | No Redis/Valkey queue; 1s polling loop |
| 15 | **Docker compose untested** | Supplied but never verified in this environment |

---

## Required Changes

### New entities

1. **User profile** — extend `users` with `email`, `avatar_url`, `role` (teacher/student).
2. **Classroom** — `classrooms` table with owner, name, description, join_code, status.
3. **Classroom membership** — `classroom_members` linking students to classrooms.
4. **Classroom packs** — `classroom_id` FK on `units` (nullable for migration).
5. **Pack publication** — separate `published` state from `approved`.

### Auth changes

1. Google OAuth via Supabase Auth.
2. Student authentication (same Supabase Auth, different `app_metadata.role`).
3. Role-based routing (teacher studio vs student dashboard).
4. Role enforcement in backend (extend `teacher` dependency, add `student` dependency).

### Storage changes

1. S3 storage provider implementing `ObjectStore` interface.
2. Presigned upload/download URLs.
3. Deterministic object keys by classroom/pack/version.
4. Export pipeline: approved assets → PDF → S3.

### API changes

1. Classroom CRUD endpoints.
2. Join flow endpoints.
3. Pack publish/unpublish endpoints.
4. Student classroom listing, pack listing, download endpoints.
5. Health/readiness endpoints.

### Frontend changes

1. Login page with Google OAuth + role selection.
2. Teacher classroom dashboard.
3. Student classroom dashboard.
4. Classroom detail pages (teacher and student views).
5. Pack publishing UI.
6. Download button on student view.
7. URL-based routing for key screens.

---

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Breaking existing 26 backend tests | Keep `Unit` entity compatible; add classroom FK as nullable |
| 2 | Breaking existing 6 browser tests | Preserve login flow; extend, don't replace |
| 3 | RLS migration complexity | Add classroom policies incrementally in a new migration |
| 4 | Google OAuth requires Supabase project | Document env-gated Google provider; keep local fallback |
| 5 | S3 requires AWS credentials | Abstract behind `ObjectStore`; keep local fallback |
| 6 | PDF generation adds dependencies | Use `weasyprint` or `reportlab`; isolate in worker |
| 7 | Worker scaling | Redis/Valkey queue is recommended but not required for MVP |

---

## Recommended Architecture

```
                    INTERNET
                       │
                    HTTPS / Nginx
                       │
              ┌────────┴────────┐
              │                 │
          Next.js             FastAPI
          (teacher +          (business logic,
           student UI)        auth, classroom,
              │               pack APIs)
              │                 │
              │              Worker
              │              (extraction,
              │               generation,
              │               export)
              │                 │
              └───────┬─────────┘
                      │
                Supabase
                (Auth + PG + RLS)
                      │
                   AWS S3
                (sources, exports)
```

### Entity relationship (target)

```
User ──< Classroom ──< ClassroomMember >── User (student)
Classroom ──< Unit (learning pack)
Unit ──< Source ──< SourceVersion ──< Chunk ──< Evidence
Unit ──< Objective ──< ObjectiveEvidence >── Evidence
Unit ──< Asset ──< AssetVersion ──< Check, Claim, AssetEvidence
Unit ──< Job, VideoJob, Resource, Timeline
```

### Migration strategy

1. Add `email`, `avatar_url`, `role` columns to `users` (nullable, defaults).
2. Create `classrooms` table.
3. Create `classroom_members` table.
4. Add `classroom_id` FK to `units` (nullable for existing packs).
5. Add `published_at` column to `units`.
6. Create S3 storage provider.
7. Create export pipeline.
8. Update RLS policies incrementally.

All changes are additive. Existing tests should pass without modification.
