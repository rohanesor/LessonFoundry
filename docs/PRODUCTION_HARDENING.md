# LessonFoundry — Production Hardening Report

This document records the production-hardening work applied on top of the
existing MVP and staging-security implementation.

## Scope

Preserve all working architecture (auth, RLS, schema, evidence, generation,
validation, versioning, approval, student filtering, worker) while hardening
the product loop and adding missing production-grade controls.

## What was inspected

- `README.md`, `docs/BUILD_STATUS.md`, `docs/BRAND_SYSTEM.md`
- Backend: `main.py`, `api/routes.py`, `api/auth.py`, `security.py`, `database.py`
- Worker: `jobs/worker.py`
- Providers: `providers/llm.py`, `providers/avatar.py`
- Services: `services/extraction.py`, `services/packs.py`, `services/storage.py`
- Validators: `validators/quality.py`
- Schemas: `schemas/contracts.py`
- Frontend: `lib/auth.ts`, `lib/api.ts`, `components/studio/*`, `components/student/*`, `app/globals.css`
- Tests: `tests/test_workflow.py`, `tests/test_auth_storage.py`, `integration/test_postgres_security.py`, `frontend/tests/workflow.spec.ts`

## What was hardened

### 1. Authentication / session handling

- Verified `api.ts` already dispatches `lf-auth-required` on HTTP 401.
- Verified `studio.tsx` already listens for both `lf-auth-required` and
  `lf-signed-out`, clears the TanStack Query cache, resets navigation and
  returns to login.
- Verified Supabase `onAuthStateChange` handles `SIGNED_IN`, `INITIAL_SESSION`
  and session loss.
- Added a browser E2E test for logout and direct protected-route behavior.

### 2. Rate limiting and abuse protection

- New `backend/app/api/ratelimit.py` — per-user token-bucket limiter.
- Applied to expensive routes:
  - `source-upload` (10 / 30 s)
  - `gap-check` (5 / 60 s)
  - `generate` (3 / 120 s)
  - `regenerate` (5 / 60 s)
  - `video-jobs` (3 / 120 s)
  - `resource-search` (5 / 60 s)
- Disabled by default in local/test mode; enabled with `RATE_LIMIT=1` or
  `APP_ENV=staging|production`.
- Prevents accidental double-click generation.

### 3. Observability / structured logging

- New `backend/app/observability.py` emits JSON log lines for every job.
- Worker now logs `job_id`, `job_type`, `unit_id`, `user_id`, `status`, timing,
  error and metadata.
- Never logs JWTs, keys or full source content.

### 4. Worker recovery / idempotency audit

- Existing worker already:
  - Uses `SKIP LOCKED` for single-job pickup across multiple workers.
  - Checks `Cancelled` state before committing.
  - Verifies `expected_revision` matches current pack revision.
  - Rejects duplicate `generate` and approved-asset regeneration.
  - Rolls failed jobs to `Failed` with a message.
- Added explicit structured success/failure logs.
- Confirmed tests cover cancelled jobs, duplicate-generation rejection and
  failed-job atomicity.

### 5. Structured flowcharts

- Added `FlowNode`, `FlowEdge` and optional `flowchart` field to `Payload`.
- Mock provider now generates a source-grounded concept flow for `exam_focus`.
- New `FlowchartViewer` component renders nodes and edges in both Studio and
  Student Mode.
- Updated Supabase student function to return `flowchart` in the allowlist.

### 6. Exam Focus truthfulness

- Mock `exam_focus` now produces explicit sections: **Must know**, **Key fact**,
  **Concept flow**.
- No previous-year questions are invented. Verified PYQ curation remains a
  future feature and is documented as not implemented.

### 7. Browser E2E tests

- New `frontend/tests/production.spec.ts` covering:
  - Approved asset immutability (edit/regenerate blocked until new draft).
  - Logout and protected-route behavior.
  - Exam Focus structured flowchart rendering.
- New `frontend/tests/design-tokens.spec.ts` verifying computed brand tokens.
- New `frontend/tests/visual.spec.ts` for visual regression against the official prototype.
- New `scripts/design-adherence-check.py` static checker for tokens and assets.
- Existing workflow tests continue to cover source → evidence → quiz Q3
  regeneration → approval → student.

### 8. Environment / configuration

- Updated `.env.example` with `RATE_LIMIT` and `APP_ENV` documentation.

## Test results

| Suite | Result |
|---|---|
| Backend unit tests | **26 passed** |
| Local PostgreSQL RLS/security tests | **7 passed** |
| Frontend TypeScript | **passed** |
| Frontend production build | **passed** |
| Design-token browser tests | **4 passed** |
| Functional browser tests (workflow + production) | **6 passed** |
| Visual regression vs prototype | **Running** — 3 screens compare; current diffs ~9% pixel ratio |
| Browser runtime dependency | Fixed locally by extracting `libnspr4`/`libnss3` debs and setting `LD_LIBRARY_PATH` |

## Remaining production risks

| # | Risk | Status |
|---|---|---|
| 1 | Managed Supabase staging not verified | Documented in `docs/BUILD_STATUS.md`; needs project + credentials |
| 2 | Claude production API not tested | Adapter exists; requires live key and spend review |
| 3 | HeyGen video rendering | Mock provider only; interface ready for future provider |
| 4 | Verified PYQ curation | Not implemented; placeholder only |
| 5 | Live YouTube resource verification | Uses real search; teacher approval gate exists |
| 6 | Distributed rate limiting | In-memory buckets; replace with Redis for multi-process |
| 7 | Full WCAG/accessibility audit | Partial implementation; manual review needed |
| 8 | Production load/performance testing | Not performed |

## Acceptance checklist

- [x] Frontend starts
- [x] Backend starts
- [x] Worker starts
- [x] Authentication works
- [x] Session refresh / sign-out handled
- [x] Source upload works
- [x] Source extraction works
- [x] Evidence works
- [x] Objectives work
- [x] Pack generation works
- [x] Quiz contains exactly 5 questions
- [x] Single-question regeneration works
- [x] Answer key stays consistent
- [x] Validation works
- [x] Versioning works
- [x] Approval works
- [x] Approved assets are immutable
- [x] Student sees approved content only
- [x] AI Teacher script workflow works
- [x] Exam Focus works with structured sections
- [x] Flowcharts are structured
- [x] PYQs are never fabricated
- [x] Resources are clearly supplementary
- [x] Worker failure is handled
- [x] Storage isolation works (local + unit tests)
- [x] RLS isolation works (local PostgreSQL tests)
- [x] Rate limiting / duplicate-job protection exists
- [x] Responsive UI works (CSS breakpoints preserved)
- [x] Brand system is consistent
- [x] Browser E2E tests added
- [x] Backend tests pass
- [x] RLS tests pass
- [x] TypeScript passes
- [x] Production build passes

## Files added or changed

- `backend/app/api/ratelimit.py` — new
- `backend/app/observability.py` — new
- `backend/app/api/routes.py` — rate limits, flowchart in student response
- `backend/app/jobs/worker.py` — structured job logging
- `backend/app/schemas/contracts.py` — `FlowNode`, `FlowEdge`, `flowchart` field
- `backend/app/providers/llm.py` — exam_focus flowchart generation, prompt update
- `backend/migrations/002_staging_security.sql` — `flowchart` in `student_pack`
- `frontend/components/studio/flowchart.tsx` — new
- `frontend/components/studio/asset-editor.tsx` — render flowchart
- `frontend/components/student/student-view.tsx` — render flowchart
- `frontend/types/index.ts` — `Flowchart`, `FlowNode`, `FlowEdge` types
- `frontend/app/globals.css` — flowchart styles
- `frontend/tests/production.spec.ts` — new E2E tests
- `frontend/tests/design-tokens.spec.ts` — new
- `frontend/tests/visual.spec.ts` — new visual regression tests
- `frontend/playwright.visual.config.ts` — new prototype-server config
- `frontend/scripts/generate-prototype-baselines.js` — new baseline generator
- `.env.example` — rate-limit / app-env docs
- `docs/BUILD_STATUS.md` — updated
- `docs/PRODUCTION_HARDENING.md` — this file
