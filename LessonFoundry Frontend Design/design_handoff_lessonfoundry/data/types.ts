// Domain model implied by the prototype. Suggested FastAPI response shapes.
export type CheckStatus = "pass" | "review" | "fail";
export type AssetStatus = CheckStatus | "approved" | "locked" | "regen" | "running" | "queued" | "ready" | "pending" | "draft" | "edited" | "info";
export type AssetKind = "explanation" | "assessment" | "quiz" | "answerKey" | "aiTeacher" | "examFocus" | "resources";

export interface Source { id: string; name: string; type: "PDF" | "PPTX" | "DOCX" | "TXT" | "MD"; version: string; pageCount?: number; slideCount?: number;
  processing: "queued" | "processing" | "ready" | "failed"; extraction: "pending" | "complete" | "partial" | "failed"; evidenceCount: number; usedByPacks: string[]; uploadedAt: string; }
export interface Evidence { id: string; sourceId: string; sourceVersion: string; location: string; section: string; span: string; text: string;
  objectiveId?: string; relevance?: number; usedBy: string[]; extractedAt: string; note?: string; }
export interface Objective { id: string; n: string; text: string; short: string; coverage: "supported" | "gap" | "gap_continued"; bestMatch?: { evidenceId: string; relevance: number }; }
export interface ContentItem { id: string; n: number; title: string; objectiveId: string; evidenceIds: string[]; status: AssetStatus; version: number;
  text: string; extra?: { label: string; text: string }; note?: string; edited?: boolean; history: string; }
export interface QuizQuestion { id: string; n: number; objectiveId: string; difficulty: "Easy" | "Medium" | "Hard"; evidenceId: string; text: string; options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3; solverAnswer: 0 | 1 | 2 | 3; similarity: number; duplicateOf?: string; difficultyNote?: string; version: number;
  keyForVersion: number; keyVersion: number; solution: string; history: { v: number; what: string; t: string }[]; }
export interface ValidationCheck { key: "schema" | "evidence" | "coverage" | "validity" | "key" | "difficulty" | "duplicate" | "terminology" | "leakage";
  name: string; status: CheckStatus; reason: string; evidenceId?: string; evidenceLabel: string; affectedAsset: string; suggestedAction: string; actionTarget?: string; }
export interface VersionEvent { id: string; version: number; kind: "ai" | "teacher" | "source" | "approved"; title: string; detail: string; scope: string; time: string; by: string; before?: string; after?: string; pack?: boolean; }
export type VideoState = "none" | "queued" | "rendering" | "done" | "failed";
export interface LearningPack { id: string; title: string; subject: string; level: string; exam: string; language: string; difficulty: string; vocabulary: string;
  version: number; status: "draft" | "approved"; approvedVersion?: number; approvedBy?: string; approvedAt?: string;
  sources: Source[]; objectives: Objective[]; assets: Record<AssetKind, { version: string; status: AssetStatus; approved: boolean }>; }

// Suggested endpoints (all return the shapes above)
// GET  /packs/:id                          → LearningPack
// GET  /packs/:id/assets/:kind             → ContentItem[] | QuizQuestion[]
// POST /packs/:id/assets/:kind/items/:item/regenerate  { keepObjective, keepDifficulty, avoidOverlap, instruction } → item (version+1) + VersionEvent
// POST /packs/:id/assets/:kind/items/:item/revert      → item
// PATCH /packs/:id/assets/:kind/items/:item            { text } → item (revalidated)
// GET  /packs/:id/validation               → ValidationCheck[]
// POST /packs/:id/validation/run           → ValidationCheck[]
// GET  /evidence/:id                       → Evidence (+ page render URL)
// GET  /packs/:id/versions                 → VersionEvent[]
// POST /packs/:id/approve                  → LearningPack (status approved, locked)
// POST /packs/:id/versions                 → new draft from approved
// POST /packs/:id/video/render             → { state: "queued" } then poll GET /packs/:id/video
// GET  /student/packs/:id                  → approved-version content only
