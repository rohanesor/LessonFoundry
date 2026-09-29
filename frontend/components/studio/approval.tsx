"use client";
import { useEffect, useState } from "react";
import { ApprovalIcon } from "@/components/icons/brand";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Asset, Pack } from "@/types";
import { Status } from "@/components/ui/status";
export function Approval({
  target,
  pack,
  onClose,
  onConfirm,
  busy,
}: {
  target: Asset | "pack" | null;
  pack?: Pack;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
  busy: boolean;
}) {
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => { setChecked(false); setNote(""); }, [target, pack?.revision]);
  const assets = target === "pack" ? pack?.assets || [] : target ? [target] : [];
  const checks = assets.flatMap(a => a.checks);
  const warnings = checks.filter(c => c.state === "WARNING" || c.state === "NEEDS_REVIEW").length;
  const blocked = !assets.length || assets.some(a => a.stale || !a.checks.length) || checks.some(c => c.state === "FAIL");
  return (
    <Panel
      open={!!target}
      onClose={onClose}
      title="Teacher approval"
      description={
        target === "pack"
          ? "Approve the current learning pack."
          : target
            ? `${target.payload.title} · v${target.version}`
            : ""
      }
    >
      <div className="stack">
        <div className="row" style={{ marginBottom: 4 }}>
          <ApprovalIcon size={18} />
          <span className="kicker">Teacher authorization required</span>
        </div>
        <div className="notice">
          Approval locks exact versions. Publishing to a classroom is a separate action. All failing
          checks must be resolved. Semantic checks marked “Needs review” are
          your responsibility.
        </div>
        <div className="stack" aria-label="Readiness checklist">
          <Status state={assets.length ? "PASS" : "FAIL"} label={`${assets.length} current assets available`} />
          <Status state={assets.length && assets.every(a => a.payload.evidence_ids.length > 0) ? "PASS" : "WARNING"} label="Evidence links — review source support" />
          {target === "pack" && pack && <Status state={pack.objectives.length && pack.objectives.every(o => assets.some(a => a.objective_id === o.id)) ? "PASS" : "WARNING"} label="Objective coverage — review alignment" />}
          <Status state={blocked ? "FAIL" : "PASS"} label={blocked ? "Blocking or incomplete checks require review" : "No blocking checks; assets current"} />
          <Status state={checked ? "PASS" : "WARNING"} label={`${warnings} warnings ${checked ? "acknowledged" : "to review"}`} />
        </div>
        <label className="row">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          I reviewed source support, factual correctness, answers, difficulty
          and warnings.
        </label>
        <label>
          Review note
          <textarea
            className="input"
            minLength={10}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Record what you verified and any accepted limitations."
          />
        </label>
        <div className="row">
          <Button
            variant="default"
            disabled={blocked || !checked || note.trim().length < 10 || busy}
            onClick={async () => {
              await onConfirm(note);
              setChecked(false);
              setNote("");
            }}
          >
            {busy ? "Approving…" : "Approve version"}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Panel>
  );
}
