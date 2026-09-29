"use client";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LFMark, LFWordmark, DownloadIcon } from "@/components/icons/brand";
import { FlowchartViewer } from "@/components/studio/flowchart";
import { Button } from "@/components/ui/button";
import { Skeleton, Empty } from "@/components/ui/status";
import { api, post } from "@/lib/api";
import { signOut } from "@/lib/auth";

interface Asset { id: string; slot: string; title: string; body: string; options: string[]; flowchart?: any; }
interface PackData { title: string; subject: string; level: string; assets: Asset[]; resources: { title: string; url: string }[]; has_export: boolean; }

const tabs = ["Learn", "Practice", "Revise", "Watch", "Resources"] as const;

export default function StudentPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<string>("Learn");
  const [downloading, setDownloading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { choice: number; correct?: boolean }>>({});

  const q = useQuery({ queryKey: ["student-pack", id], queryFn: () => api<PackData>(`/student/packs/${id}`) });
  const data = q.data;

  const rows = data?.assets.filter((a) =>
    tab === "Learn" ? a.slot === "explanation"
    : tab === "Practice" ? a.slot.startsWith("quiz") || a.slot.startsWith("assessment")
    : tab === "Revise" ? a.slot === "exam_focus"
    : false
  ) || [];

  async function checkAnswer(vid: string, choice: number) {
    const r = await post<{ correct: boolean }>(`/student/packs/${id}/answers/${vid}`, { choice });
    setAnswers((prev) => ({ ...prev, [vid]: { choice, correct: r.correct } }));
  }

  async function download() {
    setDownloading(true);
    try {
      const r = await post<{ download_url: string }>(`/student/packs/${id}/download`);
      window.open(r.download_url, "_blank");
    } catch (err) { alert((err as Error).message); }
    finally { setDownloading(false); }
  }

  return (
    <div className="student-shell">
      <header className="student-header">
        <Link href="/student" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
          <span className="brand-mark"><LFMark size={18} /></span>
          <span className="brand-wordmark" style={{ fontSize: 14 }}><span className="lesson">Lesson</span><span className="foundry">Foundry</span></span>
        </Link>
        <span className="muted" style={{ fontSize: 12 }}>/ {data?.subject} · {data?.level}</span>
        <span style={{ flex: 1 }} />
        {data?.has_export && (
          <Button onClick={download} disabled={downloading}>
            <DownloadIcon size={14} /> {downloading ? "Preparing…" : "Download PDF"}
          </Button>
        )}
        <Button variant="ghost" onClick={async () => { await signOut(); router.replace("/login"); }}>Sign out</Button>
      </header>

      <nav className="student-nav">
        {tabs.map((t) => (
          <Button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</Button>
        ))}
      </nav>

      <main className="student-content">
        <h1>{data?.title || "Learning Pack"}</h1>
        {q.isLoading ? <Skeleton /> : q.error ? (
          <div className="alert">{q.error.message}</div>
        ) : !data?.assets.length ? (
          <Empty title="Content not available">This learning pack has no published content yet.</Empty>
        ) : (
          <div style={{ marginTop: 24 }}>
            {rows.map((a) =>
              a.slot.startsWith("quiz") ? (
                <section key={a.id} className="card" style={{ marginBottom: 16 }}>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                  {a.options.map((o, i) => (
                    <label key={i} className="row" style={{ gap: 8, padding: "6px 0" }}>
                      <input type="radio" name={`q-${a.id}`}
                        checked={answers[a.id]?.choice === i}
                        onChange={() => setAnswers((p) => ({ ...p, [a.id]: { choice: i } }))} />
                      <span>{String.fromCharCode(65 + i)}. {o}</span>
                    </label>
                  ))}
                  {answers[a.id] && !("correct" in answers[a.id]) && (
                    <Button onClick={() => checkAnswer(a.id, answers[a.id].choice)}>Check answer</Button>
                  )}
                  {answers[a.id]?.correct !== undefined && (
                    <div className={`status ${answers[a.id].correct ? "good" : "bad"}`} role="status">
                      {answers[a.id].correct ? "Correct!" : "Not quite — review the material"}
                    </div>
                  )}
                </section>
              ) : (
                <section key={a.id} style={{ marginBottom: 28 }}>
                  <h3>{a.title}</h3>
                  <p className="prose">{a.body}</p>
                  {a.flowchart && <FlowchartViewer data={a.flowchart} />}
                </section>
              )
            )}
            {tab === "Watch" && <Empty title="Video not available">Your teacher will add a video when ready.</Empty>}
            {tab === "Resources" && (data.resources.length ? data.resources.map((r) => (
              <div key={r.url} className="card" style={{ marginBottom: 12 }}>
                <h4>{r.title}</h4>
                <a href={r.url} target="_blank" rel="noreferrer">Watch ↗</a>
              </div>
            )) : <Empty title="No resources yet">Continue with the lesson.</Empty>)}
            {["Learn", "Practice", "Revise"].includes(tab) && !rows.length && (
              <Empty title="Section being prepared">Check back when your teacher adds content.</Empty>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
