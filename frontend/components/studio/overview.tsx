"use client";
import { ObjectiveEditor } from "./objective-editor";
import { useState } from "react";
import { PublishModal } from "./publish-modal";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowIcon, PassIcon, PlayIcon } from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { post } from "@/lib/api";
import type { Pack, Screen } from "@/types";

export function Overview({
  pack,
  run,
  navigate,
}: {
  pack: Pack;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
  navigate: (s: Screen) => void;
}) {
  const qc = useQueryClient();
  const [publishing, setPublishing] = useState(false);
  const busy = pack.jobs.some((j) => ["Queued", "Running"].includes(j.state));
  const allApproved =
    pack.assets.length > 0 &&
    pack.assets.every((a) => a.state === "APPROVED" && !a.stale);
  const supportedCount = pack.objectives.filter(
    (o) => o.status === "SUPPORTED",
  ).length;

  const workflowSteps = [
    {
      num: 1,
      title: "Add sources",
      body: "Upload or connect the materials used to create the lesson.",
      done: pack.sources.length > 0,
      action: () => navigate("Sources"),
      actionLabel: "Add sources",
      disabled: false,
    },
    {
      num: 2,
      title: "Validate objective coverage",
      body: "Check whether the available evidence supports the learning objectives.",
      done: supportedCount > 0,
      action: () => run(() => post(`/packs/${pack.id}/gap-check`), "Evidence mapping queued"),
      actionLabel: "Check objective support",
      disabled: busy || !pack.sources.length,
      disabledReason: "Add sources first",
    },
    {
      num: 3,
      title: "Generate content",
      body: "Generate the learning pack after the required prerequisites are satisfied.",
      done: pack.assets.length > 0,
      action: () => run(() => post(`/packs/${pack.id}/generate`), "Generation queued"),
      actionLabel: "Generate learning pack",
      disabled:
        busy ||
        !!pack.assets.length ||
        !pack.objectives.some((o) => o.status === "SUPPORTED"),
      disabledReason: "Validate objective support first",
      primary: true,
    },
  ];

  return (
    <div className="page stack" style={{ gap: "var(--space-7)" }}>
      <section>
        <div className="kicker">Learning pack overview</div>
        <h2 style={{ margin: "0 0 var(--space-1)" }}>
          Track content readiness, objective coverage, and review progress.
        </h2>
        <p className="muted">
          Review evidence links and validation results before publishing to
          students.
        </p>
      </section>

      <section className="stats">
        {[
          ["Sources", pack.sources.length],
          ["Evidence units", pack.evidence.length],
          ["Objectives supported", `${supportedCount}/${pack.objectives.length}`],
          [
            "Approved assets",
            `${pack.assets.filter((a) => a.state === "APPROVED" && !a.stale).length}/${pack.assets.length}`,
          ],
        ].map(([l, v]) => (
          <div className="stat" key={l}>
            <small>{l}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </section>

      <section className="card" style={{ gap: "var(--space-4)" }}>
        <div>
          <h3 style={{ margin: "0 0 var(--space-1)" }}>Build your learning pack</h3>
          <p className="muted" style={{ margin: 0 }}>
            Complete each step to move from source material to a reviewed
            learning pack.
          </p>
        </div>
        <div
          className="stack"
          style={{ gap: 0, border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}
        >
          {workflowSteps.map((step, idx) => {
            const nextUp =
              !step.done &&
              workflowSteps.slice(0, idx).every((s) => s.done) &&
              !busy;
            return (
              <div
                key={step.num}
                className="row"
                style={{
                  gap: "var(--space-4)",
                  alignItems: "flex-start",
                  padding: "var(--space-4) var(--space-5)",
                  borderBottom:
                    idx < workflowSteps.length - 1
                      ? "1px solid var(--color-border)"
                      : 0,
                  background: step.done ? "var(--color-neutral-50)" : "var(--color-surface)",
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: "var(--radius-full)",
                    display: "grid",
                    placeItems: "center",
                    background: step.done ? "var(--lf-green)" : nextUp ? "var(--color-accent)" : "var(--color-neutral-200)",
                    color: step.done || nextUp ? "#fff" : "var(--color-text-secondary)",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {step.done ? "✓" : step.num}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 2px", fontSize: 15 }}>{step.title}</h4>
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    {step.body}
                  </p>
                  {step.disabled && step.disabledReason && (
                    <p style={{ fontSize: 12, color: "var(--lf-amber)", margin: "var(--space-1) 0 0" }}>
                      {step.disabledReason}
                    </p>
                  )}
                </div>
                <div style={{ flexShrink: 0 }}>
                  <Button
                    variant={step.primary && nextUp ? "default" : "secondary"}
                    disabled={step.disabled}
                    onClick={step.action}
                  >
                    {step.done ? "Edit" : step.actionLabel}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="row spread" style={{ alignItems: "center", marginBottom: "var(--space-4)" }}>
          <h3 style={{ margin: 0 }}>Objective alignment</h3>
          {pack.objectives.length === 0 && (
            <span className="muted" style={{ fontSize: 13 }}>
              No objectives defined.
            </span>
          )}
        </div>
        {pack.objectives.length === 0 ? (
          <div className="empty">
            <p>Add learning objectives to see alignment across sources and generated content.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Learning objective</th>
                  <th>Evidence</th>
                  <th>Explanation</th>
                  <th>Quiz</th>
                  <th>Assessment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pack.objectives.map((o) => {
                  const mapped = pack.assets.filter((a) => a.objective_id === o.id);
                  return (
                    <tr key={o.id}>
                      <td>
                        <small style={{ color: "var(--color-text-secondary)" }}>
                          OBJ-{String(o.position).padStart(2, "0")}
                        </small>
                        <br />
                        <b>{o.description}</b>
                        <p
                          className="muted"
                          style={{ fontSize: 12, marginTop: 4 }}
                        >
                          {o.reason}
                        </p>
                        <ObjectiveEditor
                          objective={o}
                          onSaved={() => {
                            void qc.invalidateQueries({
                              queryKey: ["pack", pack.id],
                            });
                          }}
                        />
                      </td>
                      <td>{o.evidence_ids.length} links</td>
                      {["explanation", "quiz", "assessment"].map((k) => (
                        <td key={k}>
                          {mapped.some((a) => a.slot.startsWith(k)) ? (
                            <PassIcon size={16} aria-label="Covered" />
                          ) : (
                            <span className="muted">Gap</span>
                          )}
                        </td>
                      ))}
                      <td>
                        <Status state={o.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pack.assets.length > 0 && (
        <section className="row" style={{ gap: "var(--space-3)" }}>
          <Button onClick={() => navigate("Explanation")}>
            Open lesson content <ArrowIcon size={14} />
          </Button>
          <Button onClick={() => navigate("Quiz")}>Review quiz</Button>
          <Button onClick={() => navigate("Validation")}>Quality report</Button>
          {allApproved && pack.classroom_id && !pack.published_at && (
            <Button
              variant="default"
              disabled={busy}
              onClick={() => setPublishing(true)}
            >
              Publish to classroom
            </Button>
          )}
          {pack.published_at && (
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await post<{ download_url: string }>(
                    `/packs/${pack.id}/download`,
                  );
                  window.open(result.download_url, "_blank", "noopener,noreferrer");
                }, "PDF download opened")
              }
            >
              Download PDF
            </Button>
          )}
        </section>
      )}

      <PublishModal
        pack={pack}
        open={publishing}
        onClose={() => setPublishing(false)}
        onPublished={() => {
          void qc.invalidateQueries({ queryKey: ["pack", pack.id] });
          void qc.invalidateQueries({
            queryKey: ["classroom-packs", pack.classroom_id],
          });
        }}
      />

      <div className="notice">
        <strong>Development provider:</strong> content uses mock or authored demo
        fixtures, not live AI. Evidence links and model judgments require
        teacher review.
      </div>
    </div>
  );
}
