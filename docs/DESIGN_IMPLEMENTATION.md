# Design implementation map

The supplied `LessonFoundry Frontend Design/` directory and ZIP are preserved unchanged.
The application uses `LessonFoundry v3.dc.html` as its latest shell/studio reference,
plus the individual component exports. The bundled prototypes depend on a proprietary
`x-dc`/`DCLogic` runtime; they were inspected, not embedded as an iframe or executed as
application state.

## Visual mapping

| Design reference | Application |
|---|---|
| `_ds/modernist-…/styles.css` | `frontend/app/design-system.css`, copied tokens and component primitives |
| `LessonFoundry v3.dc.html` | `components/layout/shell.tsx`, `components/studio/asset-editor.tsx` |
| `Dashboard.dc.html` | `components/dashboard/dashboard.tsx` |
| `CreatePack.dc.html` | `components/sources/create-pack.tsx` |
| `SourceLibrary.dc.html` | `components/sources/sources.tsx` |
| `EvidenceViewer.dc.html` | `components/evidence/evidence-drawer.tsx` |
| `ApprovalPanel.dc.html` | `components/studio/approval.tsx` |
| `ValidationPage.dc.html` | `components/studio/system-pages.tsx` |
| `VersionTimeline.dc.html` | `components/studio/system-pages.tsx` |
| `AITeacher.dc.html` | `components/studio/system-pages.tsx` |
| `StudentView.dc.html` | `components/student/student-view.tsx` |
| `StatusBadge.dc.html` | `components/ui/status.tsx` |

Preserved: Archivo type, warm light ground, square corners, red accent, 2px dividers,
flush-left buttons, left workspace/pack/system navigation, pack context header,
three-column studio, evidence drawer with highlighted source passage, approval locks,
and a separate student learning surface.

Differences are functional rather than decorative: fabricated design counts and
notifications are not shown; current counts come from the API. Unsupported semantic
checks display NEEDS REVIEW rather than decorative green checks. Demo output is
visibly labeled. Quiz has five questions, each an independent versioned asset.

The design's all-in-one prototype is split into reusable React components. Accessible
dialog behavior uses Radix primitives with shadcn-style Button composition. Tailwind
is available alongside the imported design-system CSS, not used to replace it.

## Remaining fidelity/workflow work

- Custom flowchart editor and rich exam-focus sections are not implemented.
- Source PDF rendering is a text-location evidence viewer, not a page-canvas viewer.
- The tablet trust panel is collapsible inline, not yet a dedicated drawer.
- No notification or global search feature is represented as working.
- Assessment editing uses text/solution assets rather than a full marks rubric editor.
