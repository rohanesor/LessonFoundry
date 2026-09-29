"use client";
import { AppHeader } from "@/components/layout/app-header";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LFMark, LFWordmark, PlusIcon, ArrowIcon } from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { Status, Skeleton, Empty } from "@/components/ui/status";
import { api, post } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { useState } from "react";

interface ClassroomSummary {
  id: string; name: string; description: string; join_code: string;
  member_count: number; pack_count: number; created_at: string;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [createdCode, setCreatedCode] = useState("");

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<{ name: string; role: string }>("/me") });
  const classrooms = useQuery({
    queryKey: ["classrooms"],
    queryFn: () => api<ClassroomSummary[]>("/classrooms"),
  });

  const recent = useQuery({ queryKey: ["packs"], queryFn: () => api<import("@/types").PackSummary[]>("/packs") });
  const details = useQueries({ queries: (recent.data || []).slice(0, 5).map(p => ({ queryKey: ["pack", p.id], queryFn: () => api<import("@/types").Pack>(`/packs/${p.id}`) })) });
  const attention = details.flatMap(q => q.data ? [q.data] : []).filter(p => !p.published_at || p.assets.some(a => a.stale));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const r = await post<{ id: string; join_code: string }>("/classrooms", { name, description: desc });
    setCreatedCode(r.join_code);
    setName("");
    setDesc("");
    classrooms.refetch();
  }

  return (
    <div className="teacher-shell">
      <AppHeader role="Teacher" />

      <main className="page" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="row spread" style={{ marginBottom: 8 }}>
          <div>
            <p className="muted" style={{ margin: 0 }}>Welcome back</p>
            <h1 style={{ fontSize: 32, marginBottom: 0 }}>My Classrooms</h1>
          </div>
          <Button variant="default" onClick={() => { setCreating(true); setCreatedCode(""); }}>
            <PlusIcon size={16} /> Create Classroom
          </Button>
        </div>

        <section className="attention-center" aria-label="Needs your attention">
          <h2>Needs your attention</h2>
          <p className="muted">Next steps for your five most recent learning packs.</p>
          {details.some(q => q.isLoading) ? <p role="status">Checking recent packs…</p> : attention.length ? attention.map(p => {
            const stale = p.assets.some(a => a.stale);
            const failures = p.assets.flatMap(a => a.checks).filter(c => c.state === "FAIL").length;
            const approved = p.assets.length > 0 && p.assets.every(a => a.state === "APPROVED" && !a.stale);
            return <Link className="attention-row" href={`/teacher/packs/${p.id}`} key={p.id}><strong>{p.title}</strong><span>{stale ? "Source changes need review" : failures ? `${failures} blocking checks` : approved ? "Ready to publish" : p.assets.length ? "Ready for teacher review" : "Add sources and prepare learning"} →</span></Link>;
          }) : <p>{details.some(q=>q.error) || recent.error ? "Recent pack status is unavailable." : "No pending actions in recent packs."}</p>}
        </section>
        {creating && (
          <div className="card" style={{ marginTop: 20, marginBottom: 20 }}>
            {createdCode ? (
              <div className="stack">
                <h3>Classroom created</h3>
                <p>Share this code with your students:</p>
                <div className="join-code-display">{createdCode}</div>
                <div className="row">
                  <Button onClick={() => { navigator.clipboard?.writeText(createdCode); }}>Copy code</Button>
                  <Button variant="ghost" onClick={() => setCreating(false)}>Done</Button>
                </div>
              </div>
            ) : (
              <form className="stack" onSubmit={handleCreate}>
                <h3>Create Classroom</h3>
                <label>Name <input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></label>
                <label>Description <textarea className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
                <div className="row">
                  <Button type="submit" variant="default">Create</Button>
                  <Button type="button" onClick={() => setCreating(false)}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        )}

        {classrooms.isLoading ? <Skeleton /> : !classrooms.data?.length ? (
          <Empty title="No classrooms yet">Create your first classroom to organize students and learning packs.</Empty>
        ) : (
          <div className="classroom-grid">
            {classrooms.data.map((c) => (
              <Link key={c.id} href={`/teacher/classrooms/${c.id}`} className="card classroom-card">
                <div className="card-kicker">{c.join_code}</div>
                <h3 className="card-title">{c.name}</h3>
                <p className="card-body">{c.description || "No description"}</p>
                <div className="card-meta">
                  <span>{c.member_count} students</span>
                  <span>{c.pack_count} packs</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <section className="stack" style={{ marginTop: 32 }}>
          <h2>Recent learning packs</h2>
          {recent.error ? <p role="alert">{recent.error.message}</p> : (recent.data || []).slice(0,5).map(p => <Link className="card classroom-card" key={p.id} href={`/teacher/packs/${p.id}`}><h3>{p.title}</h3><small>{p.subject} · {p.level} · v{p.revision}</small></Link>)}
        </section>
        <div className="rule" style={{ marginTop: 32 }}>
          <Link href="/">← Legacy Studio (standalone packs)</Link>
        </div>
      </main>
    </div>
  );
}
