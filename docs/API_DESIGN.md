# LessonFoundry — Phase 4: API Contract Design

All endpoints use the existing `/api` prefix and FastAPI convention.
Error responses use `{"detail": "..."}` (existing pattern).

---

## Health

### `GET /api/health`

Auth: None. Returns `{"status":"ok","provider":"...","auth":"..."}`. **Existing.**

### `GET /api/ready`

Auth: None. **New.** Checks DB connectivity and required config.

Response (200):
```json
{"status": "ready", "database": true, "storage": true}
```

Response (503 if any dependency unavailable):
```json
{"status": "not_ready", "database": false, "storage": true}
```

---

## Classrooms

### `POST /api/classrooms`

Auth: Teacher. Creates a classroom.

Request:
```json
{"name": "Data Structures", "description": "Fall 2025 section"}
```

Response (201):
```json
{"id": "uuid", "join_code": "LF-7K29Q"}
```

Errors: 401, 403 (not teacher).

### `GET /api/classrooms`

Auth: Teacher. Lists teacher's own classrooms.

Response:
```json
[{
  "id": "uuid", "name": "Data Structures", "description": "...",
  "join_code": "LF-7K29Q", "status": "active",
  "member_count": 42, "pack_count": 6,
  "created_at": "..."
}]
```

### `GET /api/classrooms/{id}`

Auth: Teacher (owner). Classroom detail.

Response:
```json
{
  "id": "uuid", "name": "...", "description": "...",
  "join_code": "LF-7K29Q", "status": "active",
  "member_count": 42, "pack_count": 6,
  "created_at": "...", "updated_at": "..."
}
```

Errors: 404.

### `PATCH /api/classrooms/{id}`

Auth: Teacher (owner). Updates name or description.

Request: `{"name": "...", "description": "..."}`

Response: `{"id": "uuid"}`

### `POST /api/classrooms/{id}/regenerate-code`

Auth: Teacher (owner). Generates a new join code.

Response: `{"join_code": "LF-M4X8P"}`

---

## Membership

### `POST /api/classrooms/{id}/join`

Auth: Student. Joins a classroom using the join code.

Request: `{"code": "LF-7K29Q"}`

Response (200): `{"classroom_id": "uuid", "joined": true}`

Errors:
- 400 `INVALID_CODE` — code does not match.
- 409 `ALREADY_MEMBER` — student already in this classroom.
- 429 — rate limited.

### `GET /api/classrooms/{id}/members`

Auth: Teacher (owner). Lists members.

Response:
```json
[{
  "id": "member-uuid", "user_id": "uuid",
  "name": "Alice", "email": "alice@...", "avatar_url": "...",
  "status": "active", "joined_at": "..."
}]
```

### `DELETE /api/classrooms/{id}/members/{user_id}`

Auth: Teacher (owner). Removes a student.

Response: `{"removed": true}`

---

## Classroom Packs

### `POST /api/classrooms/{id}/packs`

Auth: Teacher (owner). Creates a learning pack in the classroom.

Request: same as existing `PackInput`:
```json
{
  "title": "Binary Search Trees",
  "subject": "Computer Science", "level": "Year 2", "exam": "...",
  "summary": "...",
  "objectives": ["Understand BST insertion", "Perform BST search"],
  "constraints": {"language": "English", "max_words": 300}
}
```

Response (201): `{"id": "pack-uuid"}`

Implementation: calls existing `create()` logic with `classroom_id` set.

### `GET /api/classrooms/{id}/packs`

Auth: Teacher (owner). Lists packs in classroom.

Response:
```json
[{
  "id": "uuid", "title": "...", "subject": "...", "level": "...",
  "revision": 5, "status": "PUBLISHED",
  "published_at": "...", "created_at": "..."
}]
```

`status` is derived (DRAFT / GENERATING / READY_FOR_REVIEW / APPROVED / PUBLISHED).

---

## Pack Publication

### `POST /api/packs/{id}/publish`

Auth: Teacher (owner). Publishes an approved pack.

Preconditions:
- Pack has `classroom_id`.
- All assets approved.
- No FAIL checks.

Response: `{"published_at": "..."}`

Errors: 409 `NOT_APPROVED`, 409 `NO_CLASSROOM`.

### `POST /api/packs/{id}/unpublish`

Auth: Teacher (owner). Removes pack from student view.

Response: `{"unpublished": true}`

Errors: 409 `NOT_PUBLISHED`.

---

## Existing Pack APIs (preserved)

All existing endpoints continue to work unchanged:

```
GET    /api/packs              → list all teacher's packs
POST   /api/packs              → create standalone pack (no classroom)
GET    /api/packs/{id}         → full detail
POST   /api/packs/{id}/sources → upload source
POST   /api/packs/{id}/sources/text → text source
POST   /api/packs/{id}/gap-check
POST   /api/packs/{id}/generate
PATCH  /api/assets/{id}
POST   /api/assets/{id}/regenerate
POST   /api/assets/{id}/approve
POST   /api/assets/{id}/draft
POST   /api/packs/{id}/approve
GET    /api/packs/{id}/validation
GET    /api/packs/{id}/versions
GET    /api/packs/{id}/answer-key
GET    /api/assets/{id}/evidence
POST   /api/jobs/{id}/cancel
POST   /api/video-jobs
GET    /api/video-jobs/{id}
GET    /api/packs/{id}/resources
POST   /api/packs/{id}/resources/search
POST   /api/resources/{id}/approve
PATCH  /api/objectives/{id}
POST   /api/demo
```

---

## Student APIs

### `GET /api/student/classrooms`

Auth: Student. Lists classrooms the student has joined.

Response:
```json
[{
  "id": "uuid", "name": "Data Structures",
  "teacher_name": "Rohan",
  "pack_count": 3,
  "joined_at": "..."
}]
```

### `GET /api/student/classrooms/{id}`

Auth: Student (member). Classroom detail with published packs.

Response:
```json
{
  "id": "uuid", "name": "Data Structures",
  "teacher_name": "Rohan",
  "packs": [{
    "id": "uuid", "title": "Arrays & Strings",
    "subject": "...", "level": "...",
    "published_at": "..."
  }]
}
```

### `GET /api/student/packs/{id}`

Auth: Student (member of pack's classroom + pack published).

Response: same structure as existing `student/{token}` endpoint:
```json
{
  "title": "...", "subject": "...", "level": "...",
  "assets": [{"id": "...", "slot": "...", "title": "...", "body": "...", "options": [...], "flowchart": ...}],
  "resources": [{"title": "...", "url": "..."}],
  "has_export": true
}
```

### `POST /api/student/packs/{id}/answers/{vid}`

Auth: Student (member). Same as existing `student/{token}/answers/{vid}`.

Request: `{"choice": 2}`

Response: `{"correct": true}` or `{"correct": false, "solution": "..."}`

### `POST /api/student/packs/{id}/download`

Auth: Student (member + published + export exists).

Response:
```json
{"download_url": "https://s3.../...", "expires_in": 300}
```

Errors: 404 if export not ready. 403 if not member or not published.

---

## Legacy Student API (backward compatibility)

```
GET  /api/student/{token}                → unchanged
POST /api/student/{token}/answers/{vid}  → unchanged
```

These remain for existing share-token links. No auth required.

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid JWT |
| `FORBIDDEN` | 403 | Valid JWT but insufficient role or ownership |
| `NOT_FOUND` | 404 | Resource does not exist or not accessible |
| `INVALID_CODE` | 400 | Join code does not match |
| `ALREADY_MEMBER` | 409 | Student already in classroom |
| `NOT_APPROVED` | 409 | Pack not approved; cannot publish |
| `NOT_PUBLISHED` | 409 | Pack not published; cannot unpublish |
| `NO_CLASSROOM` | 409 | Pack has no classroom; cannot publish |
| `EXPORT_NOT_READY` | 404 | PDF export not generated yet |
| `ACTIVE_JOB` | 409 | A job is already running for this pack |
| `RATE_LIMITED` | 429 | Too many requests |

Existing error pattern (`HTTPException(status, detail_string)`) is preserved.
Structured error objects (`{"error": {"code": "...", "message": "..."}}`) are
a future improvement; for MVP the detail string carries the message.

---

## Authorization Summary

| Endpoint | Auth | Role | Ownership check |
|---|---|---|---|
| `POST /api/classrooms` | JWT | teacher | — |
| `GET /api/classrooms` | JWT | teacher | owner only |
| `POST /api/classrooms/{id}/join` | JWT | student | code match |
| `GET /api/classrooms/{id}/members` | JWT | teacher | owner |
| `POST /api/classrooms/{id}/packs` | JWT | teacher | classroom owner |
| `POST /api/packs/{id}/publish` | JWT | teacher | pack owner + approved |
| `GET /api/student/classrooms` | JWT | student | member |
| `GET /api/student/packs/{id}` | JWT | student | member + published |
| `POST /api/student/packs/{id}/download` | JWT | student | member + published + export |
| All existing pack/asset APIs | JWT | teacher | pack owner |
