"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LFMark, LFWordmark, PlusIcon } from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { Skeleton, Empty } from "@/components/ui/status";
import { api, post } from "@/lib/api";
import { signOut } from "@/lib/auth";

interface StudentClassroom {
  id: string; name: string; teacher_name: string;
  pack_count: number; joined_at: string;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState("");

  const me = useQuery({ queryKey: ["me"], queryFn: () => api<{ name: string }>("/me") });
  const classrooms = useQuery({
    queryKey: ["student-classrooms"],
    queryFn: () => api<StudentClassroom[]>("/student/classrooms"),
  });

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");
    try {
      await post<{ classroom_id: string; joined: boolean }>("/join", { code: code.trim().toUpperCase() });
      setJoining(false);
      setCode("");
      classrooms.refetch();
    } catch (err) {
      setJoinError((err as Error).message);
    }
  }

  return (
    <div className="student-shell">
      <header className="student-header">
        <Link href="/student" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
          <span className="brand-mark"><LFMark size={18} /></span>
          <span className="brand-wordmark" style={{ fontSize: 14 }}><span className="lesson">Lesson</span><span className="foundry">Foundry</span></span>
        </Link>
        <span style={{ flex: 1 }} />
        <span className="topbar-user">{me.data?.name || "Student"}</span>
        <Button variant="ghost" onClick={async () => { await signOut(); router.replace("/login"); }}>Sign out</Button>
      </header>

      <main className="student-content" style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <div className="row spread">
          <div>
            <p className="muted" style={{ margin: 0 }}>Welcome back</p>
            <h1 style={{ fontSize: 30, marginBottom: 0 }}>My Classrooms</h1>
          </div>
          <Button onClick={() => setJoining(true)}><PlusIcon size={14} /> Join Classroom</Button>
        </div>

        {joining && (
          <div className="card" style={{ marginTop: 16 }}>
            <form className="stack" onSubmit={handleJoin}>
              <h3>Join Classroom</h3>
              <label>
                Enter class code
                <input className="input" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="LF-XXXXX" required minLength={5} style={{ fontSize: 18, letterSpacing: 2, textTransform: "uppercase" }} />
              </label>
              {joinError && <div className="alert">{joinError}</div>}
              <div className="row">
                <Button type="submit">Join</Button>
                <Button type="button" onClick={() => setJoining(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        {classrooms.isLoading ? <Skeleton /> : !classrooms.data?.length ? (
          <Empty title="No classrooms yet">
            Ask your teacher for a class code and click "Join Classroom" to get started.
          </Empty>
        ) : (
          <div className="classroom-grid">
            {classrooms.data.map((c) => (
              <Link key={c.id} href={`/student/classrooms/${c.id}`} className="card classroom-card">
                <h3 className="card-title">{c.name}</h3>
                <p className="card-body muted">Teacher: {c.teacher_name}</p>
                <div className="card-meta">
                  <span>{c.pack_count} learning packs</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
