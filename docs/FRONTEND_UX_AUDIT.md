# LessonFoundry Frontend UX Audit

## Route tree
- `/login`, `/auth/callback`
- `/teacher`, `/teacher/classrooms/[id]`, `/teacher/packs/[id]`
- `/student`, `/student/classrooms/[id]`, `/student/packs/[id]`, `/student/[token]`
- `/` legacy Studio

## Current component map
- **Studio:** `components/studio/studio.tsx` coordinates pack state, jobs, approval and screen selection; `layout/shell.tsx` provides the persistent pack sidebar; Sources, validation, versions, assets and approval are contextual children.
- **Teacher:** route-local dashboard and classroom pages provide classroom creation/listing and pack creation. They currently use a separate topbar/navigation treatment from Studio.
- **Student:** route-local dashboard/classroom/pack pages and `components/student/student-view.tsx` provide the student learning surface.
- **Shared primitives:** `components/ui/button.tsx`, `status.tsx`, `dialog.tsx`, brand icons and `app/design-system.css`/`globals.css`.

## Actual flows
### Teacher
Login → Teacher dashboard → classroom → create/open pack → Sources → gap check → generate → Studio assets → Validation → approve → explicit publish → export.

### Student
Login → My Classrooms → classroom → published pack → Learn / Practice / Revise / Watch / Resources → authorized PDF download.

## IA and UX findings
1. **Split teacher shell:** classroom routes have one topbar while pack Studio has a second, persistent workspace/sidebar model. This makes the transition from classroom to pack feel like a different product.
2. **Studio nav density:** normal authoring sections, system controls (Validation/Versions), and workspace-wide destinations coexist in the sidebar. Trust controls should be contextual rather than permanent primary navigation.
3. **Lifecycle visibility:** status appears in several places (jobs, badges, approval control, classroom cards). The teacher needs one canonical lifecycle: Draft → Generating → Review → Approved → Published.
4. **Sources are conceptually correct but visually mixed:** source ingestion, evidence inspection, and teacher notes share one long view. The add-source action should be the clear first step; evidence should be a review detail.
5. **Student is simpler, but its route-local headers should share a compact student shell and retain only learning actions.
6. **Mobile risk:** Studio assumes a fixed desktop sidebar and route-local pages duplicate header patterns. Navigation state should be independent of desktop placement before a mobile client is built.

## Accessibility, hydration, and performance
- Browser-only attachment preview APIs belong in event handlers/effects; no server-rendered file/object URL state.
- Semantic buttons, labels, dialogs and visible focus styles are already the project convention and must be retained.
- Data loading should retain route-level skeletons; navigation transitions should not depend on fixed viewport widths.

## Consolidation targets
- Reuse existing `Shell`, `Status`, `Button`, `Panel`, `LFMark`/`LFWordmark` rather than duplicating brand/navigation primitives.
- Evolve the existing Shell into a domain-aware app shell instead of introducing parallel navigation components.
- Standardize page headers, cards and lifecycle badges through existing CSS tokens/classes.

## Mobile-ready direction
Use domain-level route state (`classroomId`, `packId`, active learning/studio section) separately from the visual navigation container. Desktop may render a sidebar/tabs; future native clients can render bottom tabs or stacks while reusing the API contracts and lifecycle model.
