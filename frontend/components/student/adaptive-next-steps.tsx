"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "@/lib/api";
import { Button } from "@/components/ui/button";

 type Topic = { objective_id: string; description: string; accuracy: number; total_attempts: number };
 type Material = { weak_topic: { objective_id: string; description: string; accuracy: number }; segments: { asset_version_id: string; slot: string; title: string; unit_title: string }[] };
 type Plan = { id: string; progress: { completed: number; total: number }; days: { day: number; focus: string; activities: { id: string; title: string; description: string; estimated_minutes: number; completed: boolean }[] }[] };
 type Problem = { id: string; topic: string; title: string; difficulty: string };
 type ProblemDetail = Problem & { description: string; starter_code: string };
 type Submission = { status: string; passed_count: number; total_count: number; feedback: string; test_results: { name: string; passed: boolean }[] };

export function AdaptiveNextSteps({ classroomId }: { classroomId: string }) {
  const cache = useQueryClient();
  const [planId, setPlanId] = useState<string | null>(null);
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<Submission | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const performance = useQuery({ queryKey: ["adaptive-performance", classroomId], queryFn: () => api<{ total_attempts: number; weak_topics: Topic[] }>(`/student/performance?classroom_id=${classroomId}`) });
  const materials = useQuery({ queryKey: ["adaptive-content", classroomId], queryFn: () => api<{ results: Material[] }>(`/student/remedial-content?classroom_id=${classroomId}`), enabled: !!performance.data?.weak_topics.length });
  const plans = useQuery({ queryKey: ["adaptive-plans", classroomId], queryFn: () => api<{ id: string; status: string }[]>(`/student/learning-plans?classroom_id=${classroomId}&status=active`) });
  const plan = useQuery({ queryKey: ["adaptive-plan", planId], queryFn: () => api<Plan>(`/student/learning-plans/${planId}`), enabled: !!planId });
  const problems = useQuery({ queryKey: ["adaptive-problems", classroomId], queryFn: () => api<Problem[]>(`/student/problems?classroom_id=${classroomId}`) });
  async function startPlan() {
    setBusy(true); setMessage("");
    try { const result = await post<{ plan_id: string }>("/student/learning-plans", { classroom_id: classroomId }); setPlanId(result.plan_id); await cache.invalidateQueries({ queryKey: ["adaptive-plans", classroomId] }); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  async function loadPlan(id: string) { setPlanId(id); }
  async function completeItem(id: string) {
    try { await api(`/student/learning-plans/${planId}/items/${id}`, { method: "PATCH" }); await cache.invalidateQueries({ queryKey: ["adaptive-plan", planId] }); }
    catch (e) { setMessage((e as Error).message); }
  }
  async function loadProblem(id: string) {
    try { const data = await api<ProblemDetail>(`/student/problems/${id}`); setProblem(data); setCode(data.starter_code); setFeedback(null); }
    catch (e) { setMessage((e as Error).message); }
  }
  async function submitCode() {
    if (!problem) return; setBusy(true); setFeedback(null);
    try { setFeedback(await post<Submission>(`/student/problems/${problem.id}/submit`, { code, language: "python" })); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="card" style={{ marginTop: 30 }} aria-labelledby="adaptive-title">
    <p className="muted" style={{ marginBottom: 4 }}>PERSONALIZED LEARNING</p><h2 id="adaptive-title" style={{ marginTop: 0 }}>What to work on next</h2>
    {performance.isLoading && <p>Checking your recent quiz results…</p>}
    {performance.error && <p role="alert" className="alert">{performance.error.message}</p>}
    {performance.data && !performance.data.total_attempts && <p>Complete a classroom quiz to get personalized recommendations here.</p>}
    {!!performance.data?.weak_topics.length && <>
      <h3>Topics to practice</h3><div className="stack">{performance.data.weak_topics.map(t => <article key={t.objective_id} className="asset-card"><strong>{t.description}</strong><p className="muted">{Math.round(t.accuracy * 100)}% accuracy · {t.total_attempts} quiz attempts</p></article>)}</div>
      <h3>Matched approved lessons</h3>{materials.isLoading ? <p>Finding classroom materials…</p> : materials.data?.results.map(r => <article className="asset-card" key={r.weak_topic.objective_id}><strong>{r.weak_topic.description}</strong>{r.segments.length ? r.segments.map(s => <p key={s.asset_version_id}>📘 {s.title || s.slot} <span className="muted">· {s.unit_title}</span></p>) : <p className="muted">No approved matching lesson is available in this classroom yet.</p>}</article>)}
      <h3>Your three-day plan</h3>{!plan.data && plans.data?.[0] && !planId && <Button onClick={() => loadPlan(plans.data![0].id)}>Continue your active plan</Button>}{!plan.data && <Button disabled={busy || !!plans.data?.length} onClick={startPlan}>{busy ? "Building your plan…" : plans.data?.length ? "Active plan found" : "Build my 3-day plan"}</Button>}
      {plan.data && <><p className="muted">Progress: {plan.data.progress.completed}/{plan.data.progress.total} activities</p><div className="stack">{plan.data.days.map(day => <article key={day.day} className="asset-card"><h4>Day {day.day}: {day.focus}</h4>{day.activities.map(a => <label key={a.id} style={{ display: "flex", gap: 10, margin: "12px 0" }}><input type="checkbox" checked={a.completed} disabled={a.completed} onChange={() => completeItem(a.id)} /><span><strong>{a.title}</strong><br/><span className="muted">{a.description} · {a.estimated_minutes} min</span></span></label>)}</article>)}</div></>}
      <h3>Coding challenge</h3>{problems.data?.length ? <div className="row" style={{ flexWrap: "wrap" }}>{problems.data.map(p => <Button key={p.id} onClick={() => loadProblem(p.id)}>{p.title}</Button>)}</div> : <p className="muted">No classroom-linked coding challenges are available yet.</p>}
      {problem && <article className="asset-card" style={{ marginTop: 14 }}><h4>{problem.title}</h4><p>{problem.description}</p><label htmlFor="adaptive-code">Your Python solution</label><textarea id="adaptive-code" className="input" value={code} onChange={e => setCode(e.target.value)} rows={12} spellCheck={false} style={{ fontFamily: "monospace" }} /><Button onClick={submitCode} disabled={busy || !code.trim()}>{busy ? "Running…" : "Run and get feedback"}</Button>{feedback && <div role="status" style={{ marginTop: 12 }}><strong>{feedback.status === "passed" ? "Nice work — all tests passed." : `${feedback.passed_count}/${feedback.total_count} tests passed`}</strong><p>{feedback.feedback}</p>{feedback.test_results.map((t, i) => <p key={i}>{t.passed ? "✓" : "↻"} {t.name}: {t.passed ? "Passed" : "Needs another try"}</p>)}</div>}</article>}
    </>}
    {message && <p role="alert" className="alert">{message}</p>}
  </section>;
}
