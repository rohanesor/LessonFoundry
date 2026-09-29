# Prototype v5 implementation status

Reference: root `LessonFoundry Prototype v5 (1).html`, with extracted review/readiness markup in `scratch/unpacked_prototype_v5.html`.

## Implemented increment
- Studio Validation and Versions navigation opens a shared responsive 480px Review drawer, using the existing Radix Panel focus/escape behavior.
- Validation filters: All, Blocking, Warnings, Passed; native disclosure cards preserve original check states. Mark reviewed is explicitly session-local and never changes validation or persistence.
- Evidence lists actual passages/source versions and current asset references; existing detailed provenance inspection retained.
- Approval checklist uses actual current assets/checks, resets acknowledgment on target/revision changes, and blocks stale assets, incomplete checks and FAIL results. No fixed prototype asset count is assumed. Existing backend approval remains authoritative.
- Approval wording no longer implies classroom publication.
- Overview publication now opens a confirmation modal with authorized classroom data; API failures stay visible. Existing publish endpoint and export workflow unchanged.

## Verification
- TypeScript and production build passed.
- Read-only authenticated Playwright `staging-tests/v5-review.spec.ts` passed; desktop/mobile screenshots inspected. All application mutations are rejected by this test.
- Backend regression: 65 passed. Secret and static bundle scans passed.
- No Claude requests, generation jobs, data mutations, or backend/schema changes performed by the browser verification.

## Live retained pack finding
The retained pack has 88 PASS, 55 warnings, 0 FAIL check results, but stale dependencies after source changes. Zero FAIL results alone must not imply ready for approval. No attempt was made to regenerate, approve, or publish it.

## Still pending (not a complete v5 acceptance)
- Unified topbar/contextual Studio navigation and lifecycle redesign.
- Teacher home attention center, recent packs, classroom refinements.
- Student learning/progress redesign using supported contracts only.
- Approval/publication success/failure automated interaction coverage without staging mutations.
- Full viewport matrix, screenshot baseline comparison against executable v5 prototype, and full journey regression.
- Existing workflow specs using the former `Approve & publish` label and full-page Versions navigation need updating to the new deliberate approval-only label and drawer dismissal. They were not executed because they create/regenerate packs.

Unavailable data (student progress, last-active, rollback) must not be fabricated or given inert controls. No backend contract changes are authorized by this increment.

## Second increment: application layout and read-only visual QA

Implemented:
- Shared AppHeader on all authenticated teacher/student pages, with domain breadcrumbs, role, sign out and error feedback.
- Removed permanent Studio sidebar; introduced v5-style pack header, lifecycle, horizontally scrollable sections, contextual trust controls and preserved legacy student preview.
- Split editorial login, teacher attention center based on five recent packs, recent-pack list, classroom overview metrics and join-code copy feedback.
- Student section navigation, session-only checked/correct counts, approved script display when returned by the student API, and classroom request errors instead of indefinite skeletons.
- Screenshot-driven fixes: stretched login editorial panel; minimum readable table width with contained horizontal scrolling on mobile.

Verification:
- Production build and TypeScript passed.
- `v5-pages.spec.ts` and `v5-review.spec.ts` passed against dedicated accounts with all application writes blocked. Five viewport sizes checked, no page overflow, console errors or HTTP error responses in the pages audit.
- Screenshots captured for login, teacher home/classroom/Studio/notes, student home/classroom/pack and section navigation. Three crops created; desktop and mobile screenshots inspected. Screenshots are in ignored `frontend/test-results/`.
- Backend: 65 tests passed. Secret scan and production static-bundle scan passed (including checks against private configured key values without printing them).
- Mock provider retained; no generation, regeneration, publication, export or new staging data initiated.

Important limits:
- The retained student pack currently returns no published assets. Its empty state and navigation were verified, NOT populated lessons, answer submission, video or PDF delivery.
- Exact pixel parity against rendered v5 baselines is still unverified. This is not full v5 acceptance.
- Create/join remain existing inline forms, not yet converted to v5 modals. Home/card micro-layout, drawer asset jump links, lifecycle sublabels, student continuation hero and complete interaction-fixture coverage remain pending.
- Approval/publication mutations remain untested in this pass. Unsupported persistent progress, last-active timestamps and rollback are deliberately not fabricated.
