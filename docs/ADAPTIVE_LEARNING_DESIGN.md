# Adaptive Syllabus Coach & Debug Tutor — Integration Design

## Executive Summary

This document defines how to integrate the four requirements from the Adaptive Syllabus Coach & Debug Tutor problem statement into the existing LessonFoundry platform.

---

## Current State Audit

### What LessonFoundry Already Has

| Component | Status | Location |
|-----------|--------|----------|
| User model with student/teacher roles | ✅ Exists | `entities.py: User.role` |
| Classroom membership | ✅ Exists | `entities.py: ClassroomMember` |
| Units (learning packs) with assets | ✅ Exists | `entities.py: Unit, Asset, AssetVersion` |
| Quiz slots (quiz1–5, assessment_*) | ✅ Exists | `llm.py: SLOTS` |
| Student quiz answer checking | ✅ Exists | `classroom_routes.py: student_answer()` |
| Asset versioning and approval | ✅ Exists | `entities.py: AssetVersion, Approval` |
| Evidence tracking | ✅ Exists | `entities.py: Evidence, AssetEvidence` |
| Objectives per unit | ✅ Exists | `entities.py: Objective` |
| LLM content generation | ✅ Exists | `providers/llm.py` |
| Background job queue | ✅ Exists | `jobs/worker.py` |

### What's Missing

| Component | Gap | Priority |
|-----------|-----|----------|
| Quiz attempt storage | Student answers are checked but not persisted | Critical |
| Student performance aggregation | No scoring or weakness identification | Critical |
| Curriculum-to-weakness mapping | No retrieval of content by topic weakness | Critical |
| Learning plan generation | No personalized schedule creation | Critical |
| Code sandbox execution | No isolated code execution environment | Critical |
| Progress tracking | No improvement measurement over time | High |
| Teacher weakness insights | No classroom-wide analytics | Medium |

---

## Four Requirements Mapping

### Requirement 1: Read Weak Topics from Test Scores

**Current state:** Quiz answers are validated via `student_answer()` but not stored.

**Implementation:**
1. Create `quiz_attempts` table to persist every student answer
2. Create `student_performance` materialized view or service
3. Build `PerformanceAnalyzer` service to identify weak topics

**New tables:**
```sql
CREATE TABLE quiz_attempts (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES users(id),
    asset_version_id VARCHAR(36) NOT NULL REFERENCES asset_versions(id),
    unit_id VARCHAR(36) NOT NULL REFERENCES units(id),
    slot VARCHAR NOT NULL,
    choice INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    attempted_at VARCHAR NOT NULL
);

CREATE INDEX ix_quiz_attempts_student ON quiz_attempts(student_id, attempted_at);
CREATE INDEX ix_quiz_attempts_unit ON quiz_attempts(unit_id);
```

**New API endpoints:**
- `GET /api/student/performance` — Returns the student's weak topics
- `GET /api/teacher/classrooms/{cid}/analytics` — Returns classroom weakness summary

### Requirement 2: Retrieve Matching Curriculum Segments

**Current state:** Objectives exist but no topic-to-content retrieval.

**Implementation:**
1. Add `topic_tags` column to objectives for semantic categorization
2. Create `CurriculumRetrieval` service to match weaknesses → approved content
3. Return relevant explanations, examples, and exercises

**Modified tables:**
```sql
ALTER TABLE objectives ADD COLUMN topic_tags JSON DEFAULT '[]';
```

**Retrieval logic:**
1. Identify weak topics from quiz attempts
2. Find objectives with matching topic tags
3. Return approved asset versions linked to those objectives
4. Filter to content within student's enrolled classrooms

### Requirement 3: Build a 3-Day Remedial Schedule

**Current state:** No learning plan generation exists.

**Implementation:**
1. Create `learning_plans` table
2. Create `plan_items` table for daily activities
3. Build `AdaptivePlanner` service using LLM for schedule generation

**New tables:**
```sql
CREATE TABLE learning_plans (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL REFERENCES users(id),
    classroom_id VARCHAR(36) NOT NULL REFERENCES classrooms(id),
    weak_topics JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at VARCHAR NOT NULL,
    completed_at VARCHAR
);

CREATE TABLE plan_items (
    id VARCHAR(36) PRIMARY KEY,
    plan_id VARCHAR(36) NOT NULL REFERENCES learning_plans(id),
    day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 3),
    position INTEGER NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    asset_version_id VARCHAR(36) REFERENCES asset_versions(id),
    coding_problem_id VARCHAR(36),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at VARCHAR
);
```

**New API endpoints:**
- `POST /api/student/learning-plans` — Generate a new plan
- `GET /api/student/learning-plans/{plan_id}` — View plan details
- `PATCH /api/student/learning-plans/{plan_id}/items/{item_id}` — Mark activity complete

### Requirement 4: Auto-Generate Problem, Run Code in Sandbox, Give Feedback

**Current state:** No code execution capability.

**Implementation:**
1. Create `coding_problems` table for generated exercises
2. Create `code_submissions` table for student submissions
3. Implement isolated code execution sandbox
4. Build `CodeEvaluator` service for feedback generation

**New tables:**
```sql
CREATE TABLE coding_problems (
    id VARCHAR(36) PRIMARY KEY,
    unit_id VARCHAR(36) REFERENCES units(id),
    topic VARCHAR(100) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    starter_code TEXT NOT NULL DEFAULT '',
    test_cases JSON NOT NULL,
    solution TEXT NOT NULL,
    created_at VARCHAR NOT NULL
);

CREATE TABLE code_submissions (
    id VARCHAR(36) PRIMARY KEY,
    problem_id VARCHAR(36) NOT NULL REFERENCES coding_problems(id),
    student_id VARCHAR(36) NOT NULL REFERENCES users(id),
    code TEXT NOT NULL,
    language VARCHAR(20) NOT NULL DEFAULT 'python',
    status VARCHAR(20) NOT NULL,
    output TEXT,
    test_results JSON,
    feedback TEXT,
    execution_time_ms INTEGER,
    submitted_at VARCHAR NOT NULL
);
```

**Sandbox requirements:**
- Isolated execution environment (Docker container or subprocess with seccomp)
- Resource limits: 5-second timeout, 128MB memory, no network
- Support Python initially, extensible to other languages
- Return stdout, stderr, and test results

**New API endpoints:**
- `POST /api/student/problems/{problem_id}/submit` — Submit code for execution
- `GET /api/student/submissions/{submission_id}` — View submission results

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LESSONFOUNDRY                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   Student    │    │  Performance     │    │   Adaptive       │  │
│  │   Answers    │───▶│  Analyzer        │───▶│   Planner        │  │
│  │   Quiz       │    │  (Req 1)         │    │   (Req 3)        │  │
│  └──────────────┘    └──────────────────┘    └──────────────────┘  │
│         │                    │                       │              │
│         │                    │                       │              │
│         ▼                    ▼                       ▼              │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   quiz_      │    │  Curriculum      │    │   learning_      │  │
│  │   attempts   │    │  Retrieval       │    │   plans          │  │
│  │   (table)    │    │  (Req 2)         │    │   (table)        │  │
│  └──────────────┘    └──────────────────┘    └──────────────────┘  │
│                              │                                      │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Code Sandbox (Req 4)                      │   │
│  │   ┌─────────────┐    ┌────────────┐    ┌─────────────────┐  │   │
│  │   │  Problem    │    │  Isolated  │    │   Feedback      │  │   │
│  │   │  Generator  │───▶│  Executor  │───▶│   Generator     │  │   │
│  │   └─────────────┘    └────────────┘    └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Quiz Attempt Storage (Foundation)

**Files to modify:**
- `backend/app/models/entities.py` — Add `QuizAttempt` model
- `backend/app/api/classroom_routes.py` — Persist attempts in `student_answer()`
- `backend/migrations/015_quiz_attempts.sql` — Create table

**Validation criteria:**
- Attempts are stored on every quiz answer
- Historical attempts can be queried
- RLS prevents cross-student access

### Phase 2: Performance Analysis (Requirement 1)

**Files to create:**
- `backend/app/services/performance.py` — `PerformanceAnalyzer` service

**Files to modify:**
- `backend/app/api/classroom_routes.py` — Add `/student/performance` endpoint

**Validation criteria:**
- Correctly identifies topics with < 70% accuracy
- Returns list of weak topics with evidence

### Phase 3: Curriculum Retrieval (Requirement 2)

**Files to create:**
- `backend/app/services/curriculum.py` — `CurriculumRetrieval` service

**Files to modify:**
- `backend/app/models/entities.py` — Add `topic_tags` to `Objective`
- `backend/migrations/016_objective_topics.sql` — Add column

**Validation criteria:**
- Maps weak topics to relevant approved content
- Only returns content from student's enrolled classrooms
- Returns empty list gracefully when no content matches

### Phase 4: Learning Plan Generation (Requirement 3)

**Files to create:**
- `backend/app/models/adaptive.py` — `LearningPlan`, `PlanItem` models
- `backend/app/services/planner.py` — `AdaptivePlanner` service
- `backend/app/api/adaptive_routes.py` — Learning plan endpoints
- `backend/migrations/017_learning_plans.sql` — Create tables

**Validation criteria:**
- Generates exactly 3 days of activities
- Each day contains logical progression
- Links to actual approved content when available
- Students can mark items complete

### Phase 5: Code Sandbox (Requirement 4)

**Files to create:**
- `backend/app/models/coding.py` — `CodingProblem`, `CodeSubmission` models
- `backend/app/services/sandbox.py` — Isolated code executor
- `backend/app/services/code_evaluator.py` — Feedback generation
- `backend/app/api/coding_routes.py` — Code submission endpoints
- `backend/migrations/018_coding_problems.sql` — Create tables

**Validation criteria:**
- Code executes in isolated environment
- Timeout kills runaway processes
- Memory limits enforced
- No network access
- No filesystem escape
- Correct output for valid code
- Meaningful feedback for errors

---

## Security Considerations

### Sandbox Security (Critical)

```python
# Sandbox execution model
SANDBOX_CONFIG = {
    "timeout_seconds": 5,
    "memory_limit_mb": 128,
    "cpu_limit": 1,
    "network": False,
    "filesystem": "read-only /usr /lib",
    "syscalls": "restricted",  # seccomp profile
}
```

**Execution options (in order of security):**
1. Docker container with restricted capabilities
2. Subprocess with `seccomp` and resource limits
3. External sandbox service (e.g., Judge0)

### Data Access

- Students see only their own attempts and performance
- Teachers see aggregate classroom performance
- Learning plans are private to the student
- Code submissions are private to the student
- RLS policies enforce all boundaries

---

## Testing Strategy

### Unit Tests

| Test | Coverage |
|------|----------|
| `test_quiz_attempt_storage.py` | Attempt persistence |
| `test_performance_analyzer.py` | Weakness identification |
| `test_curriculum_retrieval.py` | Content matching |
| `test_adaptive_planner.py` | Schedule generation |
| `test_sandbox_security.py` | Isolation and limits |
| `test_code_evaluator.py` | Feedback quality |

### Integration Tests

| Test | Coverage |
|------|----------|
| `test_student_journey.py` | Full workflow from quiz → plan |
| `test_coding_workflow.py` | Problem → submission → feedback |
| `test_teacher_insights.py` | Classroom analytics |

### Security Tests

| Test | Coverage |
|------|----------|
| `test_sandbox_escape.py` | Filesystem, network, resource escape attempts |
| `test_rls_boundaries.py` | Cross-user data access |
| `test_code_injection.py` | Malicious code patterns |

---

## API Summary

### New Student Endpoints

```
GET  /api/student/performance
POST /api/student/learning-plans
GET  /api/student/learning-plans/{plan_id}
PATCH /api/student/learning-plans/{plan_id}/items/{item_id}
POST /api/student/problems/{problem_id}/submit
GET  /api/student/submissions/{submission_id}
```

### New Teacher Endpoints

```
GET  /api/teacher/classrooms/{cid}/analytics
GET  /api/teacher/classrooms/{cid}/weak-topics
```

---

## Definition of Done

| Requirement | Validation |
|-------------|------------|
| 1. Read weak topics | Returns accurate weak topics from actual quiz data |
| 2. Retrieve curriculum | Returns relevant content linked to weaknesses |
| 3. Build 3-day schedule | Produces structured 3-day plan with real activities |
| 4. Code sandbox | Executes code safely; provides useful feedback |

All four requirements must pass end-to-end validation before the integration is complete.

---

## Implementation Status (Updated)

### Implemented locally

- Quiz-attempt persistence and classroom-scoped performance analysis
- Curriculum retrieval limited to approved assets in the student's classroom
- Persisted three-day plans with completion tracking
- Student classroom UI for weak topics, matched lessons, plans, and linked challenges
- Student challenge list/detail/submission checks for published classroom units and active enrollment
- A development-only Python subprocess evaluator for feedback experiments

### Validation Results

See [Adaptive Learning Validation](ADAPTIVE_LEARNING_VALIDATION.md) for the exact run and caveats. The local test suite and one separate teacher/student Playwright journey pass using synthetic data and the mock content provider. These results validate application wiring, not content quality, learning outcomes, production authorization/RLS, or runtime security.

| Requirement | Current status |
|-------------|----------------|
| 1. Read weak topics from test scores | Local synthetic-data flow verified; real student data and threshold usefulness not evaluated. |
| 2. Retrieve matching curriculum segments | Positive same-classroom retrieval verified with mock approved assets; semantic relevance against real approved curriculum remains unvalidated. |
| 3. Build and track a three-day plan | Local UI/API journey verified, including a completion update; schedule quality and learning impact remain unvalidated. |
| 4. Coding challenge and feedback | Classroom-link and enrollment checks plus local feedback UI verified. The generated problem is still a generic placeholder, and code execution is disabled in staging/production until a hardened sandbox is configured. This requirement is not production-complete. |

### Release blockers

1. Validate lesson matches and assessments with representative teacher-approved classroom material.
2. Replace the generic coding placeholder with topic-specific challenges, meaningful tests, and teacher review.
3. Deploy and review a hardened execution boundary before accepting any untrusted code.
4. Exercise the complete approval/publish workflow in the release UI with distinct production-configured teacher and student accounts.
5. Re-run production/RLS and accessibility checks before making external claims or capturing adaptive-learning ad footage.
