# ADR-PLATFORM-001: LessonFoundry Platform Architecture Decisions

Status: **Accepted** (pre-implementation).

---

## 1. Supabase Auth + Google OAuth

**Context**: The MVP uses local tokens or Supabase email/password. Educational
users (teachers and students) overwhelmingly have Google accounts.

**Decision**: Use Supabase Auth with Google as the primary OAuth provider.

**Alternatives considered**:
- Auth0: More features but adds a vendor dependency and cost.
- Custom JWT: Insecure; requires password storage and session management.
- Firebase Auth: Good OAuth support but would replace the existing Supabase stack.

**Reason**: Supabase Auth is already integrated. Adding Google OAuth is a
configuration change in the Supabase dashboard plus a client-side
`signInWithOAuth({provider:'google'})` call. JWT verification is unchanged.

**Trade-offs**: Requires Supabase project configuration. Local dev mode kept as
fallback. Google Workspace for Education provides bulk account access.

---

## 2. Supabase PostgreSQL + RLS (extended)

**Context**: 19-table schema with RLS policies already covers teacher-owner
access patterns. Students have no authenticated access today.

**Decision**: Extend existing PostgreSQL schema with 3 new tables and 2 new
columns. Add RLS policies for student-member access pattern.

**Alternatives considered**:
- New database: Rejected. Migration risk, duplicated data.
- MongoDB for classrooms: Rejected. Inconsistent stack, no RLS.

**Reason**: Additive changes preserve all existing tests and functionality.
The relational model already handles ownership, versioning, and evidence chains.

**Trade-offs**: Nullable `classroom_id` on `units` is a temporary compromise
for backward compatibility. Can be made NOT NULL once all packs are assigned.

---

## 3. LessonFoundry-native classrooms

**Context**: Google Classroom is the reference model but has assignment/grading
features that don't apply to LessonFoundry's learning-pack workflow.

**Decision**: Build a simplified classroom model native to LessonFoundry.
Classrooms organize students and deliver published packs.

**Alternatives considered**:
- Google Classroom API integration: Too complex for MVP; requires OAuth scopes,
  API quotas, and doesn't handle LessonFoundry's generation/approval pipeline.
- No classrooms (keep share-token only): Doesn't support student authentication,
  progress tracking, or controlled access.

**Reason**: The classroom is an organization/delivery layer, not a grading system.
A lightweight model (classroom + members + join code) covers the essential flow.

**Trade-offs**: No assignment/rubric/grading features. Future Google Classroom
integration is possible because the domain model is flexible.

---

## 4. Existing `units` table as learning-pack foundation

**Context**: The `units` table already stores all learning-pack metadata, owns
assets, sources, jobs, and evidence chains. Renaming or replacing it would
require changing 50+ queries and 26 tests.

**Decision**: Extend `units` with `classroom_id` (nullable FK) and `published_at`
(nullable timestamp). Do not create a separate `learning_packs` table.

**Alternatives considered**:
- New `learning_packs` table: Would duplicate the unit concept and require
  migrating all FK references.
- Rename `units` to `learning_packs`: SQLAlchemy and existing tests use
  `__tablename__ = "units"` throughout. Renaming has high risk, zero benefit.

**Reason**: Minimal change, maximum compatibility. The "unit" is the learning
pack — adding two columns is safer than restructuring the entire data model.

**Trade-offs**: The internal name `units` doesn't match the UI term "Learning
Pack". This is a naming inconsistency, not an architectural problem.

---

## 5. DB-polling worker for MVP

**Context**: The worker polls the `jobs` table every second using
`SELECT ... FOR UPDATE SKIP LOCKED`. This supports multiple workers on
PostgreSQL without Redis.

**Decision**: Keep DB polling for MVP. Do not introduce Redis/Valkey.

**Alternatives considered**:
- Redis + Celery: Better throughput and real-time notifications, but adds
  infrastructure complexity and a new dependency.
- AWS SQS: Vendor-specific, overkill for single-EC2 deployment.

**Reason**: The poll loop works reliably. LLM calls take 10–60 seconds; 1-second
poll latency is imperceptible. Adding Redis is a low-priority optimization.

**Trade-offs**: No push notifications to frontend (TanStack Query polls at 1.2s
intervals). No retry queues. Worker crash leaves jobs in `Running` state.

---

## 6. Private S3 for storage

**Context**: Source files are currently stored on local filesystem (dev) or
Supabase Storage (staging). Production needs reliable, scalable, private storage.

**Decision**: Add `S3ObjectStore` as a third implementation of the existing
`ObjectStore` interface. Use for both source originals and generated exports.

**Alternatives considered**:
- Supabase Storage only: Limited bucket policies, no lifecycle rules, no CDN.
- GCS: Good alternative but adds a Google Cloud dependency; AWS is the
  deployment target.

**Reason**: S3 is the industry standard. The `ObjectStore` interface already
exists; S3 is a drop-in implementation. Presigned URLs for authorized downloads.

**Trade-offs**: Requires AWS credentials (IAM role on EC2, or access keys in env).
Local dev keeps filesystem storage unchanged.

---

## 7. Presigned downloads

**Context**: Students need to download PDF exports. The backend must authorize
access without proxying file bytes.

**Decision**: Backend verifies membership + publication + approval + export
existence, then generates a short-lived presigned S3 GET URL (5-minute expiry).

**Alternatives considered**:
- Backend proxy: Simple but doubles bandwidth and adds latency.
- Public S3 bucket: Insecure; anyone with the URL can access files.
- CloudFront signed cookies: More complex; better for streaming media later.

**Reason**: Presigned URLs are the standard S3 pattern. The backend is the
authorization gateway; S3 is the delivery mechanism. Short expiry prevents
URL sharing.

**Trade-offs**: If a student shares the presigned URL, anyone can download
within 5 minutes. Acceptable risk for educational content.

---

## 8. EC2 + Docker + Nginx

**Context**: The application has three long-running processes (Next.js, FastAPI,
Worker) and needs HTTPS termination.

**Decision**: Deploy on a single EC2 instance with Docker Compose. Nginx handles
TLS and reverse-proxies to Next.js (port 3000) and FastAPI (port 8000).

**Alternatives considered**:
- AWS ECS/Fargate: Better scaling but more complex setup.
- Vercel + Railway: Doesn't support long-running worker processes well.
- Kubernetes: Overkill for single-team MVP.

**Reason**: EC2 is simple to reason about, debug, and SSH into. Docker Compose
makes the deployment reproducible. Can migrate to ECS later.

**Trade-offs**: No auto-scaling. Single point of failure. Manual HTTPS setup
via Let's Encrypt/certbot.

---

## 9. Claude for generation

**Context**: The `ClaudeProvider` is implemented and tested. The system prompt
and Pydantic contracts are stable.

**Decision**: Keep Claude as the production LLM. `MockLLMProvider` for dev/test.

**Alternatives considered**:
- GPT-4: Comparable quality, different API contract.
- Open-source models: Lower quality for structured educational output.

**Reason**: Claude is already integrated. The system prompt is tuned for Claude's
JSON output mode. Switching would require prompt re-engineering.

**Trade-offs**: Vendor lock-in. API cost per generation (~$0.05–0.20 per pack).

---

## 10. HeyGen deferred

**Context**: The AI Teacher feature generates a video script. The future plan
is to render it via HeyGen's avatar API.

**Decision**: Defer HeyGen integration. Keep `MockAvatarProvider`. The
`AvatarProvider` interface exists for future implementation.

**Reason**: HeyGen integration requires API access, cost management, and video
storage. The script-first approach is already functional. Video rendering is
an enhancement, not a platform blocker.

**Trade-offs**: Students see "Video rendering provider not connected" instead of
an actual video. The approved script is readable.

---

## 11. Separate approval from publication

**Context**: Currently, "approved" means "visible to anyone with share-token."
With classrooms, the teacher needs control over when students see content.

**Decision**: Approval locks the content. Publication makes it visible to
classroom members. These are separate actions.

**Reason**: A teacher may want to approve content on Monday and publish it on
Wednesday. Or approve multiple packs and publish them together.

**Trade-offs**: Two-step process (approve then publish) adds one click. The UI
can suggest "Publish now?" after approval to streamline.
