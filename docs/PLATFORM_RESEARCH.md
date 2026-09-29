# LessonFoundry — Platform Research

Architectural decisions with rationale for the classroom/platform implementation.

---

## 1. Authentication — Supabase Auth + Google OAuth

### Decision

Use Supabase Auth as the single identity provider. Enable Google OAuth as the
primary login method for both teachers and students.

### Rationale

- Supabase Auth already implemented and verified for JWT/session lifecycle.
- Google OAuth is the expected login method for educational users (teachers and
  students already have Google accounts via Google Workspace for Education).
- Supabase supports Google as an OAuth provider with zero custom infrastructure.
- JWT claims carry `app_metadata.role` for server-side role determination.
- Session refresh, token rotation, and PKCE are handled by the Supabase client.

### Architecture

```
Browser → Supabase Auth (Google OAuth) → JWT with role claim
                                            ↓
FastAPI verifies JWT → extracts user_id + role → authorize
```

### Role assignment

- Teachers self-register and are assigned `role: teacher` in `app_metadata`.
- Students self-register and are assigned `role: student`.
- Role is set during first login via a server-side function or admin API.
- **The backend never trusts a frontend-selected role for authorization.**
- The frontend role selector on the login page is UX context only — it controls
  which Supabase sign-up flow to invoke (which sets `app_metadata.role`).

### Local development fallback

- `AUTH_MODE=local` continues to work with `LOCAL_TEACHER_TOKEN`.
- A second token `LOCAL_STUDENT_TOKEN` can support student testing.
- Local mode sets `user_id` to `"local-teacher"` or `"local-student"` and
  `role` to the matching value.

---

## 2. Storage — AWS S3

### Decision

Use AWS S3 with private buckets for all uploaded sources and generated exports.
Access via presigned URLs only.

### Rationale

- Supabase Storage is limited in bucket policies, lifecycle rules, and CDN.
- S3 is the industry standard for object storage with fine-grained IAM.
- Presigned URLs allow the backend to authorize access without proxying bytes.
- Object keys are deterministic and scoped by user/classroom/pack/version.
- The `ObjectStore` interface already exists; S3 is a new implementation.

### Object key schema

```
sources/{user_id}/{source_id}/{version_id}/{filename}
exports/{classroom_id}/{pack_id}/{version}/{export.pdf}
media/{classroom_id}/{pack_id}/{version}/{video.mp4}   (future)
```

### Security

- Bucket policy: private, no public access.
- IAM role with least privilege: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`.
- Backend generates presigned upload URLs (teacher uploads directly to S3).
- Backend generates presigned download URLs (student downloads via signed link).
- All URLs expire in 5–15 minutes.
- Content-Type and size validation on upload.
- **AWS credentials are server-side only**, never exposed to frontend.

### Local development fallback

- `STORAGE_PROVIDER=local` uses local filesystem (existing behavior).
- `STORAGE_PROVIDER=s3` uses S3.
- `STORAGE_PROVIDER=supabase` continues to work for existing deployments.

---

## 3. Classroom Model — Google Classroom reference

### Decision

Create a LessonFoundry-native classroom model inspired by Google Classroom's
conceptual structure, but simplified for the learning-pack use case.

### Google Classroom concepts (reference)

| Google Classroom | LessonFoundry equivalent |
|---|---|
| Course | Classroom |
| Teacher | Teacher (owner) |
| Student | Student (member) |
| Course materials | Learning Packs |
| Topics | — (not needed for MVP) |
| Stream | Classroom stream (lightweight) |
| Coursework | — (packs serve this role) |
| Class code | Join code |

### Why NOT copy Google Classroom exactly

- Google Classroom manages assignments, rubrics, grading, and Google Drive
  integration — none of which apply to LessonFoundry.
- LessonFoundry's core unit is the **learning pack**, not an assignment.
- The classroom is an **organization and delivery** layer, not a grading system.

### Classroom lifecycle

```
Teacher creates classroom
    ↓
System generates join code (e.g., LF-7K29Q)
    ↓
Teacher shares code
    ↓
Students join with code
    ↓
Teacher creates/publishes learning packs in classroom
    ↓
Students access published packs
```

### Join code design

- Format: `LF-XXXXX` (5 alphanumeric characters, uppercase, excluding confusable
  chars like 0/O, 1/I/L).
- Generated server-side with `secrets.token_hex`.
- Unique constraint in database.
- Rate-limited join endpoint to prevent brute-force enumeration.
- Teacher can regenerate code if compromised.

---

## 4. Database schema additions

### `users` table (extend existing)

```sql
ALTER TABLE users ADD COLUMN email VARCHAR;
ALTER TABLE users ADD COLUMN avatar_url VARCHAR;
ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'teacher';
```

### `classrooms` table (new)

```sql
CREATE TABLE classrooms (
    id VARCHAR(36) PRIMARY KEY,
    owner_id VARCHAR(36) NOT NULL REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    join_code VARCHAR(10) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at VARCHAR NOT NULL,
    updated_at VARCHAR NOT NULL
);
```

### `classroom_members` table (new)

```sql
CREATE TABLE classroom_members (
    id VARCHAR(36) PRIMARY KEY,
    classroom_id VARCHAR(36) NOT NULL REFERENCES classrooms(id),
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    joined_at VARCHAR NOT NULL,
    UNIQUE (classroom_id, user_id)
);
```

### `units` table (extend existing)

```sql
ALTER TABLE units ADD COLUMN classroom_id VARCHAR(36) REFERENCES classrooms(id);
ALTER TABLE units ADD COLUMN published_at VARCHAR;
```

- `classroom_id` is nullable so existing packs continue to work.
- `published_at` being non-null means the pack is published.

---

## 5. Pack lifecycle (publish vs approve)

### Decision

Separate approval from publication.

```
DRAFT → READY_FOR_REVIEW → APPROVED → PUBLISHED
```

### Rationale

- A teacher may approve content but not yet want students to see it.
- Publication is an explicit "release to classroom" action.
- Unpublishing removes student access without losing approval state.
- This matches Google Classroom's "Post" / "Schedule" / "Draft" model.

### Implementation

- `units.published_at` column (nullable timestamp).
- `POST /api/packs/{pid}/publish` sets `published_at`.
- `POST /api/packs/{pid}/unpublish` clears `published_at`.
- Student visibility requires: `published_at IS NOT NULL` AND approved assets.

---

## 6. API design

### New endpoints

```
POST   /api/classrooms                     Create classroom
GET    /api/classrooms                     List teacher's classrooms
GET    /api/classrooms/{cid}               Classroom detail
PATCH  /api/classrooms/{cid}               Update classroom
POST   /api/classrooms/{cid}/join          Student joins with code
GET    /api/classrooms/{cid}/members       List members
DELETE /api/classrooms/{cid}/members/{uid}  Remove member

GET    /api/classrooms/{cid}/packs          List packs in classroom
POST   /api/classrooms/{cid}/packs          Create pack in classroom
POST   /api/packs/{pid}/publish             Publish to classroom
POST   /api/packs/{pid}/unpublish           Unpublish

GET    /api/student/classrooms              Student's classrooms
GET    /api/student/classrooms/{cid}        Student classroom detail
GET    /api/student/classrooms/{cid}/packs  Published packs
GET    /api/student/packs/{pid}             Published pack content
POST   /api/student/packs/{pid}/download    Generate download URL
POST   /api/student/packs/{pid}/answers/{vid}  Check quiz answer
```

### Existing endpoints preserved

All existing `/api/packs/*` and `/api/assets/*` endpoints continue to work
for backward compatibility. The classroom layer is additive.

---

## 7. Deployment — EC2 target

### Decision

Target AWS EC2 with Docker Compose for the MVP deployment.

### Architecture

```
EC2 instance
├── Nginx (reverse proxy, HTTPS via Let's Encrypt)
├── Next.js container (port 3000)
├── FastAPI container (port 8000)
├── Worker container (same image, different entrypoint)
└── Redis/Valkey container (optional, for job queue)

External:
├── Supabase (Auth + PostgreSQL)
├── AWS S3 (object storage)
└── Claude API (LLM)
```

### Why not serverless

- The worker requires long-running processes (LLM calls take 10–60 seconds).
- FastAPI on Lambda requires significant adaptation.
- EC2 is simpler to reason about and debug for a small team.
- Can migrate to ECS/Fargate later if needed.

### Environment variables

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    (backend only)
DATABASE_URL=                  (Supabase PostgreSQL connection string)

# AWS S3
AWS_REGION=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=             (backend only, or use IAM role)
AWS_SECRET_ACCESS_KEY=         (backend only, or use IAM role)

# Claude
ANTHROPIC_API_KEY=             (backend only)
ANTHROPIC_MODEL=

# Application
AUTH_MODE=supabase
LLM_PROVIDER=claude
STORAGE_PROVIDER=s3
FRONTEND_ORIGIN=https://app.lessonfoundry.com
RATE_LIMIT=1

# Frontend (public)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

---

## 8. AI pipeline best practices

### Document ingestion

- Validate file type, size, and content before processing.
- Store original file immutably in S3 before extraction.
- Extract text with page/slide/paragraph provenance.
- Normalize whitespace, remove control characters.
- Existing `FileExtractor` already handles PDF/PPTX/DOCX/TXT/MD.

### Chunking

- Current approach: 1800-char windows with location attribution.
- Each chunk creates one Evidence record.
- Chunk boundaries should not split sentences (future improvement).

### Structured generation

- Pydantic schemas enforce output structure.
- Claude receives system prompt with slot definitions.
- Response is parsed as JSON; invalid responses raise errors.
- Each asset is independently versioned.

### Validation

- 13 deterministic checks run synchronously after generation.
- NEEDS_REVIEW checks require teacher judgment; they are not failures.
- FAIL checks block approval.

### Idempotency

- Jobs check `expected_revision` before committing.
- Duplicate `generate` requests rejected (409).
- `SKIP LOCKED` prevents double-processing.

### Retries

- Failed jobs are marked `Failed` with error message.
- Teacher can cancel and retry manually.
- No automatic retry (prevents runaway LLM costs).

---

## 9. Export pipeline (new)

### Decision

Generate downloadable PDF from approved pack assets.

### Architecture

```
Teacher clicks Publish
    ↓
Pack is published
    ↓
Export job queued
    ↓
Worker renders PDF from approved assets
    ↓
PDF uploaded to S3
    ↓
Student clicks Download
    ↓
Backend verifies membership + publication
    ↓
Presigned S3 URL returned
    ↓
Browser downloads
```

### PDF generation

- Use `weasyprint` or `reportlab` in the worker.
- Template: LessonFoundry branded, with explanation, assessment, quiz,
  exam focus sections.
- The PDF includes approved content only, not drafts or internal metadata.

---

## 10. Security considerations

### Authorization matrix

| Action | Teacher | Student | Verified by |
|---|---|---|---|
| Create classroom | ✓ | — | `role == teacher` |
| Join classroom | — | ✓ | `role == student` + valid join code |
| Manage classroom | ✓ (owner) | — | `classroom.owner_id == user_id` |
| Create pack | ✓ | — | `role == teacher` + classroom ownership |
| Upload source | ✓ | — | `role == teacher` + pack ownership |
| Generate | ✓ | — | `role == teacher` + pack ownership |
| Approve | ✓ | — | `role == teacher` + pack ownership |
| Publish | ✓ | — | `role == teacher` + pack ownership |
| View published pack | ✓ | ✓ | membership + published |
| Download | ✓ | ✓ | membership + published + approved |
| View evidence | ✓ | — | `role == teacher` + pack ownership |
| Regenerate | ✓ | — | `role == teacher` + pack ownership |
| Edit | ✓ | — | `role == teacher` + pack ownership |

### Student access path

```
User.role == 'student'
    AND ClassroomMember.user_id == user_id
    AND ClassroomMember.classroom_id == classroom_id
    AND ClassroomMember.status == 'active'
    AND Unit.classroom_id == classroom_id
    AND Unit.published_at IS NOT NULL
    AND AssetVersion.state == 'APPROVED'
    AND AssetVersion.source_revision == Unit.source_revision
```

---

## Summary of decisions

| Area | Decision | Reason |
|---|---|---|
| Auth | Supabase Auth + Google OAuth | Already implemented; educational users have Google |
| Storage | AWS S3 private bucket | Industry standard; presigned URLs; lifecycle |
| Database | Extend existing PG schema | Additive changes preserve backward compatibility |
| Classroom | LessonFoundry-native model | Simpler than Google Classroom; fits learning-pack model |
| Pack lifecycle | Separate approve from publish | Teacher control over student visibility |
| Export | PDF via worker + S3 | Async generation, secure download |
| Deployment | EC2 + Docker Compose | Simple, debuggable, long-running worker support |
| Worker | Keep DB poll for MVP | Works; can migrate to Redis later |
| LLM | Keep Claude provider | Already implemented and tested |
| Avatar | Keep mock; defer HeyGen | Explicit out-of-scope |
