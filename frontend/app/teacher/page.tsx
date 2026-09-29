"use client";
import { useQuery } from "@tanstack/react-query";
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
      <header className="teacher-topbar">
        <span className="brand-mark"><LFMark size={20} /></span>
        <span className="brand-wordmark"><span className="lesson">Lesson</span><span className="foundry">Foundry</span></span>
        <span style={{ flex: 1 }} />
        <span className="topbar-user">{me.data?.name || "Teacher"}</span>
        <Button variant="ghost" onClick={async () => { await signOut(); router.replace("/login"); }}>Sign out</Button>
      </header>

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

        <div className="rule" style={{ marginTop: 32 }}>
          <Link href="/">← Legacy Studio (standalone packs)</Link>
        </div>
      </main>
    </div>
  );
}
