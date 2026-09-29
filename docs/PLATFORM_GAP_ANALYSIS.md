# LessonFoundry — Phase 2: Gap Analysis

## 2.1 Current → Target Matrix

### Authentication

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| Teacher login (email/password) | Supabase Auth | Keep | — | KEEP | — |
| Teacher login (Google OAuth) | Not implemented | Required | Missing | NEW | P0 |
| Student authentication | None (anonymous share-token) | Supabase Auth with student role | Missing entirely | NEW | P0 |
| Role in JWT | `app_metadata.role == "teacher"` hard-check | teacher OR student | Only teacher recognised | EXTEND | P0 |
| Backend role resolution | `teacher()` dependency only | `teacher()` + `student()` + `authenticated()` | No student dependency | NEW | P0 |
| Session refresh | Supabase auto-refresh | Keep | — | KEEP | — |
| Logout | `signOut()` clears session | Keep | — | KEEP | — |
| Protected routes | SPA client-side only | URL-based routes with server middleware | No URL routing | EXTEND | P1 |
| Local dev student token | Not implemented | `LOCAL_STUDENT_TOKEN` | Missing | NEW | P1 |

### Users

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| User table | `users(id, name)` | `users(id, email, name, avatar_url, role, created_at, updated_at)` | Missing columns | EXTEND | P0 |
| Teacher profile | Name only | Name + email + avatar | Missing fields | EXTEND | P1 |
| Student profile | Does not exist | Same table, `role='student'` | Missing | EXTEND | P0 |
| Role column | Not present | `role VARCHAR NOT NULL DEFAULT 'teacher'` | Missing | NEW | P0 |
| `ensure_user` upsert | Sets `name="Teacher"` | Set name + email + avatar from JWT claims | Incomplete | EXTEND | P0 |

### Classroom

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| Classroom entity | Does not exist | `classrooms` table | Missing entirely | NEW | P0 |
| Classroom ownership | — | `owner_id → users(id)` | — | NEW | P0 |
| Join code | — | `join_code VARCHAR(10) UNIQUE` | — | NEW | P0 |
| Join flow (student) | — | `POST /api/classrooms/{id}/join` | — | NEW | P0 |
| Classroom listing (teacher) | — | `GET /api/classrooms` | — | NEW | P0 |
| Classroom listing (student) | — | `GET /api/student/classrooms` | — | NEW | P0 |
| Classroom detail page | — | Teacher and student views | — | NEW | P1 |
| Classroom stream | — | Lightweight event list | — | NEW | P2 |
| Archive classroom | — | `status='archived'` | — | NEW | P2 |

### Classroom Membership

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| Membership entity | Does not exist | `classroom_members` table | Missing entirely | NEW | P0 |
| Unique constraint | — | `UNIQUE(classroom_id, user_id)` | — | NEW | P0 |
| Remove student | — | `DELETE /api/classrooms/{id}/members/{uid}` | — | NEW | P1 |
| Membership check for auth | — | Student endpoints verify membership | — | NEW | P0 |

### Learning Packs (Units)

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| `units` table | 11 columns, no classroom FK | Add `classroom_id`, `published_at` | 2 missing columns | EXTEND | P0 |
| Pack ↔ classroom | Not linked | `classroom_id FK` (nullable for compat) | Missing | EXTEND | P0 |
| Pack creation in classroom | Teacher creates standalone | `POST /api/classrooms/{cid}/packs` | Missing | NEW | P0 |
| Draft state | Implicit (no approved assets) | Keep implicit | — | KEEP | — |
| Approved state | Per-asset `APPROVED` + per-pack approval | Keep | — | KEEP | — |
| Published state | Not implemented (approved ≈ visible) | `published_at` column | Missing | NEW | P0 |
| Unpublish | Not implemented | `POST /api/packs/{id}/unpublish` | Missing | NEW | P0 |
| Share-token student access | Anonymous capability URL | Deprecate for classroom access; keep for backward compat | Needs coexistence | REFACTOR | P1 |

### Sources & Evidence

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| PDF extraction | `FileExtractor` | Keep | — | KEEP | — |
| PPTX extraction | `FileExtractor` | Keep | — | KEEP | — |
| DOCX extraction | `FileExtractor` | Keep | — | KEEP | — |
| TXT/MD extraction | `FileExtractor` | Keep | — | KEEP | — |
| Source versions | `source_versions` | Keep | — | KEEP | — |
| Chunks / evidence | `source_chunks`, `evidence` | Keep | — | KEEP | — |
| Objective mapping | `gap-check` job | Keep | — | KEEP | — |
| Evidence drawer UI | Working | Keep | — | KEEP | — |

### AI Pipeline

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| MockLLMProvider | Working | Keep for dev | — | KEEP | — |
| ClaudeProvider | Implemented, untested live | Keep | — | KEEP | — |
| 11-slot generation | Working | Keep | — | KEEP | — |
| Pydantic validation | Working | Keep | — | KEEP | — |
| CoreValidator (13 checks) | Working | Keep | — | KEEP | — |
| Per-asset versioning | Working | Keep | — | KEEP | — |
| Per-asset regeneration | Working | Keep | — | KEEP | — |
| Approval locking | Working + DB trigger | Keep | — | KEEP | — |

### Student Experience

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| Anonymous access via share-token | Working | Keep as fallback | — | KEEP | — |
| Authenticated student access | None | Via classroom membership | Missing entirely | NEW | P0 |
| Student classroom dashboard | None | List joined classrooms | Missing | NEW | P0 |
| Student pack listing | None | Published packs in classroom | Missing | NEW | P0 |
| Learn tab | Working (anonymous) | Adapt to authenticated | Minor | EXTEND | P0 |
| Practice tab | Working (anonymous) | Adapt to authenticated | Minor | EXTEND | P0 |
| Revise tab | Working | Keep | — | KEEP | — |
| Watch tab | Placeholder | Keep | — | KEEP | — |
| Resources tab | Working | Keep | — | KEEP | — |

### Downloads

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| ObjectStore interface | `put`, `delete`, `sign` | Add `create_download_url`, `create_upload_url` | Incomplete | EXTEND | P0 |
| Local filesystem storage | Working | Keep for dev | — | KEEP | — |
| Supabase Storage | Working | Keep as option | — | KEEP | — |
| S3 storage | Not implemented | `S3ObjectStore` | Missing | NEW | P0 |
| Export PDF generation | Not implemented | Worker job → PDF → S3 | Missing | NEW | P1 |
| Presigned download | Supabase `sign()` only | S3 presigned GET | Missing | NEW | P0 |
| Download authorization | None | Membership + published + approved | Missing | NEW | P0 |

### Worker

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| DB-polling loop | Working, `SKIP LOCKED` | Keep for MVP | — | KEEP | — |
| Job kinds: gap, generate, regenerate, video | Working | Add `export` kind | Missing | EXTEND | P1 |
| Structured logging | Working (`observability.py`) | Keep | — | KEEP | — |
| Revision check | Working | Keep | — | KEEP | — |
| Cancel | Working | Keep | — | KEEP | — |

### Security & RLS

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| Owner-scoped queries | `owned()` checks `owner_id` | Keep + add classroom scoping | Incomplete | EXTEND | P0 |
| RLS on 19 tables | Policies for teacher-owner + worker | Add student-member policies | Missing | NEW | P0 |
| Classroom RLS | Does not exist | New policies on `classrooms`, `classroom_members` | Missing | NEW | P0 |
| Publication-scoped student RLS | `student_pack()` SECURITY DEFINER | Extend for classroom membership | Incomplete | EXTEND | P0 |
| Rate limiting | Token-bucket on 6 endpoints | Keep + add join endpoint | Minor | EXTEND | P1 |

### Deployment

| Capability | Current | Target | Gap | Change | Priority |
|---|---|---|---|---|---|
| `docker-compose.yml` | Exists (untested) | Update for S3, env vars | Incomplete | EXTEND | P1 |
| Dockerfile (backend) | Exists | Keep | — | KEEP | — |
| Dockerfile (frontend) | Exists | Keep | — | KEEP | — |
| Nginx config | Not present | New | Missing | NEW | P1 |
| EC2 deployment guide | Not present | New | Missing | NEW | P1 |
| Health endpoint | `GET /api/health` | Keep + add `/api/ready` | Incomplete | EXTEND | P1 |
| Environment docs | `.env.example` exists | Add S3 + Google OAuth vars | Incomplete | EXTEND | P0 |

---

## 2.2 Gap Classification Summary

| Classification | Count | Examples |
|---|---|---|
| **KEEP** | 31 | FileExtractor, CoreValidator, approval, evidence, versioning, worker loop |
| **EXTEND** | 16 | `users` table, `units` table, auth dependency, ObjectStore, RLS |
| **NEW** | 19 | Classrooms, membership, join flow, S3ObjectStore, export, student auth, Google OAuth |
| **REFACTOR** | 1 | Share-token student access → coexist with classroom |
| **DEFER** | 2 | HeyGen, Google Classroom API integration |
| **REMOVE** | 0 | Nothing removed |

---

## 2.3 Implementation Dependency Graph

```
PHASE A: Foundation
    User model (EXTEND)
        ↓
    Auth dependencies (EXTEND: teacher + student + authenticated)
        ↓
    Google OAuth config (NEW)

PHASE B: Classroom
    Classroom entity (NEW)
        ↓
    Membership entity (NEW)
        ↓
    Join code + join flow (NEW)

PHASE C: Learning Pack linking
    Unit.classroom_id FK (EXTEND)
        ↓
    Pack creation in classroom (NEW)
        ↓
    Unit.published_at (NEW)
        ↓
    Publish / unpublish API (NEW)

PHASE D: Student delivery
    Student auth dependency (NEW)
        ↓
    Student classroom list API (NEW)
        ↓
    Student published-pack API (NEW)

PHASE E: Storage & Export
    S3ObjectStore (NEW)
        ↓
    Export job (NEW)
        ↓
    Download authorization (NEW)

PHASE F: Frontend
    Login page with Google + role (NEW)
        ↓
    Teacher classroom UI (NEW)
        ↓
    Student classroom UI (NEW)
        ↓
    URL-based routing (EXTEND)

PHASE G: RLS & Security
    New RLS policies for classrooms (NEW)
        ↓
    Student-member policies on packs/assets (EXTEND)
```

The existing AI pipeline (source → evidence → generate → validate → approve) is
untouched across all phases.

---

## 2.4 Risk Register

| # | Risk | Impact | Likelihood | Mitigation | Phase |
|---|---|---|---|---|---|
| 1 | Adding `classroom_id` breaks existing unit tests | HIGH | LOW | Nullable FK with default NULL; existing tests unaffected | C |
| 2 | Role confusion (teacher can student-join, student can teacher-create) | HIGH | MEDIUM | Backend enforces role from JWT `app_metadata`; UI role selector is cosmetic | A |
| 3 | Student accesses draft/unpublished content | HIGH | MEDIUM | Three-layer check: membership + published_at + APPROVED state | D |
| 4 | Classroom isolation failure (student A sees classroom B data) | HIGH | MEDIUM | RLS policies + `classroom_members` join in every student query | G |
| 5 | Join-code brute force | MEDIUM | LOW | Rate limit join endpoint; 5-char code = ~33M combinations | B |
| 6 | Approved-version mutation via classroom publish | HIGH | LOW | Publication only sets `published_at`; never mutates asset versions | C |
| 7 | S3 credentials leaked to frontend | HIGH | LOW | Server-side presigned URLs only; no AWS env vars prefixed `NEXT_PUBLIC_` | E |
| 8 | Stale presigned download URL after unpublish | MEDIUM | LOW | Short expiry (5 min); download endpoint re-checks publication state | E |
| 9 | Export job fails, student sees "Download" but gets error | MEDIUM | MEDIUM | UI shows download only when export record status=completed | E |
| 10 | Google OAuth requires Supabase project config | LOW | HIGH | Document setup; local dev keeps token auth unchanged | A |
| 11 | Breaking 6 existing browser tests | MEDIUM | LOW | Preserve `/` login flow; extend, don't replace | F |
| 12 | Worker processes export + generation concurrently | MEDIUM | LOW | Existing queue is per-unit; export is a separate job after approval | E |
| 13 | Migration 004 applied to production DB with existing data | HIGH | LOW | All new columns nullable or have safe defaults; no data loss | — |

---

## 2.5 Backward Compatibility

### Share-token anonymous student access

**Decision: KEEP for backward compatibility, DEPRECATE for new flows.**

Current state: `Unit.share_token` is a UUID capability URL. Anyone with the link
can access approved content at `/student/{token}` without authentication.

Migration:
- The existing `/api/student/{token}` and `/student/[token]` routes remain.
- New classroom-based student access uses authenticated endpoints.
- Both paths coexist indefinitely.
- No data migration needed (existing share-tokens are preserved).
- Future: optionally allow teacher to disable share-token access per pack.

### Existing packs without classroom

Existing `units` rows have `classroom_id = NULL`. They continue to function
exactly as today: teacher-owned, accessible via share-token, editable in the
existing Studio. The teacher can later assign them to a classroom.

### Existing tests

All 26 backend tests and 6 browser tests use `local-teacher` identity and
`AUTH_MODE=local`. They create packs without classrooms. Adding nullable
`classroom_id` does not change any existing query or assertion.
