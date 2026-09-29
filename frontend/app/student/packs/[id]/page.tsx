"use client";
import { AppHeader } from "@/components/layout/app-header";
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
interface PackData { title: string; subject: string; level: string; assets: Asset[]; resources: { title: string; url: string }[]; has_export: boolean; video?: { id: string; title: string; description: string; url: string; expires_in: number; is_demo: boolean } | null; }

const tabs = ["Learn", "Practice", "Revise", "Watch", "Resources"] as const;

export default function StudentPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<string>("Learn");
  const [downloading, setDownloading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { choice: number; correct?: boolean }>>({});

  const q = useQuery({ queryKey: ["student-pack", id], queryFn: () => api<PackData>(`/student/packs/${id}`) });
  const data = q.data;
  const checkedCount = Object.values(answers).filter(a => a.correct !== undefined).length;
  const correctCount = Object.values(answers).filter(a => a.correct === true).length;

  const rows = data?.assets.filter((a) =>
    tab === "Learn" ? a.slot === "explanation"
    : tab === "Practice" ? a.slot.startsWith("quiz") || a.slot.startsWith("assessment")
    : tab === "Watch" ? a.slot === "video_script"
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
      window.open(r.download_url, "_blank", "noopener,noreferrer");
    } catch (err) { alert((err as Error).message); }
    finally { setDownloading(false); }
  }

  return (
    <div className="student-shell">
      <AppHeader role="Student" crumbs={[{ label: data?.title || "Learning pack" }]} actions={data?.has_export ? <Button onClick={download} disabled={downloading}><DownloadIcon size={14} />{downloading ? "Preparing…" : "Download PDF"}</Button> : undefined} />

      <nav className="student-nav" aria-label="Learning sections">
        {tabs.map((t) => (
          <Button key={t} aria-current={tab === t ? "page" : undefined} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</Button>
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
            {tab === "Practice" && <div className="notice" role="status">{checkedCount} questions checked · {correctCount} correct. Progress is for this session only.</div>}
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
            {tab === "Watch" && data.video && <section className="student-video card"><h2>{data.video.title}</h2><video src={data.video.url} controls preload="metadata" style={{ width: "100%", maxHeight: 520 }} /><p>{data.video.description}</p>{data.video.is_demo && <small className="muted">Development demo video · not synthesized by a paid AI provider.</small>}</section>}
            {tab === "Watch" && !data.video && <Empty title="Video not available">Your teacher will add a video when ready.</Empty>}
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
