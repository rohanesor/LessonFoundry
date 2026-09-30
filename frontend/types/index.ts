export type CheckState = "PASS" | "WARNING" | "FAIL" | "NEEDS_REVIEW";
export interface Check {
  name: string;
  state: CheckState;
  detail: string;
}
export interface Evidence {
  id: string;
  text: string;
  location: string;
  source_id: string;
  source_name: string;
  source_version: number;
  source_version_id: string;
  hash: string;
  created_at: string;
}
export interface Objective {
  id: string;
  description: string;
  position: number;
  status: string;
  reason: string;
  evidence_ids: string[];
}
export interface FlowNode {
  id: string;
  label: string;
  type: "concept" | "fact" | "process" | "decision";
}

export interface FlowEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface Flowchart {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface Payload {
  title: string;
  body: string;
  options: string[];
  answer: number | null;
  solution: string;
  difficulty: "Easy" | "Medium" | "Advanced";
  bloom:
    "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";
  evidence_ids: string[];
  claims: string[];
  flowchart?: Flowchart;
}
export interface Asset {
  id: string;
  slot: string;
  version_id: string;
  version: number;
  objective_id: string;
  payload: Payload;
  state: string;
  stale: boolean;
  model: string;
  settings: Record<string, unknown>;
  created_at: string;
  change_type: string;
  checks: Check[];
  approval: { by: string; at: string; note: string } | null;
}
export interface Job {
  id: string;
  kind: string;
  state: string;
  message: string;
}
export interface Video {
  id: string;
  script_version_id: string;
  state: string;
  provider: string;
  url: string | null;
  teacher_video_id?: string | null;
  approved?: boolean;
  published?: boolean;
}
export interface Pack {
  id: string;
  title: string;
  subject: string;
  level: string;
  exam: string;
  summary: string;
  revision: number;
  source_revision: number;
  published_at?: string | null;
  classroom_id?: string | null;
  share_token: string;
  constraints: Record<string, unknown>;
  objectives: Objective[];
  evidence: Evidence[];
  sources: {
    id: string;
    name: string;
    version: number;
    has_original: boolean;
  }[];
  assets: Asset[];
  jobs: Job[];
  videos: Video[];
}
export interface PackSummary {
  id: string;
  title: string;
  subject: string;
  level: string;
  exam: string;
  revision: number;
  created_at: string;
}
export interface TimelineEntry {
  id: string;
  revision: number;
  title: string;
  detail: string;
  created_at: string;
}
export interface Resource {
  id: string;
  title: string;
  channel: string;
  url: string;
  approved: boolean;
}
export interface StudentAsset {
  id: string;
  slot: string;
  title: string;
  body: string;
  options: string[];
  flowchart?: Flowchart;
}
export interface StudentPack {
  title: string;
  subject: string;
  level: string;
  assets: StudentAsset[];
  resources: { title: string; url: string }[];
}
export type Screen =
  | "Dashboard"
  | "Learning Packs"
  | "Sources"
  | "Overview"
  | "Explanation"
  | "Assessment"
  | "Quiz"
  | "Answer Key"
  | "AI Teacher"
  | "Exam Focus"
  | "Resources"
  | "Versions"
  | "Validation"
  | "Settings";
