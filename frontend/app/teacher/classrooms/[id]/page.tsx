"use client";
import { AppHeader } from "@/components/layout/app-header";
import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LFMark, LFWordmark, PlusIcon } from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { Status, Skeleton, Empty } from "@/components/ui/status";
import { api, post } from "@/lib/api";
import { signOut } from "@/lib/auth";

interface ClassroomDetail {
  id: string; name: string; description: string; join_code: string;
  status: string; member_count: number; pack_count: number;
}
interface PackSummary {
  id: string; title: string; subject: string; level: string;
  revision: number; status: string; published_at: string | null;
}
interface Member {
  id: string; user_id: string; name: string; email: string | null;
  status: string; joined_at: string;
}

export default function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "packs" | "students">("overview");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [obj, setObj] = useState("Objective 1\nObjective 2");

  const detail = useQuery({ queryKey: ["classroom", id], queryFn: () => api<ClassroomDetail>(`/classrooms/${id}`) });
  const packs = useQuery({ queryKey: ["classroom-packs", id], queryFn: () => api<PackSummary[]>(`/classrooms/${id}/packs`) });
  const members = useQuery({ queryKey: ["classroom-members", id], queryFn: () => api<Member[]>(`/classrooms/${id}/members`), enabled: tab === "students" });

  const c = detail.data;
  const [copyStatus, setCopyStatus] = useState("");

  async function createPack(e: React.FormEvent) {
    e.preventDefault();
    const objectives = obj.split("\n").map((s) => s.trim()).filter(Boolean);
    if (objectives.length < 2) return;
    const r = await post<{ id: string }>("/packs", { title, objectives, classroom_id: id });
    setCreating(false);
    router.push(`/teacher/packs/${r.id}`);
  }

  return (
    <div className="teacher-shell">
      <AppHeader role="Teacher" crumbs={[{ label: c?.name || "Classroom" }]} />

      <main className="page" style={{ maxWidth: 1100, margin: "0 auto" }}>
        {detail.error ? <div role="alert" className="alert">{detail.error.message}</div> : !c ? <Skeleton /> : (
          <>
            <div className="row spread">
              <div>
                <Link href="/teacher" className="muted" style={{ fontSize: 13 }}>← Classrooms</Link>
                <h1 style={{ fontSize: 30, marginBottom: 4 }}>{c.name}</h1>
                <p className="muted" style={{ margin: 0 }}>{c.description}</p>
              </div>
              <div className="stack" style={{ gap: 8, alignItems: "flex-end" }}>
                <div className="join-code-display" style={{ fontSize: 18, padding: "8px 16px" }}>{c.join_code}</div>
                <Button variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(c.join_code); setCopyStatus("Code copied"); } catch { setCopyStatus("Copy unavailable. Select the code above."); } }}>Copy join code</Button><small role="status">{copyStatus}</small>
                <small className="muted">{c.member_count} students · {c.pack_count} packs</small>
              </div>
            </div>

            <div className="row" style={{ gap: 0, borderBottom: "2px solid var(--color-divider)", marginTop: 20 }}>
              <button className={`tab-btn ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
              <button className={`tab-btn ${tab === "packs" ? "active" : ""}`} onClick={() => setTab("packs")}>Learning Packs</button>
              <button className={`tab-btn ${tab === "students" ? "active" : ""}`} onClick={() => setTab("students")}>Students</button>
            </div>

            {tab === "overview" && <div className="stats"><div className="stat"><small>Students</small><strong>{c.member_count}</strong></div><div className="stat"><small>Learning packs</small><strong>{c.pack_count}</strong></div><div className="stat"><small>Next step</small><Button onClick={() => setTab("packs")}>Open learning packs</Button></div></div>}
            {(tab === "packs" || tab === "overview") && (
              <div className="stack" style={{ marginTop: 20 }}>
                <div className="row spread">
                  <h2 style={{ fontSize: 22, margin: 0 }}>Learning Packs</h2>
                  <Button onClick={() => setCreating(true)}><PlusIcon size={14} /> Create Learning Pack</Button>
                </div>
                {creating && (
                  <form className="card stack" onSubmit={createPack}>
                    <label>Title <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} /></label>
                    <label>Learning objectives (one per line, min 2)
                      <textarea className="input" value={obj} onChange={(e) => setObj(e.target.value)} required />
                    </label>
                    <div className="row"><Button type="submit">Create →</Button><Button type="button" onClick={() => setCreating(false)}>Cancel</Button></div>
                  </form>
                )}
                {packs.isLoading ? <Skeleton /> : !packs.data?.length ? (
                  <Empty title="No packs yet">Create your first learning pack for this classroom.</Empty>
                ) : packs.data.map((p) => (
                  <Link key={p.id} href={`/teacher/packs/${p.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="row spread">
                      <h4 style={{ margin: 0 }}>{p.title}</h4>
                      <div className="row" style={{ gap: 8 }}>
                        <Status state={p.status} />
                        {p.published_at && <small className="muted">Published {new Date(p.published_at).toLocaleDateString()}</small>}
                      </div>
                    </div>
                    <div className="meta" style={{ marginTop: 6 }}>
                      <span>{p.subject} · {p.level}</span>
                      <span>v{p.revision}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {tab === "students" && (
              <div className="stack" style={{ marginTop: 20 }}>
                <h2 style={{ fontSize: 22, margin: 0 }}>Students</h2>
                {members.isLoading ? <Skeleton /> : !members.data?.length ? (
                  <Empty title="No students yet">Share the classroom code with students.</Empty>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Status</th></tr></thead>
                      <tbody>{members.data.map((m) => (
                        <tr key={m.id}>
                          <td><b>{m.name}</b></td>
                          <td>{m.email || "—"}</td>
                          <td>{new Date(m.joined_at).toLocaleDateString()}</td>
                          <td><Status state={m.status} /></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
