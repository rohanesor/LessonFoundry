# Handoff: LessonFoundry — Teacher Studio, Validation, Student Mode & Brand

## Overview
LessonFoundry is a constraint-aware learning-pack compiler for teachers. It turns trusted sources (PDF, PPTX, DOCX, TXT/MD) plus teacher intent (objectives and constraints) into a connected learning pack: Explanation, Assessment, Quiz, Answer Key, AI Teacher video, Important & Exam Focus, and Supplementary Resources.

Core pipeline, which the UI must make visible everywhere:
**Source → Evidence → Objective → AI generation → Validation → Teacher approval → Student.**
Authority order: *AI proposes · validators check · teacher approves · student learns.* The AI is never shown as the final authority.

Every generated item shows: where it came from (evidence ID, source file, page), which objective it supports, whether it passed validation, whether it is approved, its version, and whether it needs regeneration.

## About the design files
The files in this bundle are **design references built in HTML**: prototypes showing the intended look and behaviour. They are not production code to copy. Rebuild them in the target stack: **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui**, with mock data behind a thin API layer so it can be swapped for REST calls to a FastAPI backend.

- `prototype/LessonFoundry Prototype v4.html` is the complete clickable app, a single offline file. Open it in a browser. The **Demo Controls** button (bottom of the sidebar) has a *Story* tab that walks the 13-step demo, and a *States* tab with all demo states.
- `prototype/LessonFoundry Brand System.html` is the brand guide: logo, colour, type, icons, status language, diagrams, voice and deck samples.
- `source_dc/*.dc.html` holds the readable source of every screen. Each file is HTML with inline styles plus a `class Component` logic block, and the logic block holds all state and derived data. Read these for exact values. They open in a browser next to `support.js`.

## Fidelity
**High fidelity.** Final colours, typography, spacing, copy and interactions. Recreate pixel-accurately, using shadcn/ui primitives restyled to these tokens: zero radius, 2px rules and flush-left button labels.

## Global layout (app shell)
- Root grid: `grid-template-columns: minmax(210px, 20%) minmax(860px, 1fr)`, `height: 100vh`. Below ~1080px the page scrolls horizontally; this is a desktop-first product.
- **Sidebar** (left, 2px right rule `--color-divider`):
  - Brand row 56px high: lockup mark 22px + wordmark.
  - Groups: **Workspace** (Dashboard, Learning Packs, Sources), **Current pack** (Overview, Explanation, Assessment, Quiz, Answer Key, AI Teacher, Exam Focus, Resources), **System** (Versions, Validation, Settings).
  - Group label: 10px / 700, uppercase, tracking 0.12em, `neutral-700`. The Current pack group shows the pack title (13px/800) and "v3 · Draft" (11px).
  - Nav row: 31px high, grid `16px 1fr auto`, gap 10px, padding `0 12px 0 18px`. Icon 16px, label 13px. Active row is ink fill with canvas text, weight 700. The right side holds a count or an 18px status glyph.
  - Footer: a dashed-border "Demo Controls" button (monospace 11px, prototype-only), then the "Northfield School · Physics" line.
- **Top bar**: 56px, 2px bottom rule, padding `0 20px`, gap 14px.
  - Breadcrumb, 13px; the last segment is 600 weight and ellipsises from the left.
  - Search input (flex `0 1 200px`, min-height 34px), "Student view" secondary button, Notifications button with a count chip, avatar (32px ink square with initials) + name/role.
- **Pack header** (all pack screens), 2px bottom rule:
  - Row 1, padding `14px 24px 10px`:
    - Micro-label "LESSONFOUNDRY STUDIO" (10px/700, tracking 0.16em, with an 11px ink mark).
    - Title 22px/800, tracking −0.015em. Meta line 12px `neutral-700`.
    - Status group: STATUS "Draft · v3" | VALIDATION "7/9 checks passed" | ATTENTION "1 needs review · 1 failed". Labels 10px/700, values 15px/800, separated by 1px rules. Clicking the group opens Validation.
    - [Save Draft] [Approve]. When approved, a single [Create New Version] replaces both.
  - Row 2: workflow strip Source → Evidence → Objective → AI generation → Validation → Teacher approval → Student. Each step is a 14px stage icon coloured by status (green/amber/red/gray) + 10px/700 uppercase label, joined by → in `neutral-500`. Each step navigates to its screen.
- **Approved banner** (when the pack is locked): green-700 fill, white 13px text, approval icon, "APPROVED · v4". Copy: "Student Mode serves this exact version. Editing and regeneration are disabled until you create a new version."

## Screens

### 1. Learning Pack Studio: Explanation / Assessment / Answer Key (hero screen)
- **Layout**: `grid-template-columns: minmax(0,3fr) minmax(250px,1fr)` inside the content area. The sidebar is the left 20%, the editor the centre 60%, the Trust panel the right 20%.
- **Editor column**: centred, `max-width: 860px`, padding `26px 40px 56px`, gap 14px.
  - Kicker "Asset 01 · Topic explanation" (11px/600, uppercase, blue-700).
  - Title 34px/800, tracking −0.02em. An "Approve Explanation" secondary button is right-aligned in the same row.
  - Meta row: Objectives badges ("01 First Law", 12px, 1px border), Status chip, Version (icon + bold "v3").
  - When approved: a green-100 strip "Approved v3 · locked" with [Create New Version].
- **Content item card**:
  - 1px `neutral-300` border, padding `18px 22px 12px`. Selected: surface fill + 2px ink outline.
  - Header: tag "§3" 12px/700 `neutral-600`, title 19px/800, status chip on the right.
  - Sub-meta 12px: "Objective **02** · Second Law", "Version **v1**" (green when just regenerated).
  - Body 16px/1.7, max 68ch, `text-wrap: pretty`. Assessment items add a "Model answer" box.
  - Review note: amber-100 bg, amber-700 text, 12px, "**Teacher review ·** …". Failed notes use red-100 / red-700.
  - Footer (1px top rule): label "Evidence", then evidence chips. A chip is an ink segment with the evidence icon + "E102", then "Physics_Textbook.pdf · Page 17", in 11px. On the right: Edit · Regenerate §3 · View Evidence · Provenance ▾, as ghost 12px buttons with 13px icons.
  - Provenance expands to a 4-column strip: Source + version, Location, Model, History.
  - Editing: textarea (min-height 130px, 15px/1.6) with [Save edit] [Cancel]. Note: "Saving re-runs grounding and terminology checks for this item only."
  - Regenerating: 3 skeleton bars + the line "Regenerating §3 from E110 · keeping Objective 02 · other items untouched".
- **Controlled-regeneration banner** after any regeneration: green-100 strip. "CONTROLLED REGENERATION" (10px/800) · "**§3 → v2**" · "§1, §2, §4, §5 unchanged" · [Version history →].
- **Source coverage gap card** (Objective 04 unsupported):
  - 2px amber border, amber-50 bg (`oklch(0.97 0.025 80)`). Title "Source coverage gap", chip "Not generated".
  - Body: "**Objective 04 · Analyse motion on an inclined plane with friction.** This objective is not sufficiently supported by the selected sources."
  - 3-cell strip: Best match "E126 · p.26, §5.6 Friction" · Relevance "0.31 (min 0.60)" · Missing "Inclined planes, resolving forces".
  - Actions:
    - **Modify objective**: inline input → Save & recheck.
    - **Add source**: goes to Sources.
    - **Continue with warning**: collapses to an amber strip with Undo.
  - Never generate content silently for an unsupported objective.
- **Trust panel**: 1px left rule, 12px text, deliberately quieter than the editor.
  - "Validation" label + "4/5 passed". Check rows: 18px glyph + name. Detail text is shown only for non-passing checks.
  - "Selected · §3 …": Source / Location / Evidence / Supports, plus a full-width [Open evidence E110 →].
  - Objective alignment list.
  - Version: last 3 events + History →.
  - Boundary note: "Generated only from the 3 sources in scope. An objective without evidence is not generated."
- **Loading state**: skeleton cards (`neutral-200/300` bars) in both columns.

### 2. Quiz (asset detail)
- Same 3fr/1fr grid.
  - Header "Quiz" 34px/800, with "10 questions · 8 passed · 1 review · 1 failed".
  - **Question strip**: 10 equal cells, 1px ink border. Each cell shows "Q3" (13px/700), a status glyph and "v1". The selected cell has a surface fill and a 3px ink inset bottom line. A regenerated question shows "v2 •" in green/800.
- **Question card** (2px ink border):
  - Header: "QUESTION 03" (13px/800, tracking 0.12em, blue-700), then "Medium" and "Objective 02" outline tags, a version pill (green fill + white when new), and a status chip.
  - Question textarea, 18px/700.
  - Options: rows with 36px letter squares. The correct option has a green square, a green-50 row and a "Correct answer" tag. Clicking an option marks it correct and re-runs answer validity.
  - Meta row: Correct answer (24px/800 letter), Difficulty segmented control (Easy/Medium/Hard), evidence chip.
  - Validation grid, 3 columns: Answer valid · Evidence supported · Objective aligned · No duplicate · Answer key consistent · Difficulty on target. Non-passing checks also get a tinted explanation row.
  - Regenerate footer (surface fill):
    - Primary [↻ Regenerate Q3] + optional instruction input.
    - Toggles: Keep Objective 02 · Keep difficulty (Medium) · Avoid overlap with other questions.
    - Caption: "Only Q3 changes."
- **Regeneration flow** (key interaction):
  - A 5-step strip: Regenerate → Generating → Q3 v2 → Validate → Review. Done steps are green-100 with ✓, the current step is ink-filled.
  - While it runs, the card shows skeleton options.
  - Then a green-100 review strip: "Question 3 → v2 generated and validated. Review before approving the quiz." / "Questions 1, 2, 4–10 unchanged." with [Accept v2] [Revert to v1].
  - The regeneration, and then the accept or revert, each write a Version History event. The Answer Key entry for Q3 becomes "Regeneration required" and can be regenerated on its own.
  - Quiz approval is blocked while a review is pending.
- **Right panel**: Provenance · Q3 (Source, Source ver., Location, Evidence, Model, Generated, Question ver.), [Open evidence →], Question history.

### 3. Evidence drawer (the main trust mechanism)
- Right drawer, `width: min(540px, 94vw)`, full height, 2px left rule, `shadow-lg`. Backdrop is ink at 22%.
- Header: "EVIDENCE · TRACED TO SOURCE" (evidence icon, 11px/700 blue-700), ID 34px/800, section 13px.
- 3-cell strip: Source (filename) · Location (Page 17 + span) · Source version (v2 + extracted time).
- Source passage: a page preview on a `neutral-300` well. Grey 7px lines stand for surrounding text. The cited passage is Georgia 15px/1.6 on blue-100, with a 2px blue outline and an ID tab.
- Rows: Supports "✓ Objective 01 · Explain Newton's First Law." · Used by (outline chips: Explanation §1, Quiz Q1, Exam Focus …) · Generated asset "Explanation v3".
- Opened from every evidence chip, "View Evidence", validation rows and provenance links.

### 4. Validation & Provenance
- Scorecard row: title + last run + [Re-run validation], then 4 big numbers (Passed / Review / Failed / Objectives covered, 40px/800).
- A strip of 9 coloured bars, one per check.
- Table: Check · Status · Reason · Affected asset. The selected row gets a 2px ink outline.
- Detail panel (minmax 320–400px): Reason, Evidence (quote + [View Source Evidence →]), Affected asset, Suggested action (a primary button that deep-links to the fix).
- Checks: Schema validity, Evidence support, Objective coverage, Answer validity, Answer-key consistency, Difficulty, Duplicate detection, Terminology consistency, Answer leakage.

### 5. Overview / Approval
- **Readiness** (`ApprovalPanel`):
  - "LEARNING PACK READINESS" items: Required assets generated · Evidence available · Objectives covered · Validation completed.
  - Each item has a status glyph, detail text and a deep-link button (Fix / Review / Resolve).
  - An amber summary, e.g. "1 item requires review", and a mandatory acknowledgement when review items exist.
  - Failed checks disable [Approve Learning Pack].
- **After approval**:
  - A green block "✓ APPROVED", with Version v4 · Approved by Priya Nair · date · 🔒 Locked (auto-fit grid, `minmax(170px,1fr)`).
  - A per-asset list showing "Approved" for each.
  - "Student Mode now serves this exact approved version."
  - All edit and regenerate controls are disabled until **Create New Version** (which creates a v5 draft; students keep v4).
- Below: Pack assets table (Asset · Version · Status · Provenance · Open →).
- Right column:
  - "How this pack was made": AI generates / System verifies / Teacher approves / Student learns, each with a status.
  - Learning objectives list.
  - Objective × asset coverage matrix. Empty cells are amber for the gap objective.

### 6. Version History
- Vertical timeline, newest first.
- Kinds are distinguished by icon + label: **AI generated**, **Teacher edited**, **Source updated**, **Approved**.
- Each entry shows version, title, detail, scope, time and actor, plus a before → after pill when relevant.
- Approved entries are visually locked (green, lock icon).

### 7. AI Teacher
- Pipeline: **Approved script v3 (source of truth) → HeyGen (avatar provider) → Rendering → Video ready.**
- Script editor: scenes with narration, approved and locked at v3.
- Render states:
  - Not rendered: [Generate AI Teacher Video].
  - Queued.
  - Rendering, with progress.
  - Completed: large 16:9 player; duration 3:52, script version, source version, generated date, and "Generated from approved script v3".
  - Failed: with retry.
- The video is never presented as educational truth; the script is.

### 8. Important & Exam Focus
- Sections: ★ Must know (concept cards) · ƒ Key formulas & facts · ↳ Concept flow (node diagram) · ✓ Verified PYQs (Exam, Year, Question, Source, Verification).
- Verified PYQs sit in a visually distinct bordered block. An unverified question is labelled "Not verified — hidden from students" and is never called a PYQ.

### 9. Supplementary Resources
- Header "SUPPLEMENTARY RESOURCES" with the note that these are not source evidence.
- Card: 16:9 thumbnail placeholder, title, channel, duration, topic relevance, [Watch ↗].
- Never shows the evidence icon or evidence styling.

### 10. Student Mode (separate, minimal)
- Full-screen, no teacher shell.
- Top: brand mark + pack title, and 5 tabs: **Learn · Practice · Watch · Revise · Resources**. The active tab has a 3px blue underline, 15px text.
- Content is approved versions only. No validation, provenance, versions, regeneration, drafts or teacher controls.
- If the pack isn't approved, an empty state explains that nothing is published yet.
- The quiz reveals answers after submission, following the answer reveal policy.

### 11. Dashboard, Create Pack, Sources, Generation Pipeline
- **Dashboard**: 5 stat cells (Total, Drafts, Awaiting approval, Approved, Validation issues), a Recent packs table (Pack, Subject, Topic, Source, Status, Updated, Validation), Recent activity, and the [+ Create Learning Pack] CTA. There is an empty-state variant.
- **Create Pack**: 4-step guided flow.
  1. Sources: upload cards showing filename, type, version, processing, page/slide count, extraction.
  2. Learning intent: topic, summary, objective cards (Objective 01…).
  3. Constraints: Subject, Level, Exam, Language, Difficulty, Vocabulary, Explanation length, Quiz count, Answer reveal policy.
  4. Review & [Generate Learning Pack]. A coverage gap is surfaced before generation.
- **Sources**: library table (Name, Type, Version, Uploaded, Processing, Evidence count, Used by packs) with Upload, View source, View extracted evidence and Upload new version.
- **Generation Pipeline**: 11 stages (Source Processing → Evidence Extraction → Objective Mapping → Grounding Check → Learning Content → Assessment → Quiz → Answer Key → Exam Focus → Video Script → Quality Validation). Each stage is pending, running, completed, warning or failed, with a live log. Modes: running, warning (coverage gap) and failed (retry stage).

## Interactions & behaviour (summary)
- **Regeneration is always scoped to one item** (section, assessment item, question or answer-key entry). There is no pack-wide regenerate. Each regeneration bumps that item's version, writes a VersionEvent and shows an "X unchanged" confirmation.
- **Dependencies**: when a quiz question changes, its answer-key entry becomes `regen` (stale). A source version update flags the items that depend on it.
- **Edits** bump the item version, show "Teacher edited" and re-run grounding and terminology checks for that item only (about 1.1s, running state).
- **Approval gating**:
  - An asset can be approved if it has no `fail`, `running` or `regen` items. `review` items are accepted explicitly.
  - The pack approves only when no check is `fail`.
  - Approval locks everything and disables controls.
- **Evidence** opens the drawer from any chip. Esc or a backdrop click closes it.
- **Toasts**: bottom-right ink box, 13px, auto-hide after about 3.8s. Copy is precise and past tense, e.g. "Question 3 → v2. The other 9 questions were not changed."
- **Transitions**: none required beyond instant state swaps. Keep motion minimal.
- **Focus**: 2px blue outline with 2px offset on `:focus-visible`. Disabled controls are at 45% opacity.

## State (per pack)
`screen`, `approved`, `approvedVersion`, `version`, `approvedAssets{}`, `sections{explanation[], assessment[]}`, `questions[]`, `selected{asset: itemId}`, `busy{asset:item}`, `editing`, `lastRegen`, `questionReview{id, prev}`, `gap{state: open|modifying|modified|continued}`, `videoState`, `events[]`, `evidenceOpen`, `toast`.
Validation checks are derived from content state; they are not stored separately. See `packChecks()`, `qChecks()` and `assetStatus()` in `source_dc/LessonFoundry v4.dc.html`, and port them as pure selectors.

Types and suggested endpoints: `data/types.ts`. Realistic Newton's Laws fixtures: `data/mock-data.reference.js`.

## Design tokens
Full list: `tokens/tokens.css`. Tailwind: `tokens/tailwind.theme.ts`. Base system: `tokens/modernist-base.css`.

| Role | Token | Hex | Use |
|---|---|---|---|
| Deep Ink | `--color-text` | #191f2b | text, nav, headers, rules |
| Canvas | `--color-bg` | #f3f2f2 | page ground |
| Surface | `--color-surface` | #eae9e9 | panels, selected rows |
| Foundry Blue | `--color-accent` | #2763ae | primary action, selection, links |
| Blue 600 / 700 | | #1b5296 / #154784 | hover / blue text |
| Blue 100 / 200 | | #eff6ff / #d9e9ff | info tint, evidence highlight |
| Verification Green | `--lf-green` | #267543 | pass |
| Green 700 / 100 | | #196632 / #dcf2df | approved fill, validated text / tint |
| Warm Amber | `--lf-amber` | #d49838 | review |
| Amber 700 / 100 | | #844b00 / #fde8c6 | review text / tint |
| Error Red | `--lf-red` | #cc3430 | failures only |
| Red 700 / 100 | | #9b1f1d / #ffe3df | fail text / tint |
| Divider | `--color-divider` | ink at 40% | 2px section rules |

Semantics: **Blue** = active/action, **Green** = validated/approved, **Amber** = review/pending, **Red** = failed/blocked, **Gray** = draft/inactive. Colour is never the only signal: every status has its own icon and label.

- **Type**: Archivo only (Google Fonts, weights 400/500/600/700/800).

  | Style | Spec |
  |---|---|
  | display | 34/1.05, 800, −0.02em |
  | title | 22/1.1, 800, −0.015em |
  | heading | 18–19/1.2, 800, −0.01em |
  | body | 16/1.7, 400 |
  | UI | 13–14 |
  | label | 11, 700, +0.08em, uppercase |
  | micro | 10, 700, +0.12–0.16em |
  | quote/evidence | Georgia 13–15/1.55 |
  | prototype-only | monospace |

- **Radius**: 0 everywhere.
- **Borders**: 2px `--color-divider` for major sections, 1px `neutral-300` inside.
- **Shadows**: only `--shadow-lg` on the drawer and toasts.
- **Spacing**: 4px base. Common values are 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 36 and 40.
- **Buttons**: labels flush left (`justify-content: flex-start`), 8px gap to the icon.

## Brand & assets
- **Logo** (`assets/logo/`): a closed square frame (the mould) holds a small source unit (top-left) and a stepped blue mass rising lower-left to upper-right (the cast content). Built on an 8-unit grid. Never open, round or rotate it.
  - Wordmark: "Lesson" in Archivo 500 + "Foundry" in Archivo 800, −2.5% tracking, one word.
  - Variants: colour, ink (mono), inverse (dark ground) and white. Lockup SVGs use live Archivo text; outline the text before use in print.
- **Favicon** (`assets/favicon/`): mark on a solid tile, with the frame dropped. Dark and light variants as SVG and PNG at 16, 32, 64, 180 (apple-touch) and 512.
- **Icons** (`assets/icons/*.svg`, `components/LFIcon.tsx`):
  - Custom set of 37: 24px grid, 1.75 stroke (2.1 at ≤12px, 1.5 at ≥32px), square caps, mitred joins, `currentColor`. Use these instead of Lucide for all product concepts.
  - Signature icons: **evidence** (page + highlighted passage traced to a node), **validation** (frame + breakout check), **approval** (check inside lock body; never merged with validation), **version** (3 stacked frames), **generate** (outline unit stepped into a solid one; no sparkles).
- **Status chips** (`StatusBadge`): pass, review, fail, info, pending, draft, approved (solid green + lock), locked (ink + lock), regen, running, queued, ready, edited. Each has a chip and an 18px glyph variant.
- **Imagery**: none in the product. Resource thumbnails and the video player are placeholders; use real thumbnails from the YouTube API and the HeyGen player later.

## Voice
Precise, calm, teacher-respectful. Write "Ready for review", "Evidence coverage: 92%", "Approved by teacher", "Regenerate Q3". Not "Your awesome lesson is ready!", "AI confidence", "AI-approved" or "✨ Make it better".

## Suggested component map (Next.js)
`AppShell`, `Sidebar`, `Topbar`, `PackHeader`, `WorkflowStrip`, `PackNavigation`, `AssetEditor`, `ContentItemCard`, `EvidenceChip`, `EvidenceDrawer`, `TrustPanel`, `ValidationChecklist`, `ProvenanceCard`, `QuestionStrip`, `QuestionCard`, `RegenerationFlow`, `CoverageGapCard`, `ValidationScorecard`, `ValidationTable`, `VersionTimeline`, `ApprovalPanel`, `VideoPipeline`, `VideoScriptEditor`, `VideoPlayer`, `ExamFocus`, `PYQTable`, `ResourceCard`, `StudentPackView`, `SourceCard`, `ObjectiveCard`, `ConstraintForm`, `GenerationPipeline`, `StatusBadge`, `LFIcon`, `LFLogo`, plus a `DemoControls` component shown only in dev/demo builds.

## Files
```
prototype/LessonFoundry Prototype v4.html   full app, offline, clickable
prototype/LessonFoundry Brand System.html   brand guide, offline
source_dc/                                  readable source of every screen (+ support.js to run them)
tokens/tokens.css · tailwind.theme.ts · modernist-base.css
components/LFIcon.tsx                       React icon component (typed names)
assets/icons/  assets/logo/  assets/favicon/
data/types.ts · mock-data.reference.js
```
