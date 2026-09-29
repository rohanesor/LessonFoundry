# LessonFoundry — Brand System

## Purpose

This document defines the LessonFoundry visual identity: logo, wordmark, color,
typography, iconography and micro-branding. It is a refinement layer over the
existing application layout — no information architecture or UI structure was
changed.

## Brand idea

> **A place where raw teaching material is transformed into a reliable learning product.**

*Foundry* implies transformation, precision, controlled production, quality checks,
repeatability and craftsmanship. The identity therefore combines:

- **Education** — clarity, structure, learning
- **Production / craft** — controlled generation, versions, tooling
- **Trust / verification** — evidence, validation, teacher approval

The product should feel like **education infrastructure**, not a consumer learning
app or a generic AI dashboard.

Avoided clichés: graduation caps, open-book primary marks, cartoon teachers,
lightbulbs, robot heads, generic AI sparkles, brain icons, school crests.

---

## Logo

### Symbol concept

The mark is an **abstract foundry crucible** viewed from above:

```
┌─────────────┐
│      │      │
│  ────┼────  │   ← source document enters the grid
│      │      │
└──────┬──────┘
       ▼
      ◆         ← structured learning asset emerges
```

- Outer square = trusted source boundary
- Inner cross = verification / transformation grid
- Bottom diamond = produced learning asset

The negative-space cross also reads as a **plus** (construction / foundry) and
as a **window** into the process. The mark is abstract, ownable and scalable.

### Files

| File | Usage |
|---|---|
| `LessonFoundry Frontend Design/design_handoff_lessonfoundry/assets/logo/lockup-color.svg` | Official wordmark source |
| `LessonFoundry Frontend Design/design_handoff_lessonfoundry/assets/logo/mark-color.svg` | Official mark source |
| `frontend/public/logo/*.svg` | Copied official logo assets |
| `frontend/public/icons/*.svg` | Copied official icon assets |
| `frontend/public/favicon.svg` | Official favicon (light variant) |
| `frontend/components/icons/LFIcon.tsx` | Official icon renderer from the handoff |
| `frontend/components/icons/brand.tsx` | Application-facing icon aliases + logo wrappers |

### Scaling behavior

- 16×16: diamond and outer square remain distinct
- 32×32: cross becomes visible
- 64×64+: full detail
- Monochrome: works as line art; diamond fills to preserve contrast

---

## Wordmark

```
LessonFoundry
```

- Typeface: **Archivo** (same as UI)
- `Lesson` — weight 600, regular width
- `Foundry` — weight 800, tight tracking
- No gradients, no decorative ligatures
- Used in sidebar and login (`brand-wordmark` CSS class)

The wordmark is implemented as an inline-styled SVG text element so the
`Lesson`/`Foundry` weight distinction is preserved even when the rest of the
page loads Archivo from Google Fonts.

---

## Color system

Values are taken directly from the official handoff (`tokens/tokens.css`).

### Primary palette

| Role | Token | Hex | Usage |
|---|---|---|---|
| Deep Ink | `--color-text` | `#191f2b` | Primary text, navigation, headers, strong UI |
| Foundry Blue | `--color-accent` | `#2763ae` | Primary actions, selected nav, links, active states |
| Verification Green | `--lf-green` | `#267543` | Pass, approved, verified evidence, successful jobs |
| Warm Amber | `--lf-amber` | `#d49838` | Warning, needs review, pending teacher action |
| Error Red | `--lf-red` | `#cc3430` | Failures, destructive actions, validation failures |
| Canvas | `--color-bg` | `#f3f2f2` | Main ground |
| Surface | `--color-surface` | `#eae9e9` | Surfaces, cards |

### Mapped to existing roles

The legacy `--color-*` tokens are remapped to the handoff values:

```css
--color-text    → #191f2b
--color-accent  → #2763ae
--color-bg      → #f3f2f2
--color-surface → #eae9e9
```

### Semantic status tokens

```css
--good     → var(--color-good-700)   /* green */
--good-bg  → var(--color-good-100)
--warn     → var(--color-warn-700)   /* amber */
--warn-bg  → var(--color-warn-100)
--bad      → var(--color-bad-700)    /* red */
--bad-bg   → var(--color-bad-100)
--draft    → var(--color-neutral-700) /* gray */
--draft-bg → var(--color-neutral-200)
```

### Usage rules

- Use **Foundry Blue** for the primary action and active navigation
- Use **Verification Green** only for verified/approved states
- Use **Warm Amber** for teacher-review states
- Use **Error Red** only for failures or destructive actions
- Use **Neutral Canvas** family for grounds, borders and inactive states
- Never use color alone to indicate state — pair with icon + label

---

## Typography

- Family: **Archivo** (Google Fonts: 400, 600, 800)
- Headings: 800 weight, tight tracking
- Body: 400 weight, 15 px / 1.55 line-height
- Labels / badges: 700 weight, uppercase, tracked

Archivo was retained because it already supported the Modernist engineered feel;
the brand only refined the color context in which it appears.

---

## Icon system

All icons are rendered by `frontend/components/icons/LFIcon.tsx`, copied from
the official handoff. They share a single visual language:

- 24 × 24 px viewBox
- 1.75 px stroke (2.1 at ≤12 px, 1.5 at ≥32 px)
- Square caps and mitred joins
- Zero corner radius
- Outline-first, geometric, medium weight
- `currentColor` so they inherit context

The 37-icon set includes every product, navigation and status icon required.

### Core product icons

| Concept | Component | Meaning |
|---|---|---|
| Source | `SourceIcon` | Trusted source material |
| Evidence | `EvidenceIcon` | Traceable supporting passage |
| Objective | `ObjectiveIcon` | Learning intent / target |
| Generation | `GenerationIcon` | Controlled AI transformation |
| Validation | `ValidationIcon` | System quality check |
| Approval | `ApprovalIcon` | Teacher authorization |
| Version | `VersionIcon` | Controlled change history |
| Student | `StudentIcon` | Final learning experience |
| AI Teacher | `AITeacherIcon` | Approved content presentation |
| Resources | `ResourcesIcon` | Supplementary material |

### Signature icons

**Evidence icon**: a document with a highlighted passage and a source marker.
Communicates *"this content has a source."*

**Validation icon**: a checkmark inside a structural frame. Communicates
*"system checks passed."*

**Approval icon**: a checkmark inside a shield frame. Communicates
*"teacher has authorized this content."* Visually distinct from validation.

**Version icon**: stacked layers. Communicates *"controlled change history."*

**Generation icon**: two linked squares with a transformation arrow.
Communicates *"controlled AI operation"* without sparkles.

### Navigation icons

All sidebar items now have a matching icon:

| Screen | Icon |
|---|---|
| Dashboard | `DashboardIcon` |
| Learning Packs | `PacksIcon` |
| Sources | `SourceIcon` |
| Overview | `OverviewIcon` |
| Explanation | `ExplanationIcon` |
| Assessment | `AssessmentIcon` |
| Quiz | `QuizIcon` |
| Answer Key | `AnswerKeyIcon` |
| AI Teacher | `AITeacherIcon` |
| Exam Focus | `ExamFocusIcon` |
| Resources | `ResourcesIcon` |
| Versions | `VersionIcon` |
| Validation | `ValidationIcon` |
| Settings | `SettingsIcon` |

### Status icons

| State | Icon | Label example |
|---|---|---|
| PASS | `PassIcon` | PASS |
| APPROVED | `ApprovalIcon` | APPROVED |
| FAIL | `FailIcon` | FAILED |
| WARNING / NEEDS REVIEW | `WarningIcon` | REVIEW |
| DRAFT | `DraftIcon` | DRAFT |
| QUEUED | `QueuedIcon` | QUEUED |
| RUNNING | `RunningIcon` | RUNNING |
| READY | `PassIcon` | READY |
| LOCKED | `LockedIcon` | LOCKED |

### AI iconography

- No sparkle icons are used for generation
- `GenerationIcon` and `RegenerateIcon` communicate transformation
- AI processing is presented as a system operation, not a magic effect

---

## Micro-branding

| Location | Implementation |
|---|---|
| Sidebar | `LFMark` + `LessonFoundry` wordmark |
| Login | `LFMark` + `LFWordmark` |
| Student header | `LFMark` + compact wordmark |
| Studio topbar | "LessonFoundry Studio" user caption |
| Approval dialog | `ApprovalIcon` + "Teacher authorization required" kicker |
| Evidence drawer | `EvidenceIcon` + "Source-bound evidence" kicker |
| Favicon | `public/favicon.svg` |
| Page metadata | `LessonFoundry — Learning Pack Studio` |

The logo is not repeated excessively — branding is intentional, not promotional.

---

## Favicon

`frontend/public/favicon.svg` is a compact monochrome SVG:

- Recognizable at 16×16
- Works on light and dark tabs
- Monochrome form works without color
- Referenced via Next.js metadata and `<link rel="icon">`

No raster fallback is provided; all modern browsers support SVG favicons.

---

## Diagram language

LessonFoundry diagrams use:

- Clean square/circle nodes
- Thin connecting lines
- Subtle containers
- Clear directional arrows
- Semantic status icons

The pipeline diagram in the pack header is kept minimal:

```
Source → Evidence → Objectives → Generate → Validate → Review → Approve → Learn
```

The same language should be used in the pitch deck.

---

## Brand voice

UI copy is:

- precise
- confident
- calm
- technical
- teacher-respectful

Examples:

| Preferred | Avoided |
|---|---|
| Ready for review | 🎉 Your awesome lesson is ready! |
| Evidence coverage: 92% | AI confidence: 92% |
| Approved by teacher | AI-approved |
| Regenerate Q3 | ✨ Make it better |
| Teacher authorization required | Magic complete |

The visual hierarchy reinforces:

```
AI proposes → Validators check → Teacher approves → Student learns
```

The system never visually implies that AI is the final authority.

---

## Presentation branding

The same system must work in pitch materials:

- **Logo**: `LFMark` at 64 px or larger
- **Wordmark**: Archivo 600/800 combination
- **Primary color**: Foundry Blue `#1d4ed8`
- **Secondary color**: Deep Ink `#1a1f24`
- **Accent colors**: Verification Green, Warm Amber, Error Red
- **Typography**: Archivo family
- **Icon system**: custom outline icons from `brand.tsx`
- **Diagram style**: thin-line nodes, square/circle geometry, semantic icons
- **Status language**: PASS / REVIEW / FAILED / APPROVED / LOCKED

---

## Final design test

If all text were removed and only the logo, colors, icons, diagrams and status
symbols remained, the product should still feel like **LessonFoundry** — a
trusted AI learning-production system, not a generic SaaS dashboard or children's
education app.

---

## Files changed

| File | Change |
|---|---|
| `frontend/components/icons/brand.tsx` | New — all brand icons and wordmark |
| `frontend/public/favicon.svg` | New — compact brand symbol |
| `frontend/app/layout.tsx` | Added favicon metadata |
| `frontend/app/design-system.css` | Remapped to brand palette; added semantic ramps |
| `frontend/app/globals.css` | Updated status tokens; `.brand-*` classes |
| `frontend/components/layout/shell.tsx` | Uses `LFMark`, wordmark and nav icons |
| `frontend/components/studio/login.tsx` | Uses `LFMark` and `LFWordmark` |
| `frontend/components/student/student-view.tsx` | Uses `LFMark` and wordmark |
| `frontend/components/ui/status.tsx` | Uses custom status icons |
| `frontend/components/ui/dialog.tsx` | Uses `CloseIcon` |
| `frontend/components/evidence/evidence-drawer.tsx` | Uses `EvidenceIcon` |
| `frontend/components/studio/approval.tsx` | Uses `ApprovalIcon` |
| `frontend/components/studio/asset-editor.tsx` | Uses custom editor icons |
| `frontend/components/studio/overview.tsx` | Uses custom icons |
| `frontend/components/studio/system-pages.tsx` | Uses custom icons |
| `frontend/components/dashboard/dashboard.tsx` | Uses custom icons |
| `frontend/components/sources/sources.tsx` | Uses custom source/upload icons |

## Verification

- `npm run typecheck` — passed
- `npm run build` — passed
- Backend unit tests — 26 passed
- Playwright tests — blocked by missing host `libnspr4.so` system library
