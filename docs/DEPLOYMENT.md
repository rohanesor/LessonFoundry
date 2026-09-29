# Deployment

## Local development

Use the three-process setup in the root README. SQLite/local-token mode remains an
explicit development adapter. `docker compose up --build` supplies local PostgreSQL
but was not verified against a running Docker daemon here.

## Supabase staging

Use [SUPABASE_STAGING.md](SUPABASE_STAGING.md) as the authoritative deployment/security
runbook. It replaces the earlier privileged-DB/direct-service-key deployment sketch.

Required differences from the original scaffold:

- Apply `001_initial.sql`, then additive `002_staging_security.sql` and
  `003_private_storage.sql` to a **dedicated staging** project.
- API and worker use different restricted PostgreSQL login roles. The API login must
  not own tables, inherit broad access, have BYPASSRLS, or join the worker role.
- Every teacher transaction adopts its verified UUID through transaction-local claims
  and `SET LOCAL ROLE lessonfoundry_api`. Public student requests use narrow SQL
  allowlist functions, never blanket SELECT privileges.
- Supabase Auth sessions persist and refresh through one frontend client. API requests
  obtain the latest access token, not a stale copied sessionStorage JWT.
- Normal private Storage calls use the teacher's verified JWT + public API key. The
  service-role key is only for explicit administrative provisioning, never the browser
  or normal upload/signing path.
- Backend-only configuration is separated from the two `NEXT_PUBLIC_SUPABASE_*` values.
- Staging startup fails closed on SQLite, incomplete configuration or privileged roles.

Managed Supabase deployment has **not** been executed: no project/credentials were
available. Do not mark the acceptance checklist passed until both the live two-user
script and hosted browser reload/session checks execute successfully.

## Production remains a separate phase

Staging success does not cover backups/restoration, enrollment/share-link revocation,
rate limits, malware scanning, queue leases/recovery, online JWT revocation checking,
load testing, data retention/deletion, accessibility audit or live AI content quality.
No HeyGen integration was added in the staging-foundation phase.
