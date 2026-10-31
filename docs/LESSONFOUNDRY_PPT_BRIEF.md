# LessonFoundry — Product & Presentation Brief

> Use this document as your source material for the PPT. Each section maps to one or more slides. Suggested slide titles are in **bold brackets**.

---

## SECTION 1: TITLE & ELEVATOR PITCH

**[Slide 1 — Title]**

**LessonFoundry**
*Trusted learning, with teacher control.*

A teacher-controlled learning platform that turns trusted curriculum materials into reviewed, aligned learning packs — and then uses student assessment results to guide personalized next steps.

**One-line pitch:** Every generated asset is traceable to its source and learning objective, nothing reaches a student without teacher approval, and when assessment reveals a gap, the platform shows exactly what to work on next.

**Built by:** Team name / SRMIST Tiruchirappalli
**Event:** YUVA Megathon 2026 — EduGenAI Track + Adaptive Syllabus Coach & Debug Tutor

---

## SECTION 2: THE PROBLEM

**[Slide 2 — The Problem]**

### For teachers
- A single lesson needs an explanation, worked examples, differentiated practice, quiz questions, an answer key, a revision sheet, and often a video script. Creating these separately is slow and error-prone.
- Generic AI generators produce materials that disagree with each other, drift from the syllabus, leak answers, or state unsupported facts. Teachers cannot trust or audit them.
- There is no approval gate: generated content goes straight to students, with no version control and no evidence trail.

### For students
- A student finishes a quiz and gets a score — but no guidance on *which concept* to revisit or *what to do next*.
- Revision materials are disconnected from assessments. Practice is one-size-fits-all.
- Coding exercises have no feedback beyond "wrong answer."

### The gap
No existing tool connects **trusted source material → aligned generation → teacher approval → student assessment → personalized remediation → coding practice with feedback** in a single workflow.

---

## SECTION 3: OUR SOLUTION

**[Slide 3 — What LessonFoundry Does]**

LessonFoundry is a **full-stack learning platform** with two connected halves:

| Half | What it does |
|------|-------------|
| **Teacher Studio** | Turn trusted source materials into a complete, connected learning pack. Review evidence, validate quality, approve exact versions. Nothing reaches students without explicit teacher authorization. |
| **Adaptive Student Experience** | After assessment, identify weak topics, match them to approved curriculum, build a focused 3-day plan, and provide coding exercises with isolated execution and actionable feedback. |

### The complete workflow

```
Teacher uploads source material (PDF, PPTX, DOCX, text)
    ↓
System extracts evidence and maps to learning objectives
    ↓
Generates 11 connected assets (explanation, quizzes, practice, revision, video script)
    ↓
Teacher reviews evidence links, validates quality, approves exact versions
    ↓
Approved content is published to the classroom
    ↓
Student completes assessment → system identifies weak topics
    ↓
Retrieves relevant approved lessons for those weak topics
    ↓
Generates a personalized 3-day remedial plan
    ↓
Student practices coding challenges with sandbox execution and feedback
    ↓
Progress tracking informs the next learning cycle
```

---

## SECTION 4: KEY FEATURES — TEACHER SIDE

**[Slide 4 — Teacher Studio]**

### 4.1 Source-bound content generation
- Teachers upload trusted materials (PDF, PPTX, DOCX, TXT, Markdown)
- System extracts text with page/slide/paragraph provenance
- Every generated claim links back to a specific source passage
- SHA-256 content hashing detects source changes and marks dependent assets stale

### 4.2 Connected learning pack (11 assets from one source)
| Asset | Purpose |
|-------|---------|
| Explanation | Core concept delivery |
| Worked Example | Step-by-step demonstration |
| Easy Practice | Foundational exercises |
| Medium Practice | Applied problems |
| Advanced Practice | Higher-order thinking |
| Quiz Q1–Q5 | Five formative questions with server-side answer keys |
| Exam Focus | Structured revision with concept flowcharts |
| Video Script | Scene-by-scene AI Teacher script |

### 4.3 Evidence and provenance
- Every asset shows which source passage supports it
- Evidence drawer displays the exact quote, source version, and extraction timestamp
- Objective alignment map shows which learning goal each asset serves
- No orphan content: every quiz question maps to an objective and source evidence

### 4.4 Quality validation (7+ automated checks)
- Unsupported claim detection
- Answer key validity (correct answer matches options)
- Answer leakage prevention (body doesn't reveal the answer)
- Near-duplicate question detection
- Coverage imbalance (all objectives get assets)
- Source staleness (source changed after generation)
- Instruction injection defense (prompt injection treated as content)

### 4.5 Teacher approval gate
- Three states: **Draft → Approved → Published**
- Approval locks exact versions immutably
- Approved assets cannot be edited or regenerated — create a new draft instead
- Controlled regeneration: regenerate one quiz question while keeping approved neighbors untouched
- Full version history with audit trail

### 4.6 Classroom management
- Teachers create classrooms with unique join codes
- Assign learning packs to classrooms
- Publish approved packs to enrolled students
- View classroom-wide analytics on student performance

---

## SECTION 5: KEY FEATURES — STUDENT SIDE

**[Slide 5 — Student Adaptive Learning]**

### 5.1 Clean student surface
- Students see **only approved, published content**
- No draft payloads, answer keys, teacher notes, or evidence metadata exposed
- Quiz answers checked server-side; keys never sent to the browser
- Tabs: Learn, Practice, Watch, Revise, Resources

### 5.2 Adaptive "What to work on next" (4 requirements fulfilled)

**Requirement 1 — Read weak topics from test scores**
- Every quiz answer is persisted with student identity, objective, and correctness
- `PerformanceAnalyzer` calculates per-topic accuracy across classrooms
- Topics below 70% accuracy (minimum 2 attempts) are flagged as weak
- Student sees: "Describe mass and inertia — 0% accuracy · 4 quiz attempts"

**Requirement 2 — Retrieve matching curriculum segments**
- `CurriculumRetrieval` maps weak topics to approved content
- Three matching strategies: same objective → matching topic tags → same unit
- Only returns content from classrooms the student is enrolled in
- Only returns APPROVED asset versions from PUBLISHED packs
- Student sees relevant explanations, assessments, and exam focus materials linked to their weak topic

**Requirement 3 — Build a 3-day remedial schedule**
- `AdaptivePlanner` generates a structured plan based on identified weaknesses
- Day 1: Understanding Core Concepts (review explanations, self-check)
- Day 2: Practice and Application (exercises, coding challenge)
- Day 3: Assessment and Mastery (quiz retry, integration, reflection)
- Activities have estimated durations (10–30 minutes each)
- Progress persists: students check off completed activities

**Requirement 4 — Code sandbox execution & feedback**
- Teacher creates classroom-linked coding problems
- Student writes Python code in a browser editor
- Code executes in a **Bubblewrap-isolated Linux namespace**:
  - Unshared user, PID, and network namespaces
  - Read-only minimal filesystem (no access to host /etc, /mnt, /home)
  - No network connectivity (socket connections fail)
  - CPU time limit (5 seconds), memory limit (128 MB)
  - File size, process count, and file descriptor limits
  - Application environment variables are not inherited
  - Fails closed if Bubblewrap is unavailable
- Three feedback cases demonstrated:
  - ✅ All tests passed — success feedback
  - ❌ Wrong output — "expected '' but got 'wrong output'" with test name
  - ❌ Runtime error — "ValueError: bad input" with actionable guidance

---

## SECTION 6: ARCHITECTURE

**[Slide 6 — Technical Architecture]**

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript (strict), Tailwind CSS 4, Radix UI, TanStack Query |
| Backend API | FastAPI (Python), Pydantic contracts, SQLAlchemy ORM |
| Database | PostgreSQL with Row-Level Security (SQLite for local dev) |
| Auth | Supabase JWT with asymmetric verification (local token fallback) |
| Storage | AWS S3 / Supabase private Storage / local filesystem |
| Content | Claude API (mock provider for development/testing) |
| Code execution | Bubblewrap (Linux user namespace isolation) |
| CI/CD | GitHub Actions — tests, typecheck, build, secret scan, E2E |

### Data model: 29 relational tables
Key entities: Users, Classrooms, Units (learning packs), Sources, Evidence, Objectives, Assets, AssetVersions, Approvals, QuizAttempts, LearningPlans, PlanItems, CodingProblems, CodeSubmissions

### Security boundaries
- Teacher API: ownership-scoped reads/writes through RLS
- Student API: narrow allowlist — only approved/published content
- Code sandbox: OS-level namespace isolation, not heuristic string matching
- Hosted code execution disabled by default in staging/production (fails closed)
- 16 additive PostgreSQL migrations with RLS policies and restricted database roles

---

## SECTION 7: WHAT MAKES US DIFFERENT

**[Slide 7 — Differentiation]**

| Other tools | LessonFoundry |
|-------------|--------------|
| Generate and ship | Generate, validate, review, *then* approve |
| AI output = final output | Teacher reviews evidence and approves exact versions |
| "Smart" recommendations with no source | Every recommendation links to approved curriculum from the student's classroom |
| Generic practice for everyone | Personalized 3-day plan targeting the student's specific weak topics |
| "Try again" on wrong code | Actionable feedback: which test failed, what was expected vs. actual |
| Trust the model | Trust the source. The model proposes; the teacher disposes. |

### Five trust principles
1. **Source-bound**: every generated claim traces to a specific passage in the teacher's material
2. **Teacher-approved**: nothing reaches students without explicit review and approval
3. **Version-controlled**: approved versions are immutable; changes create new drafts
4. **Student-scoped**: the student API is a narrow allowlist, not a filtered teacher view
5. **Fail-closed**: missing sandbox, missing config, provider errors — the system stops rather than serving bad content

---

## SECTION 8: DEMO EVIDENCE

**[Slide 8 — It works. Here's the proof.]**

### Test results summary

| Test suite | Result |
|-----------|--------|
| Backend unit + integration tests | **129 passed** |
| Adaptive backend tests | **60 passed** |
| Frontend TypeScript typecheck | **Passed** |
| Next.js production build | **Passed** |
| Playwright E2E (teacher → student journey) | **Passed (12.4s)** |
| Secret scan | **PASS (0 findings)** |
| Sandbox isolation tests (filesystem, network, env, resources, fail-closed) | **All passed** |

### E2E journey tested with Playwright
The automated Playwright test uses **separate teacher and student browser identities** and exercises the complete workflow:

1. Teacher creates a classroom and a learning pack with source material
2. System extracts evidence and generates 11 connected assets
3. Teacher reviews and approves the pack **in the web UI** (not API-only)
4. Teacher publishes to the classroom
5. Student joins with teacher-issued code
6. Student takes a quiz in the browser → answer is persisted
7. Additional quiz attempts produce a measurable low score
8. Student classroom page shows weak topics with accuracy percentages
9. Matched approved lessons appear from the correct classroom
10. Student generates a 3-day plan → all three days populated
11. Student marks an activity complete → progress persists
12. Teacher creates a classroom-linked coding problem
13. Student submits correct code → "All tests passed"
14. Student submits wrong output → "0/1 tests passed" with hint
15. Student submits crashing code → runtime error feedback (not marked as passed)

**Zero uncaught page errors. Zero browser console errors.**

### Screenshots captured from the E2E run
*(Include these in your PPT as evidence slides)*

- **Weak topics + approved lessons**: Student sees "Describe mass and inertia — 0% accuracy" with matched Assessment Easy, Assessment Advanced, Exam Focus, Assessment Medium from "Forces and motion — adaptive E2E"
- **Three-day plan**: Day 1 Understanding Core Concepts, Day 2 Practice and Application, Day 3 Assessment and Mastery — 11 activities with progress tracking
- **Coding success**: valid code → "All tests passed! Great job!"
- **Wrong output**: `print('wrong output')` → "0/1 tests passed. Hint: For test 'Test 1', expected '' but got 'wrong output'."
- **Runtime error**: `raise ValueError('bad input')` → runtime error feedback

---

## SECTION 9: SECURITY

**[Slide 9 — Security Architecture]**

| Layer | Protection |
|-------|-----------|
| Authentication | Supabase JWT with asymmetric verification (ES256/RS256), JWKS validation, expiry/issuer/audience checks |
| Authorization | PostgreSQL Row-Level Security on all 29 tables; restricted API and worker database roles (NOINHERIT, NOBYPASSRLS) |
| Student data isolation | Students can only access their own attempts, plans, submissions; teachers see aggregate analytics |
| Code sandbox | Bubblewrap Linux namespaces: no network, no host filesystem, no inherited environment, resource limits enforced by the kernel |
| Content boundary | Student API returns an allowlist (title, body, options); never exposes answer keys, solutions, evidence, teacher notes, or draft content |
| Secret management | `.env` files git-ignored; secret scan in CI; service-role keys never in browser bundles |
| Approval immutability | Approved asset versions cannot be edited or overwritten; enforced at both API and database trigger level |
| Rate limiting | Per-user token-bucket limiter on expensive operations (generation, upload, search) |

---

## SECTION 10: DEPLOYMENT READINESS

**[Slide 10 — Deployment Status]**

### What's ready
- ✅ Full backend with 129 passing tests
- ✅ Full frontend with TypeScript strict and production build
- ✅ CI pipeline on GitHub Actions
- ✅ Docker Compose for local development
- ✅ 16 PostgreSQL migrations with RLS
- ✅ EC2 deployment guide with security gates
- ✅ Supabase staging runbook
- ✅ Code pushed to `rohanesor/LessonFoundry01`

### What requires target-environment setup
- ⬜ EC2 instance provisioning and domain/TLS
- ⬜ Production Supabase project with managed Auth
- ⬜ Private S3 bucket for source storage
- ⬜ Bubblewrap configuration in production Docker image
- ⬜ Live Claude API provider configuration
- ⬜ Two-user live staging acceptance test

---

## SECTION 11: FUTURE ROADMAP

**[Slide 11 — What's Next]**

| Phase | Feature |
|-------|---------|
| Near-term | LLM-powered problem generation (replace template challenges with topic-specific exercises) |
| Near-term | Topic tags auto-populated during content generation for richer curriculum matching |
| Medium-term | Real AI Teacher video rendering (HeyGen / D-ID integration) |
| Medium-term | Embedding-based curriculum retrieval for semantic matching beyond keyword tags |
| Medium-term | Multi-language support with cross-language consistency checking |
| Longer-term | CogniBERT difficulty classification and Bloom's taxonomy tagging |
| Longer-term | Classroom-wide analytics dashboard for teachers |
| Longer-term | Mobile app (Expo/React Native scaffold exists) |

---

## SECTION 12: TEAM & CREDITS

**[Slide 12 — Team]**

*(Fill in your team details)*

| Role | Name |
|------|------|
| Lead | |
| Backend | |
| Frontend | |
| Design | |

**Repository:** https://github.com/rohanesor/LessonFoundry01
**Tech stack:** Python · FastAPI · Next.js · TypeScript · PostgreSQL · Supabase · Bubblewrap
**Event:** YUVA Megathon 2026 — EduGenAI + Adaptive Syllabus Coach & Debug Tutor

---

## APPENDIX: SLIDE-BY-SLIDE CHECKLIST

| Slide # | Title | Content source | Visual |
|---------|-------|---------------|--------|
| 1 | Title | Product name, tagline, team, event | LessonFoundry logo (mark-color.svg) |
| 2 | The Problem | Section 2 bullet points | Split: teacher pain / student pain |
| 3 | Our Solution | Section 3 workflow diagram | Flowchart from workflow above |
| 4 | Teacher Studio | Section 4 features | Screenshot: evidence-drawer.png |
| 5 | Adaptive Learning | Section 5 four requirements | Screenshot: adaptive-01-weak-topics.png |
| 6 | Three-Day Plan | Requirement 3 detail | Screenshot: adaptive-02-three-day-plan.png |
| 7 | Coding Challenge | Requirement 4 detail | Screenshot: adaptive-04-wrong-output.png |
| 8 | Architecture | Section 6 stack table + diagram | Architecture diagram |
| 9 | What's Different | Section 7 comparison table | Side-by-side table |
| 10 | It Works | Section 8 test results + E2E journey | Test summary table + screenshot strip |
| 11 | Security | Section 9 protection layers | Layered security diagram |
| 12 | Demo | Live demo or video | Run the local stack |
| 13 | Roadmap | Section 11 phases | Timeline visual |
| 14 | Team & Links | Section 12 | GitHub QR code + team photo |

---

## APPENDIX: KEY METRICS FOR JUDGES

| Metric | Value |
|--------|-------|
| Backend test coverage | 129 tests passing |
| Adaptive-specific tests | 60 tests |
| Database tables | 29 relational tables |
| PostgreSQL migrations | 16 versioned migrations |
| Asset types per pack | 11 connected assets |
| Automated quality checks | 7+ validation rules |
| E2E journey steps | 15 verified steps (teacher → student) |
| Sandbox isolation layers | 6 OS-enforced limits (namespace, CPU, memory, filesystem, network, process) |
| Lines of code | ~55,000 (391 files) |
| Time to run E2E | 12.4 seconds |

---

## APPENDIX: JUDGING RUBRIC ALIGNMENT

| Criterion | Pts | How we address it |
|-----------|-----|-------------------|
| Educational usefulness | 15 | Connected 11-asset learning pack + personalized 3-day remedial plan + coding practice with feedback |
| Generation quality & controllability | 15 | Source constraints, single-item regeneration, difficulty differentiation, evidence-bound generation |
| Alignment & cross-artifact consistency | 15 | Objective alignment map, answer key validity checks, evidence links, coverage imbalance detection |
| Grounding & provenance | 10 | SHA-256 source hashes, per-asset evidence quotes with page/slide location, model settings recorded |
| Quality guardrails | 10 | 7+ automated checks including leakage, duplication, staleness, injection defense |
| Teacher workflow | 10 | Approval gate enforced in student view, immutable locked versions, controlled regeneration |
| Technical architecture | 8 | Separated source/config/output/decisions, RLS, namespace isolation, durable job queue |
| UX & accessibility | 5 | Modernist design system, responsive layout, keyboard navigation, print/PDF |
| Evaluation & demo evidence | 4 | 129 tests, Playwright E2E, captured screenshots, validation reports |
| Innovation beyond baseline | 8 | Adaptive remediation loop, Bubblewrap sandbox, curriculum matching, structured flowcharts |
