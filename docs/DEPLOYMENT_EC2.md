# LessonFoundry deployment to AWS EC2

## Status: deployment preparation, not a deployment record

**Nothing has been deployed to EC2 from this workspace.** Docker Engine is unavailable in the current WSL environment, and the repository has no verified managed Supabase project, production domain, EC2 instance, or release credentials. Do not report the service as deployed or production-ready until the acceptance gates below are completed.

The local functional stack is tested. Managed Supabase staging, a live production provider, EC2 ingress/TLS, restore procedures, and production load/security behavior are not verified. See [Supabase staging runbook](SUPABASE_STAGING.md), [adaptive E2E report](ADAPTIVE_E2E_RESULTS.md), and [production hardening report](PRODUCTION_HARDENING.md).

## Recommended EC2 architecture

```text
Internet :80/:443
      │
  Nginx + TLS ───── Next.js web container (127.0.0.1:3000)
      │             FastAPI API container (127.0.0.1:8000)
      │                         │
      └────────────────── Worker container
                                ├─ Supabase Auth + PostgreSQL
                                ├─ private S3 bucket (instance IAM role)
                                └─ approved model provider (optional)
```

Use a supported Ubuntu LTS EC2 instance sized for the expected traffic, an Elastic IP or stable DNS target, a dedicated production Supabase project, and a private S3 bucket. Keep PostgreSQL managed by Supabase; do not publish the database, API, web, or worker ports to the internet. The repository's `docker-compose.yml` is **local development only** and uses local PostgreSQL/local auth. Do not use it as an EC2 production compose file.

## Gate 0 — prerequisites (must be supplied by the deployment owner)

- AWS account/project authorization and a dedicated EC2 production instance or approval to create one.
- Domain name and DNS control.
- Production Supabase project, asymmetric JWT signing, restricted API and worker database roles, and separate production Auth users.
- Private S3 bucket and EC2 instance profile/IAM policy limited to that bucket/prefix.
- Secret-manager entries for backend database URLs and any selected provider credentials.
- A release owner to approve content-provider, privacy, backup, retention, and incident-response settings.

Do not send passwords, private keys, API keys, database URLs, Supabase service-role keys, or student data in chat or commit them to the repo. Store backend secrets in AWS Systems Manager Parameter Store (SecureString) or Secrets Manager; prefer instance IAM credentials for AWS SDK access. Keep frontend build configuration to `NEXT_PUBLIC_SUPABASE_URL` and the public anon/publishable key only.

## Gate 1 — verify the managed application foundation

Before EC2 deployment:

1. Create a **dedicated production** Supabase project; never promote the test database by copying its local fixtures.
2. Inspect and apply the reviewed PostgreSQL migrations in order (`001_initial.sql`, then the applicable staging-security and private-storage migrations described by `SUPABASE_STAGING.md`). Confirm the exact production migration inventory before applying anything; the SQL is not a blind/idempotent deployment command.
3. Create independent NOINHERIT/NOBYPASSRLS API and worker logins. Verify they are not table owners, superusers, BYPASSRLS roles, or members of each other's roles.
4. Run `scripts/verify_supabase_staging.py --run` against a disposable staging project with two distinct users and a real sanitized PDF. Require a clean report, then repeat production-specific config checks against production before rollout.
5. Verify managed Auth sign-in, role claims, session refresh, storage access, and student enrollment in the target browser. The currently recorded repository status says these managed-service checks are blocked; do not skip them.

## Gate 2 — resolve launch scope and safety

- The API intentionally disables code submission when `APP_ENV=staging|production` or `AUTH_MODE=supabase`. The new local Bubblewrap runner is not installed or verified in the deployment image. For an initial production rollout, either **hide/disable coding challenges in the production UI** and make the launch scope explicit, or implement and independently security-review an isolated runner in the target image before enabling the endpoint. Never turn off the API fail-closed guard to make a demo work.
- Use real LLM generation only after provider configuration, spending limits, rate controls, data-processing review, and teacher-facing disclosure are approved. Mock generation is the safe default and must not be described as live model output.
- Confirm upload bounds, private S3 policy, object lifecycle, database backups/restore, health alarms, error monitoring, log retention, data deletion, and incident contacts.
- Apply rate limiting at the public edge or use a shared rate-limit store before scaling across API processes; the in-process limiter is not distributed.

## Gate 3 — host and network setup

1. Launch EC2 with an attached IAM instance profile limited to the deployment's S3 access and required secret reads. Do not place static AWS keys in the instance `.env`.
2. Security group inbound rules: SSH (22) only from the deployment administrator's IP/VPN; HTTP/HTTPS (80/443) from the intended audience. Do not allow public access to 3000, 8000, PostgreSQL, SSH from `0.0.0.0/0`, or Docker's API.
3. Install Docker Engine + Compose plugin, Nginx, and Certbot from supported packages. Configure OS patching, disk monitoring, time synchronization, and a non-root deployment account with narrowly scoped Docker permissions.
4. Create `/opt/lessonfoundry` owned by the deployment account. Deploy a pinned, reviewed release tag/commit; do not deploy from an unreviewed working tree.
5. Create a root-readable-only runtime secret source (mode `0600`) or use a systemd/SSM injection mechanism. Do not copy the repository's `.env.example` as a production file. Do not pass backend secrets to the web container.

## Gate 4 — container/release configuration

The root `docker-compose.yml` is explicitly local development and is **not** the production deployment manifest. Before EC2 release, provide and review a production manifest with these properties:

- `APP_ENV=production`, `AUTH_MODE=supabase`, `STORAGE_PROVIDER=s3` (or verified private Supabase Storage), and separate restricted API/worker PostgreSQL URLs.
- API and worker run as non-root, with read-only root filesystems where practical, minimal capabilities, bounded CPU/memory, restart policy, and health checks.
- API/worker ports bind only to loopback or a private container network; Nginx is the only public ingress.
- Web gets only `BACKEND_URL`, Supabase public URL, and public anon/publishable key. It never receives a service-role key, database password, model key, or AWS secret.
- Worker gets only its worker DB role and secrets it actually needs; API gets only its API DB role and secrets it actually needs. No Supabase service-role key in normal API/worker runtime.
- Private source uploads use persistent/object storage with lifecycle and backup rules. Do not rely on an ephemeral container filesystem.
- Images are built from a pinned release revision and scanned; do not mount the source repository into production containers.

Do not use `docker compose up` with the repository's local file as the production deployment command. The production compose manifest, image policy, and secret injection remain deployment tasks; no credential-bearing production manifest has been added to this repository.

## Gate 5 — domain, TLS, and ingress

1. Point the domain A/AAAA records at the EC2 Elastic IP; verify DNS before requesting certificates.
2. Install an HTTP-only Nginx virtual host for the real domain and proxy to `127.0.0.1:3000` (web) and `127.0.0.1:8000` (`/api/`). Set correct forwarded headers, a 12 MB upload bound consistent with the API, and WebSocket upgrade headers for Next.js.
3. Run `nginx -t`, obtain a certificate with Certbot for the real hostname, and validate HTTP→HTTPS redirect and automated renewal. The checked-in `deploy/nginx.conf` contains example domain/certificate paths and must not be installed unchanged.
4. Confirm Supabase OAuth callback URLs use the final HTTPS hostname and do not contain localhost.

## Gate 6 — release checks and rollback

Before opening traffic:

```bash
# On CI/release build host
PYTHONPATH=backend .venv/bin/pytest backend/tests -q
cd frontend && npm ci && npm run typecheck && npm run build
```

Then, against the actual EC2 release (not local mocks), verify:

- `https://<domain>/`, `/api/health`, and `/api/ready` return expected results; inspect container health and logs without printing secret values.
- Teacher and student sign-in with separate production accounts, enrollment, source upload, approval/publication, and student content filtering work.
- Cross-user access is denied; normal uploads/downloads use private storage policies; no backend secret is in browser bundles, HTML, network requests, or logs.
- Worker processes a real test job; provider errors are visible; retries/restarts do not publish partial or stale content.
- Code execution returns 503 in production until a separately reviewed secure runner is enabled; the student UI must communicate that limitation rather than offer a broken submit action.
- Backups and a restore drill, disk pressure, worker restart, API restart, TLS renewal, and rollback to the previous image have been exercised.

Record release commit/image digest, migrations, test report, reviewer, date, and rollback point in a deployment log. Keep the initial rollout private or allowlisted until acceptance is complete.

## Current blockers / no-go criteria

| Item | Status |
|---|---|
| EC2/Docker execution from this WSL workspace | Blocked: Docker daemon/WSL integration unavailable |
| AWS account/instance/domain authorization | Not verified in this workspace |
| Managed Supabase production/staging project and two-user live tests | Not verified; staging docs currently record BLOCKED |
| Production manifest and secret injection | Not prepared; local Compose is development-only |
| Bubblewrap runner in production image | Not installed/configured; hosted code execution remains fail-closed |
| Real provider and production content evaluation | Not configured/verified |
| HTTPS, security groups, backups/restore, monitoring | Must be performed and verified on the target account/host |

A deployment can proceed only after the owner supplies target account/domain/project access through approved secure channels and the above gates are explicitly accepted. This document prepares the work; it does not claim deployment success.
