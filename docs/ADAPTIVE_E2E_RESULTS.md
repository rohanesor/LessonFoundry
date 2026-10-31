# Adaptive teacher-to-student E2E validation

**Run date:** 2026-10-30  
**Result:** Functional local E2E passed; hosted/release acceptance remains blocked.

## Test run

Command:

```bash
cd frontend
npx playwright test tests/adaptive-teacher-student.spec.ts --reporter=line
```

Result: **1 Playwright journey passed (12.4 seconds)** against the Next.js production server (`next start`) and local LessonFoundry API + worker, with student submissions executed through the bubblewrap runner. TypeScript typecheck passed; the targeted adaptive backend suite passed **60 tests**. The Playwright journey captured no uncaught page errors or browser console errors.

The test uses separate local teacher and student identities (`local-teacher` / `local-student` auth configuration), an isolated temporary SQLite database, a local worker, and the explicitly configured mock content provider. It does **not** use managed Supabase or real student accounts. The teacher provides sanitized force-and-motion notes, and the pack is generated, reviewed, approved, and published through the existing LessonFoundry workflow. Student quiz attempts and plan/submission records use that same test student's identity.

## Acceptance cases exercised

| Ad/story step | E2E action | Outcome |
|---|---|---|
| Teacher creates trusted classroom material | Create classroom and pack, add sanitized source, run objective support and generation jobs | Pass; actual local API/database/worker used |
| Teacher review and approval | Teacher browser reviews and approves generated pack; confirms classroom publication | Pass |
| Student quiz → results | Student joins with teacher-issued code, opens published pack, submits a quiz answer in the browser; further incorrect attempts are submitted to produce a measurable low score | Pass; attempts persisted under student identity |
| Weak topics | Student classroom page reads assessment history and displays topics below the service threshold | Pass |
| Approved curriculum matching | Retrieval returns approved/published asset versions from the same pack/classroom; browser shows the mapped lesson | Pass; nonempty material verified against the pack title and version IDs |
| Three-day plan | Student creates and reloads a plan; days 1, 2, and 3 have activities; completion progress persists after marking an item | Pass |
| Coding success | Teacher creates a classroom-linked challenge; enrolled student submits valid code in the browser | Pass |
| Wrong output | Student submits output that does not satisfy the test; UI returns failed-test feedback | Pass |
| Runtime exception | Student submits code raising a runtime exception; it is not marked passed and the UI shows actionable error feedback | Pass after correcting evaluator logic |
| Browser permissions | Student is enrolled; teacher and student use separate local identities; linked challenge is visible in the enrolled classroom | Pass for this local test path; not an exhaustive authorization audit |

## Captured references

These are functional test captures from a production-mode Next.js build, not final advertisement footage. They use synthetic E2E data and mock generation. Screenshots include test classroom labels and should be reframed/re-recorded for a polished ad:

- `../ai video/ad-production/assets/ui-reference/adaptive-e2e/01-weak-topics-approved-content.png`
- `../ai video/ad-production/assets/ui-reference/adaptive-e2e/02-three-day-plan.png`
- `../ai video/ad-production/assets/ui-reference/adaptive-e2e/03-code-success.png`
- `../ai video/ad-production/assets/ui-reference/adaptive-e2e/04-wrong-output-feedback.png`
- `../ai video/ad-production/assets/ui-reference/adaptive-e2e/05-runtime-error-feedback.png`

Automated test: `frontend/tests/adaptive-teacher-student.spec.ts`.

## Important limitations — not release/security sign-off

1. **Sandbox is locally isolated but not release-certified.** The local runner now fails closed without Bubblewrap, starts Python in unshared user/PID/network namespaces with a minimal read-only filesystem, an empty environment, and CPU/address-space/file-size/process/file-descriptor/core limits. Tests cover filesystem/network/environment isolation, resource bounds, output limits, timeout, and fail-closed behavior. The hosted API still deliberately returns 503 for staging/production/Supabase code execution. Bubblewrap is not configured or verified in the production deployment image, and independent adversarial review/kernel-escape assessment is outstanding; do not enable hosted execution or make a security guarantee until those gates pass.
2. **Generation is mock/local.** These captures do not validate a live model provider, managed database, hosted authentication/storage, deployment ingress, or production data policies.
3. **Lesson generation semantics still need teacher judgment.** The test asserts that matching content is approved and belongs to the right classroom/unit. It does not independently prove pedagogical relevance or factual correctness of generated lesson text.
4. **Quiz weak-topic setup includes additional API attempts.** The browser answers a real published quiz question; additional incorrect attempts are recorded through the authenticated student API so the weakness threshold is deterministically met. The ad should not imply that one quiz attempt alone necessarily produces a weakness recommendation.
5. **Coding task authoring remains template-based.** The teacher-linked problem is a functional challenge fixture, not validated AI-generated pedagogical content; its current trivial test contract is adequate for exercising submit/pass/fail/runtime feedback, not for judging educational quality.

Therefore: the complete **local functional journey with OS-enforced Bubblewrap isolation** is demonstrated. This is not evidence that hosted production, kernel-level sandbox escape resistance, live-model content quality, or a release-configured customer environment has passed validation. Capture final ad footage only after the sandbox and target deployment are independently accepted.
