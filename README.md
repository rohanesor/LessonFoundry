# LessonFoundry

**Trusted sources → evidence → objectives → generation → validation → teacher approval → learning.**

A working full-stack development MVP, translated from the supplied LessonFoundry v3
Modernist design—not a chatbot or embedded HTML mockup. It includes persistent data,
real API interactions, individual question regeneration, immutable history, approval
locks and a separately filtered student surface.

**Status:** the local P0 workflow is implemented and tested. This is **not yet a
production-certified release**. Real provider/hosted integrations need credentials
and deployment testing; semantic correctness still requires teacher judgment.

## Run locally

Requirements: Python 3.12+ and Node.js 22+.

```bash
# From the repository root
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env

# Terminal 1 — API (keep the repository root as working directory)
PYTHONPATH=backend uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2 — worker, same directory and virtual environment
source .venv/bin/activate
PYTHONPATH=backend python -m app.jobs.worker

# Terminal 3 — web
cd frontend
npm ci
npm run dev
```

Open **http://localhost:3000**. The local development teacher token is
`local-development-only`; change it in `.env` if needed. This is not a production
password/authentication scheme. API documentation: http://localhost:8000/docs.

The local SQLite database and uploaded originals persist across restart. No services
or paid accounts are needed for the explicitly labeled mock workflow. Both API and
worker must be running; otherwise jobs remain Queued. A crashed Running job can be
cancelled in the studio and retried.

Alternative: `docker compose up --build` runs PostgreSQL and all app processes.
Compose is supplied but not verified here (Docker daemon unavailable).

### Demo

1. Sign in and click **Load labeled Newton demo**.
2. Wait for objective mapping; click **Generate learning pack** in Overview.
3. Inspect Sources and an evidence passage.
4. Open **Quiz → Q3 → Regenerate question**.
5. Observe Q3 v2 and unchanged neighboring versions; open **Versions**.
6. Review Q3, attest to inspecting evidence/answers, record a review note and approve.
7. Q3 becomes locked. **Create new draft** preserves its published version.
8. Open **Student view → Practice**. Only published, non-stale content appears.
9. Replace source text to demonstrate staleness and automatic student exclusion.
10. Approve the video script and simulate the avatar job in **AI Teacher**.

Newton demo questions are explicitly teacher-authored fixtures in a mock provider,
not advertised as live AI output. They only apply to the original hashed demo source.
Fresh files use extractive development drafts. Set `LLM_PROVIDER=claude` and configure
`ANTHROPIC_API_KEY` plus an available `ANTHROPIC_MODEL` for actual generation. Claude
failures are visible and never silently replaced with fixtures.

## Implemented

- Next.js / strict TypeScript / Tailwind / shadcn-style Radix components / Lucide /
  TanStack Query; original Archivo, square corners, red accents and grid preserved.
- Dashboard, pack creation, source library, objective alignment, studio, quiz editor,
  answer key, validation, timeline, review dialogs, evidence drawer and student mode.
- Multiple PDF/PPTX/DOCX/TXT/Markdown files and pasted teaching notes.
- Source hashes/versions, page/slide/paragraph provenance, relational evidence and claims.
- Editable objectives, support-gap workflow, draft generation and single-asset regeneration.
- Eleven initial assets: explanation, three assessment levels, five quiz questions,
  exam-focus text and video script.
- Durable asynchronous generation/video jobs; failures/cancellation do not publish output.
- Pydantic contracts; deterministic schema/evidence/key/length checks; duplicate warnings;
  explicit NEEDS REVIEW results for unsupported semantic verification capabilities.
- Per-asset versioning and optimistic edit checks; approved versions cannot be edited or
  regenerated destructively. Whole-pack approval runs in one transaction.
- Server-derived answer key from published versions, even while newer drafts exist.
- Server-only quiz keys; correctness checked on server with answer-reveal policy.
- Supabase JWT adapter, PostgreSQL schema/RLS migration and private Storage adapter.
- YouTube API search and teacher approval, isolated from trusted source evidence.
- Mock avatar lifecycle tied to an approved script; no fake playable video.
- Student print/save-PDF using browser print.

## Architecture

```text
frontend/                       Next.js teacher studio + student surface
backend/app/api/                Authenticated HTTP contracts
backend/app/models/             Relational SQLAlchemy entities
backend/app/schemas/            Pydantic input/output contracts
backend/app/repositories/       Ownership-scoped reads and serialization
backend/app/services/           Extraction, storage, versions and approval logic
backend/app/validators/         Explicit, explainable quality results
backend/app/providers/          Claude / mock LLM and mock avatar adapters
backend/app/jobs/               Durable queue worker
backend/migrations/             Initial schema + additive staging RLS/Storage migrations
backend/tests/                  Deterministic integration tests
frontend/tests/                 Playwright browser workflow tests
LessonFoundry Frontend Design/  Original design assets, preserved
legacy/prototype_main.py        Earlier untested single-file scaffold, not used
```

`main.py` is now a compatibility entry point to the modular backend. The old SQLite
prototype schema is not migrated automatically. `docs/PRD.md` is the original supplied
requirements document; its historical “Built” labels are not implementation evidence. Prompts are versioned in
`backend/app/providers/llm.py`; asset settings record model/contract/prompt version.

See [architecture](docs/ARCHITECTURE.md), [design mapping](docs/DESIGN_IMPLEMENTATION.md)
and [Supabase deployment](docs/DEPLOYMENT.md).

## Supabase staging integration

The existing UI and learning workflow are preserved. Staging now has persistent/refreshing
Supabase sessions, verified JWT-derived request identity, transaction-scoped PostgreSQL
roles/RLS, private user-token-scoped Storage, 60-second original-file downloads, and a
credential-gated two-user verification script.

**No hosted staging project is connected yet:** credentials/project access were not
available. Do not interpret local PostgreSQL policy tests as managed Supabase verification.

| Verification category | Current evidence |
|---|---|
| Existing local application behavior | Original 16 backend tests and 2 browser tests pass |
| Local auth/storage unit tests | 10 additional tests pass; real JWT crypto, stub JWKS/HTTP |
| Real local PostgreSQL/RLS | 7 tests pass, including cross-user DML on all 19 tables |
| Managed Supabase Auth/PostgreSQL/Storage | BLOCKED: staging configuration absent |
| Hosted browser session/reload test | 1 skipped: staging credentials absent |
| AI generation / avatar | Explicit mock/fixture providers; no HeyGen changes |

Follow [Supabase staging runbook](docs/SUPABASE_STAGING.md),
[API authorization audit](docs/API_AUTHORIZATION.md), and `.env.staging.example`.
Apply additive migrations `002_staging_security.sql` and `003_private_storage.sql`
after the existing `001` schema. Use **restricted API and worker database logins**, not
postgres/service-role/BYPASSRLS as the application's DB user. No real secrets are included.

```bash
# No network operations without --run; missing configuration reports BLOCKED.
.venv/bin/python scripts/verify_supabase_staging.py
# Once a dedicated staging project, migrations, API/worker and test users are ready:
.venv/bin/python scripts/verify_supabase_staging.py --run
cd frontend
npx playwright test --config playwright.staging.config.ts
```

## Verification

```bash
PYTHONPATH=backend .venv/bin/pytest backend/tests -q
cd frontend
npm run typecheck
npm run build
npx playwright install --with-deps chromium
# Start API + worker + frontend first, in mock/local mode:
npx playwright test
# Separately, from repository root, with local PostgreSQL binaries installed:
.venv/bin/python scripts/run_local_postgres_tests.py
.venv/bin/python scripts/scan_secrets.py
```

Recorded local results: **26 backend tests passed** (including the original 16),
**7 local PostgreSQL security tests passed**, **2 browser tests passed**,
TypeScript checking passed, and a Next.js production build completed.
Browser tests captured no uncaught JavaScript page errors or console errors. Managed Supabase services were not used; local PostgreSQL tests use Auth/Storage SQL stand-ins. See [evaluation details](docs/EVALUATION.md).

| Case | Result | Evidence |
|---|---|---|
| Fresh teacher text upload, mapping and generation | Pass | Browser fresh-source workflow + API test |
| Unsupported objective excluded | Pass | `test_objective_gap_does_not_fabricate` |
| Q3 regenerated, approved neighbor untouched | Pass | [Q3 screenshot](docs/evidence/quiz-q3-v2.png) |
| Controlled history identifies unchanged assets | Pass | [Version history](docs/evidence/version-history.png) |
| Approved-only student response; keys not serialized | Pass | [Student view](docs/evidence/student-view.png) |
| Source replacement invalidates publication | Pass | `test_source_change_stales_and_unpublishes` |
| Invalid key blocks approval | Pass | `test_edit_optimistic_concurrency_and_invalid_key` |
| Instruction echo rule blocks approval | Pass (rule only) | `test_source_instruction_echo_blocked` |
| Provider failure leaves previous assets unchanged | Pass | `test_provider_failure_atomic` |
| Evidence and page/slide locations resolve | Pass | [Evidence drawer](docs/evidence/evidence-drawer.png) |
| Mock video requires approved script | Pass | [Mock workflow](docs/evidence/mock-video-workflow.png) |
| Tablet layout avoids document overflow | Pass | [Tablet studio](docs/evidence/tablet-studio.png) |

## Known limitations / remaining work

- Grounding entailment, semantic contradiction detection, factual/mathematical answer
  correctness and cognitive difficulty are **not proved automatically**. Evidence
  presence is not factual verification. Teacher review is explicitly required.
- Full semantic adversarial testing and live Claude educational evaluation are pending.
- No OCR, `.ppt`/`.doc` legacy conversion, equation-layout repair, or malware sandbox.
  Large documents are bounded; source retrieval currently sends bounded extracted
  evidence rather than using embeddings/vector retrieval.
- Exam Focus is editable evidence-linked text; structured flowcharts and attributed
  PYQ extraction/review are pending. No historical questions are invented.
- HeyGen is not integrated. Mock Ready means a simulated job, **not** an MP4; student
  Watch stays empty until actual rendering and output review are implemented.
- Signed source-file downloads are implemented for Supabase but not yet verified against
  its live Storage service. Video downloads and dedicated server-side PDF export remain pending.
- Hosted Supabase, real YouTube/Claude and Docker deployment were not verified here.
- Local queue needs manual cancellation/retry after interrupted Running jobs; no leases,
  scheduler, rate limiter, automatic recovery or Celery deployment yet.
- Student URLs are capability share links, not enrollment-based access control.
  Supabase token refresh/session persistence is implemented but awaits hosted verification.
  Share-link revocation, classroom roles and production security hardening remain.
- Tablet validation collapses inline; mobile navigation is basic. Full accessibility
  audit and exact visual comparison across all exported design states remain.

## Reused components and licensing

The supplied LessonFoundry design files and Modernist stylesheet are pre-existing
inputs. Next.js, React, FastAPI, SQLAlchemy, Pydantic, Radix, TanStack Query, Lucide,
pypdf, python-pptx and python-docx are third-party dependencies, not claimed innovations.
`pypdf` is used for extraction rather than introducing PyMuPDF's AGPL/commercial
licensing decision. Check all dependency licenses before distribution. No Cogniverse
components were present or reused in this repository.

The product-specific layer is source/evidence mapping, controlled generation contracts,
validation reporting, asset versioning, publication eligibility and teacher approval.
