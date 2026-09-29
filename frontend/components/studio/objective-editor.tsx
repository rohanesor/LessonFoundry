"use client";
import { useState } from "react";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Objective } from "@/types";
export function ObjectiveEditor({
  objective,
  onSaved,
}: {
  objective: Objective;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Revise objective
      </Button>
      <Panel
        open={open}
        onClose={() => setOpen(false)}
        title={`Revise OBJ-${objective.position}`}
        description="A changed learning contract marks generated assets stale. Historical versions remain available."
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await api(`/objectives/${objective.id}`, {
                method: "PATCH",
                body: JSON.stringify({ description: f.get("description") }),
              });
              onSaved();
              setOpen(false);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Objective description
            <textarea
              className="input"
              name="description"
              defaultValue={objective.description}
              minLength={5}
              required
            />
          </label>
          {error && <div className="alert">{error}</div>}
          <Button variant="default" disabled={busy}>
            Save revised objective
          </Button>
        </form>
      </Panel>
    </>
  );
}
