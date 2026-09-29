"use client";
import { ObjectiveEditor } from "./objective-editor";
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
  const busy = pack.jobs.some((j) => ["Queued", "Running"].includes(j.state));
  const allApproved = pack.assets.length > 0 && pack.assets.every((a) => a.state === "APPROVED" && !a.stale);
  return (
    <div className="page stack">
      <div>
        <div className="kicker">Pack overview</div>
        <h1>From source to student.</h1>
        <p className="muted">
          Each step strengthens the connection between what you teach and what
          students learn.
        </p>
      </div>
      <div className="row">
        <Button onClick={() => navigate("Sources")}>1. Add sources</Button>
        <Button
          disabled={busy || !pack.sources.length}
          onClick={() =>
            run(
              () => post(`/packs/${pack.id}/gap-check`),
              "Evidence mapping queued",
            )
          }
        >
          2. Check objective support
        </Button>
        <Button
          variant="default"
          disabled={
            busy ||
            !!pack.assets.length ||
            !pack.objectives.some((o) => o.status === "SUPPORTED")
          }
          onClick={() =>
            run(() => post(`/packs/${pack.id}/generate`), "Generation queued")
          }
        >
          <PlayIcon size={14} />
          3. Generate learning pack
        </Button>
      </div>
      <div className="stats" style={{ margin: "8px 0" }}>
        {[
          ["Sources", pack.sources.length],
          ["Evidence units", pack.evidence.length],
          [
            "Objectives supported",
            `${pack.objectives.filter((o) => o.status === "SUPPORTED").length}/${pack.objectives.length}`,
          ],
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
      </div>
      <h4>Objective alignment</h4>
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
                    <small>OBJ-{String(o.position).padStart(2, "0")}</small>
                    <br />
                    <b>{o.description}</b>
                    <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
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
                        "Gap"
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
      {pack.assets.length > 0 && (
        <div className="row">
          <Button onClick={() => navigate("Explanation")}>
            Open studio <ArrowIcon size={14} />
          </Button>
          <Button onClick={() => navigate("Quiz")}>Review quiz</Button>
          <Button onClick={() => navigate("Validation")}>Quality report</Button>
          {allApproved && pack.classroom_id && !pack.published_at && (
            <Button
              variant="default"
              disabled={busy}
              onClick={() => run(() => post(`/packs/${pack.id}/publish`), "Published to classroom; PDF export queued")}
            >
              Publish to classroom
            </Button>
          )}
          {pack.published_at && (
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await post<{ download_url: string }>(`/packs/${pack.id}/download`);
                  window.open(result.download_url, "_blank", "noopener,noreferrer");
                }, "PDF download opened")
              }
            >
              Download PDF
            </Button>
          )}
        </div>
      )}
      <div className="notice">
        Unsupported objectives are excluded from generation. Lexical or model
        support judgments must still be reviewed; evidence links alone do not
        establish correctness.
      </div>
    </div>
  );
}
