# Adaptive Learning — Internal Validation Status

> **Not a production sign-off or advertising evidence.** This validation used an isolated local database, synthetic classroom content, the `mock-extractive` provider, and local-auth test identities. Teacher approval in the acceptance test was performed through the API with a test note; it was not a substantive content-quality review. Do not use these results to claim validated learning outcomes, semantic curriculum alignment, or secure code execution.

## Current Status

| Requirement | Local implementation check | Important limitation |
|---|---|---|
| Weak-topic recommendations | Passed the local teacher/student Playwright journey and backend tests. Persisted quiz attempts were scoped to the test classroom; the student UI showed the weak objective and attempt accuracy. | Synthetic assessment data only. Thresholds and recommendation usefulness have not been evaluated with real student results. |
| Approved curriculum matches | The local journey returned **4 approved asset segments** for the weak topic from the same published test classroom. | The assets came from a mock provider and a short synthetic source. This verifies retrieval plumbing and classroom scoping, not semantic relevance or instructional quality. The earlier zero-match example is stale and should not be represented as a successful content-match result. |
| Three-day plan and tracking | UI showed three populated days; an activity could be marked complete and the persisted progress updated. | A functional workflow check only; no learning impact or schedule-quality study has been run. |
| Coding challenge and feedback | The student UI listed a challenge linked to a published classroom pack and displayed failed-output/runtime feedback. Backend tests confirmed unlinked or non-enrolled students cannot list, retrieve, or submit that challenge. | Challenge creation is currently a generic template with an empty-output test case—not a validated, topic-specific educational exercise. The current Python subprocess runner is **not a hardened sandbox**; do not run untrusted code or describe it as secure. |

## Verification Run

- Backend suite: **122 passed** (one Starlette/httpx deprecation warning).
- Adaptive backend subset after enrollment-gate changes: **52 passed**.
- Frontend TypeScript typecheck: passed.
- Production Next.js build: passed from an isolated frontend copy. The working tree's existing development server was not used for the build.
- Playwright acceptance journey: **1 passed** using separate local teacher/student identities and an isolated API, worker, and browser app. It created synthetic classroom content, joined the student by classroom code, recorded quiz attempts, checked matched lessons, created a plan, marked an activity complete, and exercised coding feedback.

These are development/test validations, not release-readiness evidence. The mock provider explicitly labels its generated assets as development-only.

## Access and Execution Boundaries

- Student challenge listing requires active classroom membership and a published classroom unit.
- Retrieving or submitting a challenge also requires active membership in the linked classroom. Unlinked drafts are not student-visible.
- The code runner currently starts a Python subprocess with a heuristic blocklist and timeout only; it does not provide OS/container-grade filesystem, network, memory, or process isolation. Submission endpoints return `503` in Supabase-auth, staging, and production modes until a hardened sandbox is configured. Do not run untrusted code in local development either.
- Local tests do not establish production Supabase/RLS behavior or production deployment configuration.

## Release / Ad Blockers

1. Replace the placeholder coding problem and empty-output test with a real, topic-aligned challenge, meaningful hidden tests, teacher review, and verified feedback.
2. Deploy a hardened execution boundary (for example, an isolated worker/container with no network, strict filesystem/process limits, and resource quotas); obtain a security review before enabling untrusted submissions.
3. Validate curriculum matching against real, teacher-approved classroom material and representative weak-topic assessments; record positive and negative examples and inspect every returned segment for relevance.
4. Run the teacher review/approval/publish flow in the release-configured UI with separate teacher and student accounts, not only API fixture setup.
5. Re-run the acceptance journey against release configuration and review clean screens before capturing any ad footage.

Until these blockers are cleared, treat the adaptive screens and generated assets as internal demo/test material only. Do not film them as production capability or claim that the code runner is secure.
