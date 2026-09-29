# API authorization audit

Every protected route uses the shared `teacher` dependency: verified Supabase JWT,
administrator-controlled teacher role, request-scoped UUID and transaction-local RLS.
Browser `ownerId`, `userId`, `createdBy` fields never establish identity.

| Routes | Resource authorization and state rule |
|---|---|
| `GET /packs`, `POST /packs` | List/create for verified caller; owner derived server-side |
| `GET /packs/{pid}` | Unit owner check + database RLS |
| `POST /packs/{pid}/sources`, `/sources/text` | Unit ownership; replacement source must be same unit; immutable new source version |
| `GET /sources/{sid}/versions/{number}/download` | Source→unit owner before user-token-scoped signing; 60-second expiry |
| `POST /packs/{pid}/gap-check`, `/generate` | Unit ownership; only one active job; generation cannot overwrite existing pack |
| `GET /packs/{pid}/status` | Unit ownership; own jobs only |
| `POST /jobs/{jid}/cancel` | Job→unit ownership; only Queued/Running jobs |
| `GET /assets/{aid}`, `/versions`, `/evidence` | Asset→unit ownership; historical source access remains owner-only |
| `PATCH /assets/{aid}` | Ownership + expected version + approved-version lock |
| `POST /assets/{aid}/regenerate` | Ownership + approved-version lock; worker compares expected pack revision before commit |
| `POST /assets/{aid}/draft` | Ownership; only creates new version, never edits published version |
| `POST /assets/{aid}/approve` | Ownership + exact reviewed version + no FAIL/stale checks; records actor server-side |
| `POST /packs/{pid}/approve` | Ownership + exact reviewed pack revision + supported objectives; atomic approval |
| `GET /packs/{pid}/validation`, `/versions`, `/answer-key` | Unit ownership; key derived from published versions |
| `PATCH /objectives/{oid}` | Objective→unit ownership; revised contract marks prior generated assets stale |
| `POST /video-jobs`, `GET /video-jobs/{vid}` | Unit/job ownership; rendering requires approved current-source script; mock only |
| `GET /packs/{pid}/resources`, `POST /packs/{pid}/resources/search` | Unit ownership; real external IDs, no trusted evidence linkage |
| `POST /resources/{rid}/approve` | Resource→unit ownership |
| `POST /demo` | Authenticated teacher + explicit mock provider; owns new fixture pack |

Public exceptions:
- `GET /health`: non-sensitive deployment mode/availability metadata only.
- `GET /student/{token}`: unguessable share capability, approved/current-source fields
  only; draft content unavailable (the existing empty state is preserved).
- `POST /student/{token}/answers/{vid}`: capability + published question version;
  only correctness and policy-permitted solution. No teacher JWT or keys in response.

The student role cannot SELECT application tables; the two allowlisted database
functions are not exposed as public Supabase RPCs. Source changes intentionally
invalidate student eligibility rather than silently mutate previously approved text.

## Tests and boundaries

Local tests exercise ownership and pipeline locks. Local PostgreSQL tests additionally
exercise RLS and pooling boundaries. `scripts/verify_supabase_staging.py` performs
live two-user API, PostgREST, Storage and SQL tests when credentials are available.

A Supabase JWT remains valid until expiry even after refresh-token revocation unless
additional online revocation checks are implemented. Current sign-out revokes the
session refresh token and clears client session/cache; short token lifetimes are
recommended. This is not enrollment-aware/high-stakes assessment authorization.
