# LessonFoundry UI/UX Redesign Plan

## Goal
Redesign the existing LessonFoundry web application to create a polished, modern, professional learning management platform while preserving all backend APIs, auth, permissions, and business logic.

## Scope
1. **Shared design system** — colors, typography, spacing, radius, shadows.
2. **Shared layout** — AppHeader, breadcrumbs, page containers.
3. **Login / auth consistency** — redesign login page and clarify local vs hosted auth behavior.
4. **Teacher Home / Dashboard** — welcome, attention panel, classroom cards, recent packs.
5. **Classroom Overview** — header, join code, navigation tabs, metrics, packs, students.
6. **Learning Pack Workspace** — highest priority; restructure navigation and overview.
7. **Verification** — TypeScript typecheck, Next.js build, Playwright E2E tests.

## Pages & Components to Modify

| Page | File(s) |
|------|---------|
| Design tokens | `frontend/app/design-system.css`, `frontend/app/globals.css` |
| Layout / Header | `frontend/components/layout/app-header.tsx`, `frontend/components/layout/shell.tsx` |
| Login | `frontend/app/login/page.tsx`, `frontend/app/auth/callback/page.tsx`, `frontend/lib/auth.ts` |
| Teacher Home | `frontend/app/teacher/page.tsx` |
| Classroom Overview | `frontend/app/teacher/classrooms/[id]/page.tsx` |
| Learning Pack Workspace | `frontend/components/studio/studio.tsx`, `frontend/components/studio/overview.tsx`, `frontend/components/layout/shell.tsx` |
| Reusable UI | `frontend/components/ui/button.tsx`, `frontend/components/ui/status.tsx`, `frontend/components/ui/dialog.tsx` |

## Design Direction
- Clean white surfaces on `#F8FAFC` ground.
- Deep navy `#0F172A` headings, `#64748B` secondary text.
- Primary blue `#2563EB`, hover `#1D4ED8`.
- Subtle borders `#E2E8F0`, rounded corners (8–12px), restrained shadows.
- Inter font, clear hierarchy, 4px spacing scale.
- Max content width 1280px.

## Navigation Re-architecture (Pack Workspace)
Pack tabs will be grouped into primary sections:
- **Overview**
- **Lesson content** → Explanation, Exam Focus
- **Assessment** → Assessment, Quiz, Answer Key
- **AI Teacher**
- **Resources & sources** → Resources, Sources, Evidence

Secondary items moved to a "More" menu / utility area:
- Validation
- Versions
- Trust & history
- Student preview (kept in header)

## Auth Consistency Fix
- `hostedAuth` is derived from `NEXT_PUBLIC_SUPABASE_URL` at build time; this is correct.
- The current login page switches UI based on `hostedAuth`, which can look like "sometimes code, sometimes email" when env vars differ between builds.
- Plan: add a small, explicit mode indicator on the login page ("Local development" vs "Sign in with email") so the difference is intentional and clear, and ensure the local token field defaults are not confusing.

## Verification Steps
1. `cd frontend && npm run build`
2. `cd frontend && npx tsc --noEmit`
3. Run Playwright E2E: `npx playwright test`
4. Manual visual check at desktop/tablet/mobile widths.

## Notes
- Keep all existing API calls and routes.
- Do not hardcode dashboard numbers or workflow states.
- Maintain accessibility: focus states, landmarks, ARIA labels.
