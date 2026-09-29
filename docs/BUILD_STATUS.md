# Build acceptance and staging status

The original local MVP remains implemented. This integration phase changes persistence,
authentication and authorization only; the verified Studio design is preserved.

## Existing functionality — verified locally

| Check | Status |
|---|---|
| Original 16 backend acceptance tests | Passed again, unchanged |
| Expanded auth/storage unit suite | 26 total passed |
| Production hardening unit tests | Added; 26 still pass |
| Local PostgreSQL RLS/security tests | 7 passed |
| Existing 2 browser tests | Passed again |
| New production browser tests | Added; **9 passed, 3 visual-diff failures** |
| Design-token browser tests | **4 passed** |
| Browser runtime dependency | Fixed locally (`libnspr4`/`libnss3` extracted from debs) |
| TypeScript / production Next.js build | Passed |
| Teacher Studio, fresh uploads, extracted preview, evidence drawer | Existing browser tests pass |
| Explanation, five-question quiz, single-question regeneration | Existing tests pass |
| Unaffected neighbors and version history | Existing tests pass |
| Approval persistence, server-side asset locks and student filtering | Local SQLite and local PostgreSQL tests pass |
| Tablet layout, loading/error surfaces | Existing tests pass; no redesign |
| Mock AI Teacher workflow | Preserved; no real rendering or HeyGen changes |
| Structured flowcharts | Implemented and rendered in Studio / Student Mode |
| Per-user rate limiting | Implemented; off by default in local/test |
| Structured job logging | Implemented |
| Approved-asset immutability E2E | Test added |
| Official design handoff integration | Tokens, LFIcon, logos, favicon and icons copied |
| Brand color system | Aligned to handoff `#2763ae` / `#191f2b` / `#f3f2f2` |
| Design adherence checker | `scripts/design-adherence-check.py` passes |
| Visual regression tests | `frontend/tests/visual.spec.ts` + `playwright.visual.config.ts` added |

## Supabase staging acceptance — NOT COMPLETE

No staging credentials/project access were available. “Implemented” is not “verified
against Supabase.” The live script exited BLOCKED and the hosted browser test was skipped.

| Required check | Implementation / local evidence | Managed Supabase staging |
|---|---|---|
| Dedicated staging connected | Guarded environment examples/runbook | **Blocked** |
| Authentication | JWT signature/issuer/audience/expiry/role tests pass | **Not executed** |
| Session persistence / refresh / sign-out | Singleton Supabase client + credential-gated browser test | **Not executed** |
| PostgreSQL persistence | Real local PostgreSQL integration tests pass | **Not executed** |
| Explicit RLS | 19 table policies, forced RLS, restricted roles; locally applied/tested | **Not applied here** |
| Cross-user access denied | SELECT + negative INSERT/UPDATE/DELETE tested on all 19 tables locally | **Not executed** |
| Private source Storage | Private bucket migration + user-JWT adapter | **Not applied/verified here** |
| Upload isolation / guessed object paths | Local SQL policy stand-in + token-forwarding unit tests pass | **Not executed** |
| Pack / asset / version persistence | Local integration tests pass; hosted reload test supplied | **Not executed** |
| Approval persisted and locked | API checks + DB immutable-approved-version trigger tested locally | **Not executed** |
| Student API approved-only | Narrow private database functions tested locally | **Not executed** |
| Original regression suite | 16 original backend + 2 browser tests pass | Local only |
| No privileged key in client bundles | Redacted pattern scan: 0 findings | Live network test pending |
| No secrets committed | No `.git` directory; commit history cannot be verified | Not claimable |
| README / BUILD_STATUS / runbook | Updated | Complete documentation |

## Executed security checks

- **26** local backend tests passed (16 original + 10 JWT/Storage tests).
- **7** additional tests passed on a disposable PostgreSQL 18 cluster.
  These apply all three migrations against local Auth/Storage SQL stand-ins.
  They are **not managed Supabase tests** and mock the remote JWT verification step.
- **2** existing Chromium browser tests passed, with no captured page/console errors.
- **1** Supabase browser test was skipped for missing staging configuration.
- Strict TypeScript checking and production build passed.
- Working-tree/client-bundle credential-pattern scan: **0 findings**; no matched
  values printed. This is not a comprehensive Git-history secret audit.

## Required next action

An authorized owner must configure a dedicated staging project, apply migrations,
create restricted database logins and populate `.env.staging` plus frontend-safe
`frontend/.env.local`. Do not paste keys into chat. Then run the live script and hosted
browser test in [SUPABASE_STAGING.md](SUPABASE_STAGING.md). Record actual results before
checking off hosted acceptance. Do not proceed to HeyGen on the basis of these local tests.
