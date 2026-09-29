"use client";
import { useState } from "react";
import {
  ApprovalIcon,
  RegenerateIcon,
  SaveIcon,
  ValidationIcon,
  EvidenceIcon,
} from "@/components/icons/brand";
import { FlowchartViewer } from "./flowchart";
import { api, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Status, Empty } from "@/components/ui/status";
import type { Asset, Pack, Payload, Evidence } from "@/types";
export function AssetEditor({
  pack,
  assets,
  title,
  quiz = false,
  run,
  onApprove,
  onEvidence,
}: {
  pack: Pack;
  assets: Asset[];
  title: string;
  quiz?: boolean;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
  onApprove: (a: Asset) => void;
  onEvidence: (e: Evidence) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Payload | null>(null);
  const [trust, setTrust] = useState(false);
  const asset = assets[Math.min(selected, Math.max(0, assets.length - 1))];
  if (!asset)
    return (
      <div className="page">
        <Empty title={`No ${title.toLowerCase()} yet`}>
          Add sources, check objective support, then generate the learning pack
          from Overview.
        </Empty>
      </div>
    );
  const shown = quiz ? [asset] : assets;
  const locked = asset.state === "APPROVED";
  return (
    <div className="studio-grid">
      <section className="editor-column">
        <div className="editor-heading stack">
          <div className="kicker">
            Learning Pack · {quiz ? "Assessment assets" : "Teaching assets"}
          </div>
          <div className="row spread">
            <h2>{title}</h2>
            <Button
              onClick={() => onApprove(asset)}
              disabled={locked || asset.stale}
            >
              {locked ? (
                <>
                  <ApprovalIcon size={14} />
                  Approved
                </>
              ) : (
                "Review & approve"
              )}
            </Button>
          </div>
          <div className="meta">
            <span>
              {assets.length} {quiz ? "questions" : "assets"}
            </span>
            <span>
              Version <b>v{asset.version}</b>
            </span>
            <Status state={asset.state} />
          </div>
          <Button className="trust-toggle" onClick={() => setTrust(!trust)}>
            <ValidationIcon size={14} />
            Validation details
          </Button>
        </div>
        {quiz && (
          <div className="quiz-tabs" role="tablist" aria-label="Quiz questions">
            {assets.map((a, i) => (
              <button
                role="tab"
                aria-selected={i === selected}
                className={`quiz-tab ${i === selected ? "active" : ""}`}
                key={a.id}
                onClick={() => {
                  setSelected(i);
                  setEditing(false);
                }}
              >
                Q{i + 1} <small>v{a.version}</small>
              </button>
            ))}
          </div>
        )}
        {shown.map((a) => {
          const isEditing = editing && asset.id === a.id;
          const p = isEditing && draft ? draft : a.payload;
          const obj = pack.objectives.find((o) => o.id === a.objective_id);
          return (
            <article
              className="asset-card"
              key={a.id}
              onFocus={() => {
                if (!quiz && asset.id !== a.id) {
                  setSelected(assets.indexOf(a));
                  setEditing(false);
                }
              }}
            >
              <div className="row spread">
                <h3>{p.title}</h3>
                <Status state={a.state} />
              </div>
              <div className="meta" style={{ marginBottom: 16 }}>
                <span>
                  OBJ-{obj?.position} · {obj?.description}
                </span>
                <b>v{a.version}</b>
              </div>
              {a.stale && (
                <div className="alert">
                  Stale source dependency. Recheck objectives, then regenerate
                  before approval.
                </div>
              )}
              {a.state === "APPROVED" && (
                <div className="banner good">
                  <ApprovalIcon size={13} style={{ display: "inline" }} /> Approved v
                  {a.version} · locked ·{" "}
                  {a.approval && new Date(a.approval.at).toLocaleString()}
                </div>
              )}
              {isEditing ? (
                <div className="stack">
                  <label>
                    Title
                    <input
                      className="input"
                      value={p.title}
                      onChange={(e) =>
                        setDraft({ ...p, title: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {quiz ? "Question" : "Content"}
                    <textarea
                      className="input"
                      value={p.body}
                      onChange={(e) => setDraft({ ...p, body: e.target.value })}
                      style={{ minHeight: 220 }}
                    />
                  </label>
                  {p.options.map((o, i) => (
                    <label key={i}>
                      Option {String.fromCharCode(65 + i)}
                      <input
                        className="input"
                        value={o}
                        onChange={(e) =>
                          setDraft({
                            ...p,
                            options: p.options.map((x, j) =>
                              j === i ? e.target.value : x,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                  {quiz && (
                    <label>
                      Correct answer
                      <select
                        className="input"
                        value={p.answer ?? 0}
                        onChange={(e) =>
                          setDraft({ ...p, answer: Number(e.target.value) })
                        }
                      >
                        {p.options.map((_, i) => (
                          <option key={i} value={i}>
                            {String.fromCharCode(65 + i)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Teacher-only solution
                    <textarea
                      className="input"
                      value={p.solution}
                      onChange={(e) =>
                        setDraft({ ...p, solution: e.target.value })
                      }
                    />
                  </label>
                  <div className="fields">
                    <label>
                      Difficulty override
                      <select
                        className="input"
                        value={p.difficulty}
                        onChange={(e) =>
                          setDraft({
                            ...p,
                            difficulty: e.target.value as Payload["difficulty"],
                          })
                        }
                      >
                        {["Easy", "Medium", "Advanced"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Bloom classification
                      <select
                        className="input"
                        value={p.bloom}
                        onChange={(e) =>
                          setDraft({
                            ...p,
                            bloom: e.target.value as Payload["bloom"],
                          })
                        }
                      >
                        {[
                          "Remember",
                          "Understand",
                          "Apply",
                          "Analyze",
                          "Evaluate",
                          "Create",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="row">
                    <Button
                      variant="default"
                      onClick={async () => {
                        await run(
                          () =>
                            api(`/assets/${a.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                expected_version: a.version,
                                payload: p,
                              }),
                            }),
                          "New version saved; validation rerun",
                        );
                        setEditing(false);
                      }}
                    >
                      <SaveIcon size={14} />
                      Save new version
                    </Button>
                    <Button onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="prose">{p.body}</p>
                  {p.flowchart && (
                    <FlowchartViewer data={p.flowchart} />
                  )}
                  {p.options.map((o, i) => (
                    <div
                      className={`option ${p.answer === i ? "correct" : ""}`}
                      key={i}
                    >
                      <span className="option-letter">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{o}</span>
                      {p.answer === i && (
                        <small style={{ marginLeft: "auto" }}>KEY</small>
                      )}
                    </div>
                  ))}
                  {p.solution && (
                    <details style={{ marginTop: 16 }}>
                      <summary>Teacher-only answer / explanation</summary>
                      <p className="prose">{p.solution}</p>
                    </details>
                  )}
                  <div className="meta" style={{ marginTop: 16 }}>
                    <span>
                      {p.difficulty} · {p.bloom}
                    </span>
                    <span>{a.model}</span>
                  </div>
                </>
              )}
              <div className="asset-footer">
                {p.evidence_ids.map((id) => {
                  const ev = pack.evidence.find((e) => e.id === id);
                  return ev ? (
                    <button
                      key={id}
                      className="evidence-chip"
                      onClick={() => onEvidence(ev)}
                    >
                      <EvidenceIcon size={12} />
                      <b>E{pack.evidence.indexOf(ev) + 1}</b>
                      <span>{ev.location}</span>
                    </button>
                  ) : (
                    <Button
                      key={id}
                      variant="ghost"
                      onClick={() =>
                        run(async () => {
                          const evidence = await api<Evidence[]>(
                            `/assets/${a.id}/evidence`,
                          );
                          const historical = evidence.find((e) => e.id === id);
                          if (historical) onEvidence(historical);
                        }, "Historical source evidence opened")
                      }
                    >
                      View historical evidence
                    </Button>
                  );
                })}
                <span style={{ flex: 1 }} />
                {a.state === "APPROVED" ? (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      run(
                        () => post(`/assets/${a.id}/draft`),
                        "New draft created; published version preserved",
                      )
                    }
                  >
                    Create new draft
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelected(assets.indexOf(a));
                        setDraft(a.payload);
                        setEditing(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        run(
                          () => post(`/assets/${a.id}/regenerate`),
                          "Single-asset regeneration queued",
                        )
                      }
                    >
                      <RegenerateIcon size={12} />
                      Regenerate{quiz ? " question" : ""}
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelected(assets.indexOf(a));
                    setTrust(true);
                  }}
                >
                  View validation
                </Button>
              </div>
            </article>
          );
        })}
      </section>
      <aside
        className={`trust ${trust ? "visible" : ""}`}
        aria-label="Validation and provenance"
      >
        <div className="trust-heading">
          Validation · {asset.checks.filter((c) => c.state === "PASS").length}/
          {asset.checks.length} passed
        </div>
        {asset.checks.map((c) => (
          <div className="check-row" key={c.name}>
            <div className="row spread">
              <b>{c.name}</b>
              <Status state={c.state} />
            </div>
            <p>{c.detail}</p>
          </div>
        ))}
        <div className="trust-heading">Selected · v{asset.version}</div>
        <div className="check-row">
          <b>Provenance</b>
          <details>
            <summary>Generation contract & settings</summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                fontSize: 11,
              }}
            >
              {JSON.stringify(asset.settings, null, 2)}
            </pre>
          </details>
          <p>Model: {asset.model}</p>
          <p>Generated: {new Date(asset.created_at).toLocaleString()}</p>
          <p>Change: {asset.change_type}</p>
          <p>
            Objective:{" "}
            {
              pack.objectives.find((o) => o.id === asset.objective_id)
                ?.description
            }
          </p>
        </div>
      </aside>
    </div>
  );
}
