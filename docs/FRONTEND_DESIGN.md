# LessonFoundry — Frontend Design Document

## 1. Design origin

The visual design was exported from a proprietary `x-dc` / `DCLogic` prototyping tool
as a set of standalone `.dc.html` files with an embedded `support.js` runtime. The
application was built by inspecting these files as a visual reference — they are **not**
executed, embedded, or iframed at runtime.

The latest and most complete reference is **`LessonFoundry v3.dc.html`** (1028 lines),
a full interactive prototype containing the shell, sidebar navigation, pack header,
text-asset studio, quiz editor, evidence panel, validation sidebar, approval dialog,
version history, gap handling, loading skeletons and demo controls. Smaller component
exports cover individual screens.

### Reference file → Component mapping

| Design export | Lines | React component |
|---|---|---|
| `LessonFoundry v3.dc.html` | 1028 | `shell.tsx`, `asset-editor.tsx`, `studio.tsx` |
| `Dashboard.dc.html` | 134 | `dashboard.tsx` |
| `CreatePack.dc.html` | 185 | `create-pack.tsx` |
| `SourceLibrary.dc.html` | 84 | `sources.tsx` |
| `EvidenceViewer.dc.html` | 65 | `evidence-drawer.tsx` |
| `ApprovalPanel.dc.html` | 84 | `approval.tsx` |
| `ValidationPage.dc.html` | 97 | `system-pages.tsx` (Validation) |
| `VersionTimeline.dc.html` | 67 | `system-pages.tsx` (Versions) |
| `AITeacher.dc.html` | 141 | `system-pages.tsx` (VideoWorkflow) |
| `ExamFocus.dc.html` | 108 | `asset-editor.tsx` (Exam Focus slot) |
| `Resources.dc.html` | 70 | `system-pages.tsx` (Resources) |
| `GenerationPipeline.dc.html` | 131 | Job banner in `studio.tsx` |
| `StatusBadge.dc.html` | 40 | `status.tsx` |
| `StudentView.dc.html` | 129 | `student-view.tsx` |

The original exports are preserved unchanged in `LessonFoundry Frontend Design/`.

---

## 2. Design system — official handoff

The visual language is defined by the **official LessonFoundry Frontend Design**
handoff in `LessonFoundry Frontend Design/design_handoff_lessonfoundry/`,
which contains exact tokens, components, icons, logos and prototypes.

The application consumes:

- `tokens/tokens.css` → `frontend/app/design-system.css`
- `components/LFIcon.tsx` → `frontend/components/icons/LFIcon.tsx`
- `assets/logo/*.svg` → `frontend/public/logo/`
- `assets/icons/*.svg` → `frontend/public/icons/`
- `assets/favicon/favicon-light.svg` → `frontend/public/favicon.svg`

The brand palette is:

| Role | Token | Hex |
|---|---|---|
| Deep Ink | `--color-text` | #191f2b |
| Canvas | `--color-bg` | #f3f2f2 |
| Surface | `--color-surface` | #eae9e9 |
| Foundry Blue | `--color-accent` | #2763ae |
| Verification Green | `--lf-green` | #267543 |
| Warm Amber | `--lf-amber` | #d49838 |
| Error Red | `--lf-red` | #cc3430 |

See `docs/BRAND_SYSTEM.md` for the brand rationale and `LessonFoundry Frontend Design/design_handoff_lessonfoundry/README.md` for the full visual specification.

### Core principles

| Principle | Implementation |
|---|---|
| Flat, architectural | Zero corner radius everywhere (`--radius-md: 0px`) |
| Visible modular grid | Equal-width cells, strong horizontal/vertical rhythm |
| Strong dividers | 2px rules (`--color-divider`) between major sections |
| Flush left | Headings, body copy, and button labels start at the left edge |
| Mono accent | Single red `#ec3013`; no secondary accent role |
| Typography | Archivo 400/600/800 for both heading and body |
| No decoration | Alignment and dividers organize; no gradients, no rounded corners |

### Token palette

```
Background    --color-bg:      #fafaf9  (neutral canvas)
Surface       --color-surface: #f5f5f4
Text          --color-text:    #1a1f24  (deep ink)
Accent        --color-accent:  #1d4ed8  (foundry blue — primary action)
Divider       --color-divider: color-mix(in srgb, #1a1f24 18%, transparent)
```

**Neutral ramp** (warm stone, shared perceptual scale):
`--color-neutral-100` (#fafaf9) through `--color-neutral-900` (#292524)

**Accent ramp** (Foundry Blue):
`--color-accent-100` (#dbeafe) through `--color-accent-900` (#1e3a8a)

**Semantic ramps**:
- `--color-good-*` — Verification Green (`#15803d` at 700)
- `--color-warn-*` — Warm Amber (`#b45309` at 700)
- `--color-bad-*` — Error Red (`#b91c1c` at 700)

Usage: light steps (100–300) for tinted fills/hovers/borders, 500 as base, 700–900
for text on tinted backgrounds and pressed states. Semantic colors are always
paired with an icon and label for accessibility.

### Elevation

```
--shadow-sm:  0 1px 2px   (subtle lift)
--shadow-md:  0 3px 10px  (cards, dropdowns)
--shadow-lg:  0 12px 32px (modals, drawers)
```

### Spacing scale

`--space-1` (4px) through `--space-8` (32px). All layout uses these tokens.

### Typography

```
--font-heading: "Archivo", system-ui, sans-serif  (weight 800)
--font-body:    "Archivo", system-ui, sans-serif  (weight 400)

h1: 42px    h2: 32px    h3: 25px    h4: 20px
h5: 16px    h6: 13px (uppercase, 0.08em tracking)
Body: 15px, line-height 1.55
```

Archivo is loaded from Google Fonts via `<link>` in `layout.tsx`, not via CSS
`@import` (which would be dropped by Tailwind's CSS processor).

### Interaction states

- `:hover` — tint from the accent ramp
- `:active` / pressed — one step past the base accent
- `:focus-visible` — `outline: 2px solid var(--color-accent); outline-offset: 2px`
- `::selection` — accent tint
- `:disabled` — 45% opacity
- Never use browser-default blue focus rings

### Design system classes used

| Class | Purpose |
|---|---|
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` | Button variants |
| `.input` | Text inputs, textareas, selects |
| `.card` | Content cards (via `.asset-card` in the app) |
| `.table` | Data tables |
| `.dialog-backdrop` + `.dialog` | Modal/drawer (Radix-based in the app) |
| `.hr` | Strong 2px horizontal rule |

---

## 3. Application CSS architecture

The application uses **two CSS layers**:

1. **`design-system.css`** — The original Modernist tokens and component primitives,
   imported unchanged. Defines all color/font/space/shadow/radius variables plus
   base element styles (headings, links, images, body).

2. **`globals.css`** — Application-specific layout classes, component compositions,
   responsive breakpoints and print styles. Imports Tailwind (available but used
   sparingly) and the design system. Adds semantic status colors:

```css
:root {
  --good:    oklch(.36 .09 150);   /* green — approved/pass */
  --good-bg: oklch(.94 .035 150);
  --warn:    oklch(.42 .1 65);     /* amber — needs review/warning */
  --warn-bg: oklch(.97 .025 80);
}
```

### Key layout classes

| Class | Layout | Used by |
|---|---|---|
| `.shell` | `grid: 20% / 1fr`, full viewport | Root application shell |
| `.sidebar` | Flex column, right border | Left navigation |
| `.main-shell` | Flex column, min-width 0 | Main content area |
| `.topbar` | 56px fixed header strip | Breadcrumbs, user, actions |
| `.pack-header` | Pack title, status, flow indicator | Pack context bar |
| `.studio-grid` | `grid: 3fr / 1fr` | Asset editor + validation panel |
| `.editor-column` | Max 980px centered, auto margin | Asset content |
| `.trust` | Right validation panel | Quality checks + provenance |
| `.content` | `flex: 1`, overflow auto | Scrollable main area |
| `.page` | 32px padding, max 1400px | Full-width pages |

### Responsive breakpoints

| Breakpoint | Behavior |
|---|---|
| ≤ 1150px | Editor padding reduced; studio grid narrows to `1fr / 240px`; user name hidden |
| ≤ 950px | Sidebar narrows to 200px; validation panel hidden (toggle button appears); stats to 2-col |
| ≤ 720px | Sidebar becomes off-canvas drawer; mobile menu button appears; single-column layouts |
| Print | Student header/nav/buttons hidden; white background; page-break avoidance on cards |
| `prefers-reduced-motion` | All animations disabled |

---

## 4. Component architecture

### Stack

- **Next.js 15** with App Router, server and client components
- **TypeScript** in strict mode
- **Tailwind CSS v4** (available, used alongside design-system CSS)
- **shadcn/ui** pattern — `cva`-based Button with Radix Slot composition
- **Radix UI** — Dialog primitives for modals and drawers
- **Lucide React** — Icon set
- **TanStack Query v5** — Server state, polling, cache invalidation

### Component tree

```
app/
  layout.tsx          — HTML root, font loading, QueryClientProvider
  page.tsx            — Renders <Studio />
  providers.tsx       — TanStack QueryClient setup
  student/[token]/
    page.tsx          — Renders <StudentView token={…} />

components/
  ui/
    button.tsx        — cva-based Button with primary/secondary/ghost variants
    dialog.tsx        — Panel wrapper (modal or drawer) using Radix Dialog
    status.tsx        — Status badge, Skeleton loader, Empty state

  layout/
    shell.tsx         — Application shell: sidebar + topbar + pack header

  dashboard/
    dashboard.tsx     — Workspace home, pack table, stats, empty state

  sources/
    create-pack.tsx   — Modal form for new learning pack
    sources.tsx       — Source library, file upload, text notes, evidence list

  evidence/
    evidence-drawer.tsx — Right-side drawer with source passage + provenance

  studio/
    studio.tsx        — Root orchestrator: auth, routing, state, toasts
    asset-editor.tsx  — Three-column editor with quiz tabs + validation sidebar
    overview.tsx      — Pack overview with objective alignment table
    approval.tsx      — Teacher review dialog with attestation checkbox
    login.tsx         — Email/password (Supabase) or token (local) sign-in
    objective-editor.tsx — Modal for revising an objective description
    system-pages.tsx  — Versions, Validation, AnswerKey, Resources, VideoWorkflow

  student/
    student-view.tsx  — Learn/Practice/Watch/Revise/Explore tabs, quiz interaction
```

### State management

| Concern | Mechanism |
|---|---|
| Server data (packs, assets, evidence) | TanStack Query with cache keys |
| Current pack ID | `localStorage` + React state |
| Current screen | React state in `studio.tsx` |
| Auth session | Supabase client (hosted) or `sessionStorage` (local) |
| Token refresh | `lib/auth.ts` → `supabase().auth.getSession()` on every API call |
| Editing draft | Local `useState` in `asset-editor.tsx` |
| Review dialog target | React state (`Asset | 'pack' | null`) |
| Toast messages | Timed React state |
| Job polling | TanStack Query `refetchInterval` (1.2s when jobs are active) |

---

## 5. Screen-by-screen design

### 5.1 Login

```
┌─────────────────────────────────┐
│ ■ LESSONFOUNDRY                 │
│                                 │
│ TEACHER WORKSPACE               │
│ Generation with control.        │
│                                 │
│ [Email / Token input]           │
│ [Password input]                │
│                                 │
│ [Open teacher studio →]         │
└─────────────────────────────────┘
```

- Supabase mode: email + password fields
- Local mode: teacher token field with development notice
- Error display below form
- Single Supabase client, persistent sessions, auto-refresh

### 5.2 Dashboard

```
┌──────────┬──────────────────────────────────────────────┐
│ SIDEBAR  │  WORKSPACE · TEACHER STUDIO                  │
│          │  Your teaching, connected.                   │
│ Workspace│                        [+ Create Pack]       │
│ ├ Dash   │                                              │
│ ├ Packs  │  ┌─────┬─────┬─────┬─────┐                  │
│ └ Sources│  │ 3   │Enf. │Tchr │Pres.│  ← Stats         │
│          │  └─────┴─────┴─────┴─────┘                  │
│ Current  │                                              │
│ Pack     │  Recent learning packs                       │
│ ├ Over.  │  ┌──────┬───────┬──────┬─────┬──────┐       │
│ ├ Expl.  │  │ Pack │Subject│Source│Stat │Valid.│       │
│ ├ Assess.│  ├──────┼───────┼──────┼─────┼──────┤       │
│ ├ Quiz   │  │ …    │ …     │ …    │ …   │ …    │       │
│ └ ...    │  └──────┴───────┴──────┴─────┴──────┘       │
│          │                                              │
│ System   │  [Load Newton demo]                          │
│ ├ Vers.  │                                              │
│ └ Valid. │                                              │
└──────────┴──────────────────────────────────────────────┘
```

- Stats grid: 4 equal columns with 2px top border
- Pack table: sortable columns with status badges
- Empty state: step-by-step onboarding with create button
- Demo button: loads explicitly labeled Newton fixture

### 5.3 Pack Header (persistent in pack context)

```
┌───────────────────────────────────────────────────────┐
│ Newton's Laws of Motion                               │
│ Physics · Class 11 · CBSE / JEE · 3 obj · 3 sources  │
│                                                       │
│ ■ NEEDS REVIEW    Pack v5    [Approve pack]           │
│                                                       │
│ ■Source → ■Evidence → ■Objectives → ■Generate →       │
│ ■Validate → ■Review → ■Approve → ■Learn              │
└───────────────────────────────────────────────────────┘
```

- Flow indicator with red dot markers
- Status badge + version + approve button
- Approved state shows green lock banner

### 5.4 Overview

```
┌─────────────────────────────────────────────────────┐
│ PACK OVERVIEW                                       │
│ From source to student.                             │
│                                                     │
│ [1. Add sources] [2. Check support] [3. Generate]   │
│                                                     │
│ ┌──────┬──────┬──────┬──────┐                       │
│ │ 3    │ 12   │ 3/3  │ 0/11 │  ← Stats             │
│ │Src   │Evid  │Obj   │Appr  │                       │
│ └──────┴──────┴──────┴──────┘                       │
│                                                     │
│ OBJECTIVE ALIGNMENT                                 │
│ ┌─────────────┬─────┬─────┬──────┬────────┐         │
│ │ Objective   │Evid.│Expl.│Quiz  │Status  │         │
│ ├─────────────┼─────┼─────┼──────┼────────┤         │
│ │ OBJ-01 …    │ 4   │ ✓   │ ✓    │SUPPORT │         │
│ │ OBJ-02 …    │ 3   │ ✓   │ ✓    │SUPPORT │         │
│ │ OBJ-03 …    │ 0   │ Gap │ Gap  │GAP     │         │
│ └─────────────┴─────┴─────┴──────┴────────┘         │
│                                                     │
│ [Revise objective] per row                          │
└─────────────────────────────────────────────────────┘
```

### 5.5 Source Library

```
┌─────────────────────────────────────────────────────┐
│ TRUSTED KNOWLEDGE BOUNDARY                          │
│ Source library                                      │
│                                [+ Add teacher notes]│
│                                                     │
│ ┌───────────────────────────────────────────┐       │
│ │ 📁 Upload PDF, PPTX, DOCX, TXT, MD       │       │
│ │    Multiple files · 10 MB each            │       │
│ └───────────────────────────────────────────┘       │
│                                                     │
│ ┌──────────────────┬─────┬──────┬─────────┐         │
│ │ Source           │ Ver │Evid. │ Actions  │         │
│ ├──────────────────┼─────┼──────┼─────────┤         │
│ │ 📄 physics.pdf   │ v1  │ 8    │ Replace │         │
│ │ 📄 notes.txt     │ v2  │ 4    │Download │         │
│ └──────────────────┴─────┴──────┴─────────┘         │
│                                                     │
│ Extracted evidence                                  │
│ ┌───────────────────────────────────────────┐       │
│ │ E1 · physics.pdf  Page 1 · Source v1      │       │
│ │ Newton's first law: an object remains…    │       │
│ │ [Inspect source passage →]                │       │
│ └───────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
```

### 5.6 Studio — Asset Editor (three-column)

```
┌──────────┬──────────────────────────────┬────────────┐
│          │  LEARNING PACK · TEACHING    │ VALIDATION │
│ Sidebar  │  Explanation                 │            │
│ ~20%     │                [Review]      │ 8/13 pass  │
│          │  3 assets  v2  ⚠ NEEDS REV  │            │
│          │                              │ Schema   ✓ │
│          │ ┌────────────────────────┐   │ Length   ✓ │
│          │ │ §1 · Introduction      │   │ Evidence ✓ │
│          │ │ OBJ-1 · v1             │   │ Location ✓ │
│          │ │                        │   │ Answer   ✓ │
│          │ │ Newton's first law…    │   │ Key      ✓ │
│          │ │                        │   │ Leakage  ⚠ │
│          │ │ E1 Section 2           │   │ Safety   ✓ │
│          │ │ [Edit] [Regen] [Evid.] │   │ Dupes    ✓ │
│          │ └────────────────────────┘   │ Difficulty⚠│
│          │                              │ Grounding⚠│
│          │ ┌────────────────────────┐   │ Consist. ⚠│
│          │ │ §2 · Core concepts     │   │ Terms    ⚠│
│          │ │ …                      │   │            │
│          │ └────────────────────────┘   │ SELECTED   │
│          │                              │ v2         │
│          │                              │ Provenance │
│          │                              │ Model: … │
│          │                              │ Generated… │
│          │                              │ Contract…  │
└──────────┴──────────────────────────────┴────────────┘
```

**Validation states**: ✓ PASS, ⚠ NEEDS REVIEW (teacher must inspect), ✗ FAIL (blocks approval)

### 5.7 Quiz Editor

```
┌──────────────────────────────────────────────────────┐
│  LEARNING PACK · ASSESSMENT ASSETS                   │
│  Quiz                                    [Review]    │
│  5 questions   Version v2   ⚠ NEEDS REVIEW          │
│                                                      │
│  ┌─────┬─────┬─────┬─────┬─────┐                    │
│  │Q1 v1│Q2 v1│Q3 v2│Q4 v1│Q5 v1│  ← Tab bar        │
│  └─────┴─────┴─────┴─────┴─────┘                    │
│                                                      │
│  Question 3                    ⚠ NEEDS REVIEW        │
│  OBJ-1 · Explain Newton's…    v2                     │
│                                                      │
│  A student says action and reaction forces cancel…   │
│                                                      │
│  ┌─ A  The reaction force is always smaller…      ┐  │
│  ├─ B  The reaction force occurs only after…      ┤  │
│  ├─ C  Equal forces always imply both…            ┤  │
│  ├─ D  The two forces act on different bodies… KEY┤  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ▸ Teacher-only answer / explanation                 │
│                                                      │
│  Advanced · Analyze · mock-extractive                │
│                                                      │
│  [E4 Section 4]    [Edit] [Regenerate] [Validation]  │
└──────────────────────────────────────────────────────┘
```

Key interaction: **Regenerate Q3** creates Q3 v2 while Q1, Q2, Q4, Q5 remain at v1.
Version tabs update independently. Evidence chips link to the drawer.

### 5.8 Evidence Drawer

```
                              ┌──────────────────────┐
                              │ EVIDENCE · E4        │
                              │ Section 4            │ [×]
                              │                      │
                              │ Source │ Location │ V │
                              │ phys…  │ Page 4   │v1│
                              │                      │
                              │ SOURCE PASSAGE        │
                              │ ┌──────────────────┐ │
                              │ │ physics.pdf  p.4 │ │
                              │ │ ░░░░░░░░░░░░░░░░ │ │
                              │ │ ┌──────────────┐ │ │
                              │ │ │ E4           │ │ │
                              │ │ │ Newton's     │ │ │
                              │ │ │ third law…   │ │ │
                              │ │ └──────────────┘ │ │
                              │ │ ░░░░░░░░░░░░░░░░ │ │
                              │ └──────────────────┘ │
                              │                      │
                              │ Supports: OBJ-01     │
                              │ Used by: Explanation… │
                              │ SHA-256: abc123…      │
                              └──────────────────────┘
```

- Slide-in from right, 540px max width
- Source passage highlighted with red accent outline
- Evidence ID badge positioned top-right of highlight
- Provenance grid: source, location, version, extraction date

### 5.9 Approval Dialog

```
┌──────────────────────────────────────┐
│ Teacher approval                     │
│ Explanation · v2                     │
│                                      │
│ ⚠ Approval publishes exact versions │
│   and locks editing.                 │
│                                      │
│ [✓] I reviewed source support,       │
│     factual correctness, answers,    │
│     difficulty and warnings.         │
│                                      │
│ Review note                          │
│ ┌──────────────────────────────────┐ │
│ │ Reviewed evidence passages and…  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [Approve & publish]    [Cancel]      │
└──────────────────────────────────────┘
```

- Checkbox attestation required (not just a click)
- Minimum 10-character review note
- Expected version/revision check prevents approving stale state

### 5.10 Version Timeline

```
┌──────────────────────────────────────┐
│ VERSION TIMELINE                     │
│                                      │
│  ■ v5 · 10:32 AM                    │
│  │ Controlled regeneration           │
│  │ Changed: quiz3. Unchanged:        │
│  │ explanation, assessment_easy, …   │
│  │                                   │
│  ■ v4 · 10:31 AM                    │
│  │ Learning pack generated           │
│  │ Changed: explanation, quiz1–5, …  │
│  │ Unchanged: none (initial gen)     │
│  │                                   │
│  ■ v3 · 10:30 AM                    │
│  │ Evidence mapping completed        │
│  │                                   │
│  ■ v2 · 10:29 AM                    │
│  │ Source uploaded                    │
│  │ Newton — notes.txt v1             │
│  │                                   │
│  ■ v1 · 10:28 AM                    │
│    Pack created                      │
└──────────────────────────────────────┘
```

### 5.11 Student View

```
┌──────────────────────────────────────────────────────┐
│ STUDENT PREVIEW  Approved · v5    [Exit to studio]   │
├──────────────────────────────────────────────────────┤
│ ■ LessonFoundry / Physics · Class 11                 │
├──────────────────────────────────────────────────────┤
│ [Learn] [Practice] [Watch] [Revise] [Explore]        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Newton's Laws of Motion                             │
│                                                      │
│  Introduction                                        │
│  Newton's first law: an object remains at rest…      │
│                                                      │
│  Core Concepts                                       │
│  Newton's second law: F = ma…                        │
│                                                      │
│  [Practice with the quiz →]                          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Hidden from students**: validation, evidence, drafts, regeneration, version history,
approval controls, internal pipeline details, teacher-only solutions (until policy allows).

---

## 6. Status badge system

| State | Color | Icon | Usage |
|---|---|---|---|
| `PASS` / `SUPPORTED` / `Ready` | Verification Green | `PassIcon` | Validation passed |
| `APPROVED` | Verification Green | `ApprovalIcon` | Teacher authorized, locked |
| `FAIL` / `GAP` | Error Red | `FailIcon` | Blocking check failure |
| `WARNING` / `NEEDS REVIEW` | Warm Amber | `WarningIcon` | Teacher inspection required |
| `DRAFT` | Neutral | `DraftIcon` | Unpublished |
| `Queued` | Neutral | `QueuedIcon` | Pending background job |
| `Running` | Warm Amber | `RunningIcon` | Active background job |

Every status is rendered as a chip with icon + label. Color is never the only
indicator of state.

---

## 7. Data flow

```
                    ┌─────────────┐
                    │ TanStack    │
    API response →  │ Query Cache │  → Component props
                    └──────┬──────┘
                           │
                    invalidateQueries()
                           │
    User action  →  post() / api()  →  Backend
                           │
                    setToast() / setError()
```

- **Pack query** (`['pack', pid]`): refetches every 1.2s when jobs are active
- **List query** (`['packs']`): invalidated after create/demo
- **Versions query** (`['versions', pid, revision]`): invalidated after pack changes
- **Answer key query** (`['answer-key', pid, revision]`): derived from published versions
- **Resources query** (`['resources', pid]`): separate from pack data

---

## 8. Captured screenshots

| Screenshot | Shows |
|---|---|
| `docs/evidence/quiz-q3-v2.png` | Quiz editor after Q3 regeneration; Q1/Q2/Q4/Q5 at v1, Q3 at v2; validation sidebar |
| `docs/evidence/evidence-drawer.png` | Source passage with highlighted evidence, provenance metadata |
| `docs/evidence/version-history.png` | Timeline showing controlled regeneration event |
| `docs/evidence/student-view.png` | Approved-only student practice with server-side answer checking |
| `docs/evidence/mock-video-workflow.png` | AI Teacher with approved script and mock render status |
| `docs/evidence/tablet-studio.png` | 820px viewport with collapsed validation panel |

All screenshots were captured by automated Playwright browser tests against the
running application with real API interactions — not static design mockups.

---

## 9. Brand icons

All icons are now custom LessonFoundry icons in `frontend/components/icons/brand.tsx`.
They share a 24×24 grid, 1.5 px stroke, square caps/miter joins and zero radius.
See `docs/BRAND_SYSTEM.md` for the full rationale.

The sidebar maps every screen to a branded navigation icon; the status component
uses distinct icons for PASS, APPROVED, FAIL, WARNING, DRAFT, QUEUED and RUNNING.
The Evidence and Approval dialogs feature signature branded kickers.

---

## 10. Accessibility

| Feature | Implementation |
|---|---|
| Skip navigation | `<a href="#main-content">` visually hidden, visible on focus |
| Semantic HTML | `<nav>`, `<main>`, `<article>`, `<section>`, `<header>`, `<aside>` |
| ARIA roles | `role="tablist"` / `role="tab"` on quiz tabs; `aria-current="page"` on nav |
| Keyboard focus | `2px solid var(--color-accent)` outline with `outline-offset: 2px` |
| Focus management | Radix Dialog traps focus; Escape closes drawers/modals |
| Status announcements | `role="status"` on toast, `role="alert"` on errors |
| Screen reader text | `.sr-only` class for loading indicators |
| Reduced motion | `@media (prefers-reduced-motion)` disables all animations |
| Labels | All form inputs wrapped in `<label>` elements |
| Contrast | Body text uses ink-on-ground (#1a1f24 on #fafaf9); semantic colors paired with icons/labels |

Full WCAG audit remains pending. Exact contrast ratios across all interactive states
and the complete tab-order experience need manual verification.

---

## 11. Remaining design work

| Area | Current state | Needed |
|---|---|---|
| Flowchart editor | Not implemented | Structured node/edge editor for concept flows |
| Exam focus PYQs | Text placeholder | Attributed question curation UI |
| Source page viewer | Text-location evidence | PDF/PPTX page-canvas rendering |
| Notification center | Not implemented | Design shows notification badge with count |
| Global search | Input present, not functional | Pack/evidence/asset search |
| Tablet validation | Inline toggle | Dedicated collapsible drawer |
| Rich assessment | Text/solution only | Marks rubric, structured sub-questions |
| Video player | Mock status only | Real embedded player for rendered videos |
| Mobile navigation | Basic off-canvas | Full responsive navigation with gestures |
