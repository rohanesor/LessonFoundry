import { EvidenceIcon } from "@/components/icons/brand";
import { Panel } from "@/components/ui/dialog";
import type { Evidence, Pack } from "@/types";
export function EvidenceDrawer({
  evidence,
  pack,
  onClose,
}: {
  evidence: Evidence | null;
  pack: Pack;
  onClose: () => void;
}) {
  if (!evidence) return null;
  const used = pack.assets.filter((a) =>
    a.payload.evidence_ids.includes(evidence.id),
  );
  return (
    <Panel
      open
      onClose={onClose}
      drawer
      title={`Evidence · ${evidence.id.slice(0, 8)}`}
      description="Source passage and downstream dependencies"
    >
      <div className="row" style={{ marginBottom: 16 }}>
        <EvidenceIcon size={18} />
        <span className="kicker">Source-bound evidence</span>
      </div>
      <div className="detail-grid">
        <div>
          <small>Source</small>
          <b>{evidence.source_name}</b>
        </div>
        <div>
          <small>Location</small>
          <b>{evidence.location}</b>
        </div>
        <div>
          <small>Source version</small>
          <b>v{evidence.source_version}</b>
        </div>
        <div>
          <small>Extracted</small>
          {new Date(evidence.created_at).toLocaleString()}
        </div>
      </div>
      <div className="source-page">
        <div className="source-paper">
          <small>
            {evidence.source_name} / {evidence.location}
          </small>
          <blockquote>{evidence.text}</blockquote>
        </div>
      </div>
      <div className="stack">
        <div>
          <h5>Objectives supported</h5>
          {pack.objectives
            .filter((o) => o.evidence_ids.includes(evidence.id))
            .map((o) => (
              <p key={o.id}>
                OBJ-{String(o.position).padStart(2, "0")} · {o.description}
              </p>
            ))}
        </div>
        <div>
          <h5>Assets using this evidence</h5>
          {used.map((a) => (
            <div className="row" key={a.id}>
              <b>{a.payload.title}</b>
              <small>
                v{a.version} · {a.state}
              </small>
            </div>
          ))}
        </div>
        <div>
          <h5>Linked claims</h5>
          {used
            .flatMap((a) => a.payload.claims)
            .map((c, i) => (
              <p key={i} className="muted">
                {c}
              </p>
            ))}
        </div>
        <small>
          SHA-256:{" "}
          <span style={{ overflowWrap: "anywhere" }}>{evidence.hash}</span>
        </small>
        <div className="notice">
          Evidence linkage establishes traceability, not proof of factual
          entailment. Review the passage and claim together.
        </div>
      </div>
    </Panel>
  );
}
