"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LFMark } from "@/components/icons/brand";
import { FlowchartViewer } from "@/components/studio/flowchart";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/status";
import type { StudentPack, StudentAsset } from "@/types";
async function studentFetch<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(
    `/api${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.detail || "Learning content unavailable");
  }
  return r.json() as Promise<T>;
}
function Question({ a, token }: { a: StudentAsset; token: string }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <article className="asset-card">
      <h3>{a.title}</h3>
      <p className="prose">{a.body}</p>
      <fieldset>
        <legend className="sr-only">Choose an answer</legend>
        {a.options.map((o, i) => (
          <label className="option" key={i}>
            <input
              type="radio"
              name={a.id}
              checked={choice === i}
              onChange={() => {
                setChoice(i);
                setResult("");
              }}
            />
            {String.fromCharCode(65 + i)}. {o}
          </label>
        ))}
      </fieldset>
      <Button
        disabled={choice === null || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await studentFetch<{
              correct: boolean;
              solution?: string;
            }>(`/student/${token}/answers/${a.id}`, { choice });
            setResult(
              (r.correct
                ? "Correct."
                : "Not quite. Review the lesson and try again.") +
                (r.solution ? " " + r.solution : ""),
            );
          } catch (e) {
            setResult((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking…" : "Check answer"}
      </Button>
      <p role="status" style={{ marginTop: 12 }}>
        {result}
      </p>
    </article>
  );
}
export function StudentView({ token }: { token: string }) {
  const [tab, setTab] = useState("Learn");
  const q = useQuery({
    queryKey: ["student", token],
    queryFn: () => studentFetch<StudentPack>(`/student/${token}`),
  });
  const data = q.data;
  const rows =
    data?.assets.filter((a) =>
      tab === "Learn"
        ? a.slot === "explanation"
        : tab === "Practice"
          ? a.slot.startsWith("quiz") || a.slot.startsWith("assessment")
          : tab === "Revise"
            ? a.slot === "exam_focus"
            : false,
    ) || [];
  return (
    <div className="student-shell">
      <header className="student-header">
        <span className="brand-mark" aria-hidden="true">
          <LFMark size={18} />
        </span>
        <span className="brand-wordmark" style={{ fontSize: 14 }}>
          <span className="lesson">Lesson</span>
          <span className="foundry">Foundry</span>
        </span>
        <span className="muted">
          / {data?.subject} · {data?.level}
        </span>
        <span style={{ flex: 1 }} />
        <Button onClick={() => window.print()}>Print / save PDF</Button>
      </header>
      <nav className="student-nav" aria-label="Student learning">
        {["Learn", "Practice", "Watch", "Revise", "Explore"].map((t) => (
          <Button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </nav>
      <main className="student-content">
        <h1>{data?.title || "Your learning pack"}</h1>
        {q.isLoading ? (
          <Skeleton />
        ) : q.error ? (
          <div className="alert" role="alert">
            {q.error.message}
            <Button onClick={() => q.refetch()}>Retry</Button>
          </div>
        ) : !data?.assets.length ? (
          <Empty title="Nothing here yet">
            Your teacher is preparing this learning pack. Check back when it is
            ready.
          </Empty>
        ) : (
          <>
            <div style={{ marginTop: 28 }}>
              {rows.map((a) =>
                a.slot.startsWith("quiz") ? (
                  <Question key={a.id} a={a} token={token} />
                ) : (
                  <section key={a.id} style={{ marginBottom: 32 }}>
                    <h3>{a.title}</h3>
                    <p className="prose">{a.body}</p>
                    {a.flowchart && <FlowchartViewer data={a.flowchart} />}
                    {a.slot.startsWith("assessment") && (
                      <label>
                        Your response
                        <textarea
                          className="input"
                          placeholder="Write your reasoning here. Your answer is not submitted or graded."
                        />
                      </label>
                    )}
                  </section>
                ),
              )}
            </div>
            {tab === "Watch" && (
              <Empty title="Your video is not available yet">
                Your teacher will add a video when it is ready.
              </Empty>
            )}
            {tab === "Explore" &&
              (data.resources.length ? (
                data.resources.map((r) => (
                  <article className="asset-card" key={r.url}>
                    <h4>{r.title}</h4>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      Watch supplementary resource ↗
                    </a>
                  </article>
                ))
              ) : (
                <Empty title="No supplementary resources yet">
                  Continue with the lesson and practice questions.
                </Empty>
              ))}
            {["Learn", "Practice", "Revise"].includes(tab) && !rows.length && (
              <Empty title="This section is being prepared">
                Check back when your teacher has added this material.
              </Empty>
            )}
          </>
        )}
      </main>
    </div>
  );
}
