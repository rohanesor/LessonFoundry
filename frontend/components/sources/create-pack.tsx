"use client";
import { useState } from "react";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/api";
export function CreatePack({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Panel
      open={open}
      onClose={onClose}
      title="Create learning pack"
      description="Define the learning intent. Sources are added in the next step."
    >
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const r = await post<{ id: string }>("/packs", {
              title: f.get("title"),
              subject: f.get("subject"),
              level: f.get("level"),
              exam: f.get("exam"),
              summary: f.get("summary"),
              objectives: String(f.get("objectives"))
                .split("\n")
                .filter((s) => s.trim()),
              constraints: {
                language: f.get("language"),
                max_words: Number(f.get("words")),
                answer_reveal: f.get("reveal") === "on",
              },
            });
            onCreated(r.id);
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="fields">
          <label className="full">
            Topic
            <input
              className="input"
              name="title"
              required
              minLength={3}
              placeholder="Newton's Laws of Motion"
            />
          </label>
          <label>
            Subject
            <input className="input" name="subject" defaultValue="Physics" />
          </label>
          <label>
            Target level
            <input className="input" name="level" defaultValue="Class 11" />
          </label>
          <label>
            Exam
            <input className="input" name="exam" defaultValue="CBSE / JEE" />
          </label>
          <label>
            Language
            <input className="input" name="language" defaultValue="English" />
          </label>
          <label className="full">
            Teacher summary
            <textarea
              className="input"
              name="summary"
              placeholder="What should this pack focus on?"
            />
          </label>
          <label className="full">
            Learning objectives — one per line, at least two
            <textarea
              className="input"
              name="objectives"
              required
              placeholder={
                "Explain Newton's three laws\nSolve force and acceleration problems"
              }
            />
          </label>
          <label>
            Maximum words per asset
            <input
              className="input"
              name="words"
              type="number"
              defaultValue={300}
              min={40}
              max={1000}
            />
          </label>
          <label className="row">
            <input type="checkbox" name="reveal" />
            Reveal solutions after quiz attempts
          </label>
        </div>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        <div className="row">
          <Button type="submit" variant="default" disabled={busy}>
            {busy ? "Creating…" : "Create pack →"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}
