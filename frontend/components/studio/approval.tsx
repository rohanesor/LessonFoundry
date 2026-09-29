"use client";
import { useState } from "react";
import { ApprovalIcon } from "@/components/icons/brand";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Asset } from "@/types";
export function Approval({
  target,
  onClose,
  onConfirm,
  busy,
}: {
  target: Asset | "pack" | null;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
  busy: boolean;
}) {
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState("");
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
          Approval publishes exact versions and locks editing. All failing
          checks must be resolved. Semantic checks marked “Needs review” are
          your responsibility.
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
            disabled={!checked || note.trim().length < 10 || busy}
            onClick={async () => {
              await onConfirm(note);
              setChecked(false);
              setNote("");
            }}
          >
            {busy ? "Approving…" : "Approve & publish"}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Panel>
  );
}
