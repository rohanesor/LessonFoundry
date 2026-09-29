# Supabase staging integration — runbook and security model

## Honest status

**Integration code and migrations are implemented. No managed Supabase project has
been created or connected in this environment.** No staging URL, project reference,
API key, database connection or test-user credentials were available. The live
verification command reported BLOCKED; the hosted browser test was skipped.

Verified separately:
- Original 16 local tests remain passing; local suite now has 26 passing tests.
- Seven additional tests passed on a disposable **real local PostgreSQL 18** server.
  Auth and Storage schemas in that test are SQL stand-ins, not Supabase services.
- Existing two browser tests passed; TypeScript and Next.js production build passed.
- A redacted working-tree/client-bundle pattern scan found no credentials. This folder
  has no `.git` directory, so commit/history verification was **not** possible.

No HeyGen work is part of this phase. Generation and avatar rendering remain explicitly
mocked for persistence testing. No production-readiness claim is made.

## 1. Create a dedicated staging project

An authorized project owner must create a **new staging** project in the Supabase
Dashboard (never use production). This repository does not contain account credentials
or a project-management access token, so it cannot provision a cloud project itself.

1. Record the staging project reference and URL locally.
2. Use asymmetric Auth JWT signing (ES256 or RS256); legacy shared-secret HS256 is not
   accepted. The API verifies JWKS signatures, expiry, issuer, audience, UUID subject
   and administrator-controlled `app_metadata.role = teacher`.
3. Apply migrations below as the project administrator, in order. Inspect SQL first.
4. Disable public signup if staging is intended only for invited test teachers.
5. Do not paste credentials into chat, source files, screenshots or test reports.

## 2. Apply the existing schema plus additive security migrations

| Migration | What it does |
|---|---|
| `001_initial.sql` | Existing 19 relational tables, PKs/FKs and indexes; unchanged |
| `002_staging_security.sql` | Explicit owner policies, forced RLS, restricted roles, Auth identity FK, audit timestamps/indexes, published-version FK, immutable approved versions, student allowlist functions |
| `003_private_storage.sql` | Private `sources` bucket, 10 MB bound and user/unit-scoped object policies |

Apply `001` only on a new database. For a staging database already on `001`, apply
`002` then `003`. These are one-time, transactional migrations, **not** idempotent
schema recreation. `002` requires existing application user IDs to match actual Auth
UUIDs; do not copy the `local-teacher` SQLite fixture into staging.

The migration administrator must be able to create roles and own the SECURITY DEFINER
functions with BYPASSRLS privileges. Supabase project administrators normally provide
this capability; verify permissions rather than weakening policies if deployment fails.
`lf_private` must **not** be added to Supabase's exposed API schemas.

Every table retains its original ownership path; no state blob replacement:

| Tables | Ownership path |
|---|---|
| `users` | Verified `auth.uid()`; `auth_user_id` references `auth.users.id` |
| `units` | `owner_id → users.id` |
| `source_documents` | `unit_id → units` |
| `source_versions` | `source_id → source_documents → units` |
| `source_chunks` | `source_version_id → source_versions → units` |
| `evidence` | `chunk_id → source_chunks → units` |
| `objectives`, `assets`, `resources`, `pack_events` | `unit_id → units` |
| `asset_versions` | Asset and objective must belong to the same unit; creator must be caller |
| `claims`, `quality_checks` | `version_id → asset_versions → assets → units` |
| `approvals` | Version ownership plus approving user matches caller |
| `jobs` | Unit ownership and optional target asset must be in that unit |
| `video_jobs` | Script, job and unit must agree |
| `asset_evidence`, `claim_evidence`, `objective_evidence` | Both endpoints must be visible to caller **and belong to the same unit** |

Missing creation timestamps and `updated_at` triggers are added in PostgreSQL without
changing existing ISO-string timestamp columns. Additional unique indexes cover
objective positions, evidence/chunk identity, resources, and pack revision events.

## 3. Provision restricted database logins

Use separate **NOINHERIT, NOBYPASSRLS, NOSUPERUSER** login roles. The following statements
contain no password; set strong passwords privately through an administrative tool,
e.g. psql's interactive `\password`, never in a committed SQL file or command history.

```sql
CREATE ROLE lessonfoundry_api_login LOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER;
CREATE ROLE lessonfoundry_worker_login LOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER;
GRANT lessonfoundry_api, lessonfoundry_student TO lessonfoundry_api_login;
GRANT lessonfoundry_worker TO lessonfoundry_worker_login;
GRANT CONNECT ON DATABASE postgres TO lessonfoundry_api_login, lessonfoundry_worker_login;
```

Use your project's actual database name if not `postgres`. Configure Supabase direct
or session-pooler connection strings for these users, with appropriate TLS and URL-
encoded passwords. Verify custom-role usernames with your project's pooler settings.

**Never use postgres/service-role/BYPASSRLS credentials as the API database login.**
Staging startup rejects privileged/inheriting API logins, worker-role membership,
application-table ownership and missing security policies.

For every authenticated transaction the API runs:

```text
Verified Supabase JWT → request-scoped UUID
    → SET LOCAL ROLE lessonfoundry_api
    → transaction-local request.jwt.claims
    → ownership RLS + existing route authorization
```

`SET LOCAL` and ContextVar cleanup prevent one pooled request from carrying another
user's identity. The browser cannot set these database roles. The separate worker
has an intentionally trusted cross-tenant service role for persisted jobs, **not** a
browser-facing credential. Do not reuse the worker login for the API.

## 4. Environment separation

Copy `.env.staging.example` to **`.env.staging`**, which is git-ignored. Fill in the
backend/test configuration privately. A matching project reference is required by the
live verification script to reduce accidental targeting of another project.

Frontend `frontend/.env.local` contains only:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_STAGING_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
BACKEND_URL=http://127.0.0.1:8000
```

Never put a service-role key, database password, Claude key or HeyGen key in a
`NEXT_PUBLIC_*` variable. The Supabase anon/publishable key and **the user's own session
JWT** necessarily appear in Auth/Storage HTTP calls; privileged keys must not.

The backend `SUPABASE_ANON_KEY` is the same public API key. Normal Storage requests
forward the **verified user's JWT**, not the service-role key. The service-role key is
only needed by the opt-in staging user-provisioning script and should not be supplied
to the web process. It is not required for ordinary runtime Storage operations.

## 5. Start staging API, worker and frontend

After migrating and configuring credentials:

```bash
# Repository root; activate the existing virtual environment
PYTHONPATH=backend .venv/bin/uvicorn app.main:app --env-file .env.staging --host 127.0.0.1 --port 8000

# Separate terminal; load the same staging config before importing the worker
PYTHONPATH=backend .venv/bin/python -c "from dotenv import load_dotenv; load_dotenv('.env.staging'); from app.jobs.worker import main; main()"

# frontend/.env.local must already contain staging public configuration
cd frontend
npm run build
npm start
```

When hosted, provide these values through the platform's secret manager instead of
files. Keep API and worker processes persistent. Existing UI, routes, editors and
versioning behavior remain unchanged.

## 6. RLS operation matrix

`authenticated` is the Supabase browser/PostgREST role. It gets **owner-only SELECT**
on application tables. It gets no direct INSERT/UPDATE/DELETE privileges: otherwise a
browser could bypass the application's validation/approval/versioning state machine.

| Operation | Browser/PostgREST | Authenticated backend `lessonfoundry_api` |
|---|---|---|
| SELECT owned rows | Allowed by explicit owner policy | Allowed by owner policy |
| SELECT other user's rows | Filtered out | Filtered out; API also returns 404 |
| INSERT own resource | Denied; use application API | Allowed subject to ownership/FKs/lifecycle |
| INSERT under other user's parent | Denied | RLS WITH CHECK rejects |
| UPDATE own resource | Denied; use application API | Allowed subject to owner/lifecycle checks |
| UPDATE another user's resource | Denied | No visible matching row / WITH CHECK rejects transfer |
| DELETE own resource | Denied; no general deletion API | Owner policy permits where constraints allow |
| DELETE another user's resource | Denied | No visible matching row |
| UPDATE/DELETE approved asset version | Denied | Database trigger rejects even for the owner/worker |

Not every table should have a public CRUD endpoint. Positive INSERT/UPDATE/DELETE RLS
checks use disposable owned resource rows under the backend role; immutable versions
are explicitly tested for denial. This distinction is intentional, not missing RLS.

## 7. Private Storage and upload isolation

The private bucket is `sources`. Object names follow:

```text
sources/{verified-user-id}/{owned-unit-id}/{random-upload-id}/{filename}
```

Both user prefix **and unit ownership** are checked by `storage.objects` policies.
SELECT allows owner read/sign; INSERT allows teachers into their own unit; UPDATE has
no policy (versioned originals cannot be overwritten); DELETE is owner-scoped for
rollback cleanup. A failed DB commit attempts compensating object deletion.

The existing parser first validates/extracts the bounded upload in memory to avoid
storing unsupported/unusable files. Storage upload and the transaction creating the
source/version/chunks/evidence then complete before the API reports success. Reloaded
previews read persisted rows. PDF pages, PPTX slides and DOCX paragraphs remain intact.

`GET /api/sources/{id}/versions/{number}/download` checks source ownership before
requesting a 60-second signed URL **with that same user's JWT**. A new Download original
button appears for original files when Supabase Auth is configured. Text notes have no
original-file download.

Signed URLs are intentionally bearer capabilities: someone given a valid URL can use
it until expiry. Isolation tests check that B cannot read A's guessed object path or
mint A's URL, not the impossible claim that a deliberately shared signed URL is private
to the original browser. Never log signed URLs. Audit pre-existing bucket policies:
PostgreSQL permissive policies OR together. Use a dedicated project with only these
policies for this bucket; a broad existing policy would defeat isolation.

## 8. Student boundary

The original student share-link behavior is preserved. The API's unauthenticated DB
role has **no table access**. It may call only two non-public-schema, fixed-search-path
SECURITY DEFINER functions that return approved/current-source content and answer
correctness. No draft payload, key, source, evidence, notes or approval metadata is
returned. The bearer share link itself remains enrollment-free by design.

## 9. Live verification — two real users, real PDF

Fill the two staging users' email/password fields in `.env.staging`. First run can
provision them using the backend-only service-role key:

```bash
.venv/bin/python scripts/verify_supabase_staging.py --run --provision-users
# Subsequent runs: existing test users, no administrator credential required
.venv/bin/python scripts/verify_supabase_staging.py --run
```

The script signs in normally as each teacher, creates separate packs, uploads a real
text PDF fixture, verifies persisted page evidence, tests both directions of Storage
isolation, edits an explanation, regenerates Q3, checks all neighbors, refreshes a
Supabase session, approves/reloads, tests server locks/student filtering, tests
PostgREST isolation, then tests actual SQL RLS SELECT/INSERT/UPDATE/DELETE using the
restricted backend connection. It never treats service-role reads as proof of RLS.

Use `--pdf path/to/your.pdf` for another real source; it must support the scripted
Newton/force objectives. The included PDF is explicitly teacher-authored test material,
not an invented historical exam or fake extraction result.

Output: `docs/evidence/supabase-staging-report.json`, containing check labels and
pass/fail only. No tokens, passwords, object paths or signed URLs are written. Test
packs remain for manual inspection. Use a dedicated project; delete it through the
Dashboard when no longer needed rather than disabling audit protections to clean data.

### Browser reload/session checks

```bash
cd frontend
npx playwright test --config playwright.staging.config.ts
```

This separate test signs in as A, creates/uploads, edits/reloads, regenerates/reloads,
approves/reloads, checks Student Mode, signs in as B in a new browser context, verifies
isolation, and verifies sign-out persists after reload. It also checks for privileged
secret values in network requests. Trace/video/screenshot recording is disabled so
password-entry traffic and session tokens are not recorded in traces. A custom reporter
redacts failure details. Treat any local failure DOM/context artifacts as private and
do not share them; `test-results/` remains git-ignored.

The test is **skipped**, not passed, when staging configuration is absent.

## 10. What to report after a live run

Record migration deployment, Auth/JWT/refresh results, DB role flags, all RLS operation
results, bucket privacy/isolation, state persistence, approved-server-lock failures,
student allowlisting, browser reload/sign-out, and the redacted scan result. Attach
only non-sensitive evidence. Passing staging still does not establish production
readiness: backups, enrollment, rate limits, malware isolation, auth revocation latency,
queue recovery and load testing remain separate work.
