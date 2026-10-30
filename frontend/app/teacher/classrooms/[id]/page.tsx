"use client";
import { AppHeader } from "@/components/layout/app-header";
import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusIcon, ArrowIcon } from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { Status, Skeleton, Empty } from "@/components/ui/status";
import { api, post } from "@/lib/api";

interface ClassroomDetail {
  id: string;
  name: string;
  description: string;
  join_code: string;
  status: string;
  member_count: number;
  pack_count: number;
}
interface PackSummary {
  id: string;
  title: string;
  subject: string;
  level: string;
  revision: number;
  status: string;
  published_at: string | null;
}
interface Member {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  status: string;
  joined_at: string;
}

export default function ClassroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "packs" | "students">("overview");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [obj, setObj] = useState("Objective 1\nObjective 2");
  const [copyStatus, setCopyStatus] = useState("");

  const detail = useQuery({
    queryKey: ["classroom", id],
    queryFn: () => api<ClassroomDetail>(`/classrooms/${id}`),
  });
  const packs = useQuery({
    queryKey: ["classroom-packs", id],
    queryFn: () => api<PackSummary[]>(`/classrooms/${id}/packs`),
  });
  const members = useQuery({
    queryKey: ["classroom-members", id],
    queryFn: () => api<Member[]>(`/classrooms/${id}/members`),
    enabled: tab === "students",
  });

  const c = detail.data;

  async function createPack(e: React.FormEvent) {
    e.preventDefault();
    const objectives = obj
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (objectives.length < 2) return;
    const r = await post<{ id: string }>("/packs", {
      title,
      objectives,
      classroom_id: id,
    });
    setCreating(false);
    router.push(`/teacher/packs/${r.id}`);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch {
      setCopyStatus("Copy unavailable. Select the code above.");
    }
  }

  return (
    <div className="teacher-shell">
      <AppHeader
        role="Teacher"
        crumbs={[{ label: c?.name || "Classroom", href: `/teacher/classrooms/${id}` }]}
      />

      <main className="page">
        {detail.error ? (
          <div role="alert" className="alert">
            {detail.error.message}
          </div>
        ) : !c ? (
          <Skeleton />
        ) : (
          <>
            <section
              className="row spread"
              style={{ alignItems: "flex-start", marginBottom: "var(--space-6)" }}
            >
              <div>
                <p className="muted" style={{ margin: "0 0 var(--space-1)", fontSize: 13 }}>
                  <Link href="/teacher">Classrooms</Link>
                </p>
                <h1 style={{ margin: "0 0 var(--space-1)" }}>{c.name}</h1>
                <p className="muted" style={{ margin: 0 }}>
                  {c.description || "Manage your students and learning materials."}
                </p>
              </div>
              <div
                className="stack"
                style={{
                  gap: "var(--space-2)",
                  alignItems: "flex-end",
                  minWidth: 220,
                }}
              >
                <div className="row" style={{ gap: "var(--space-2)" }}>
                  <div className="join-code-display">{c.join_code}</div>
                  <Button
                    variant="secondary"
                    onClick={() => copyCode(c.join_code)}
                  >
                    Copy
                  </Button>
                </div>
                {copyStatus && (
                  <small
                    role="status"
                    style={{
                      color:
                        copyStatus === "Copied!"
                          ? "var(--lf-green)"
                          : "var(--lf-amber)",
                    }}
                  >
                    {copyStatus}
                  </small>
                )}
              </div>
            </section>

            <nav
              className="row"
              style={{
                gap: 0,
                borderBottom: "1px solid var(--color-border)",
                marginBottom: "var(--space-6)",
              }}
            >
              {(["overview", "packs", "students"] as const).map((t) => (
                <button
                  key={t}
                  className={`tab-btn ${tab === t ? "active" : ""}`}
                  onClick={() => setTab(t)}
                  style={{ textTransform: "capitalize" }}
                >
                  {t === "packs" ? "Learning packs" : t}
                </button>
              ))}
            </nav>

            {tab === "overview" && (
              <section className="stack">
                <div className="stats">
                  <div className="stat">
                    <small>Students</small>
                    <strong>{c.member_count}</strong>
                  </div>
                  <div className="stat">
                    <small>Learning packs</small>
                    <strong>{c.pack_count}</strong>
                  </div>
                  <div className="stat">
                    <small>Published packs</small>
                    <strong>
                      {(packs.data || []).filter((p) => p.published_at).length}
                    </strong>
                  </div>
                </div>

                <div className="stack" style={{ marginTop: "var(--space-4)" }}>
                  <div className="row spread" style={{ alignItems: "center" }}>
                    <h2 style={{ fontSize: 18, margin: 0 }}>Learning packs</h2>
                    <Button onClick={() => setCreating(true)}>
                      <PlusIcon size={14} /> Create learning pack
                    </Button>
                  </div>
                  {creating && (
                    <form className="card stack" onSubmit={createPack}>
                      <label>
                        Title
                        <input
                          className="input"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          required
                          minLength={3}
                        />
                      </label>
                      <label>
                        Learning objectives (one per line, min 2)
                        <textarea
                          className="input"
                          value={obj}
                          onChange={(e) => setObj(e.target.value)}
                          required
                          rows={4}
                        />
                      </label>
                      <div className="row">
                        <Button type="submit" variant="default">
                          Create pack
                        </Button>
                        <Button type="button" onClick={() => setCreating(false)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}
                  {packs.isLoading ? (
                    <Skeleton />
                  ) : !packs.data?.length ? (
                    <Empty title="No packs yet">
                      Create your first learning pack for this classroom.
                    </Empty>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Pack</th>
                            <th>Subject / class</th>
                            <th>Status</th>
                            <th>Published</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {packs.data.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <Link href={`/teacher/packs/${p.id}`}>
                                  <strong>{p.title}</strong>
                                </Link>
                              </td>
                              <td>
                                {p.subject} · {p.level}
                              </td>
                              <td>
                                <Status state={p.status} />
                              </td>
                              <td>
                                {p.published_at
                                  ? new Date(p.published_at).toLocaleDateString()
                                  : "—"}
                              </td>
                              <td>
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    router.push(`/teacher/packs/${p.id}`)
                                  }
                                >
                                  Open <ArrowIcon size={14} />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

            {tab === "packs" && (
              <section className="stack">
                <div className="row spread" style={{ alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: 20, margin: 0 }}>Learning packs</h2>
                    <p className="muted" style={{ margin: "var(--space-1) 0 0" }}>
                      Create, review, and publish materials for this classroom.
                    </p>
                  </div>
                  <Button onClick={() => setCreating(true)}>
                    <PlusIcon size={14} /> Create learning pack
                  </Button>
                </div>
                {creating && (
                  <form className="card stack" onSubmit={createPack}>
                    <label>
                      Title
                      <input
                        className="input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        minLength={3}
                      />
                    </label>
                    <label>
                      Learning objectives (one per line, min 2)
                      <textarea
                        className="input"
                        value={obj}
                        onChange={(e) => setObj(e.target.value)}
                        required
                        rows={4}
                      />
                    </label>
                    <div className="row">
                      <Button type="submit" variant="default">
                        Create pack
                      </Button>
                      <Button type="button" onClick={() => setCreating(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
                {packs.isLoading ? (
                  <Skeleton />
                ) : !packs.data?.length ? (
                  <Empty title="No packs yet">
                    Create your first learning pack for this classroom.
                  </Empty>
                ) : (
                  <div className="classroom-grid">
                    {packs.data.map((p) => (
                      <Link
                        key={p.id}
                        href={`/teacher/packs/${p.id}`}
                        className="card classroom-card"
                      >
                        <div className="row spread" style={{ alignItems: "flex-start" }}>
                          <h3 className="card-title">{p.title}</h3>
                          <Status state={p.status} />
                        </div>
                        <p className="card-body">
                          {p.subject} · {p.level}
                        </p>
                        <div className="card-meta">
                          <span>v{p.revision}</span>
                          <span>·</span>
                          <span>
                            {p.published_at
                              ? new Date(p.published_at).toLocaleDateString()
                              : "Draft"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            {tab === "students" && (
              <section className="stack">
                <div className="row spread" style={{ alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: 20, margin: 0 }}>Students</h2>
                    <p className="muted" style={{ margin: "var(--space-1) 0 0" }}>
                      Share the join code <strong>{c.join_code}</strong> to invite
                      students.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => copyCode(c.join_code)}
                  >
                    Copy join code
                  </Button>
                </div>
                {members.isLoading ? (
                  <Skeleton />
                ) : !members.data?.length ? (
                  <Empty title="No students yet">
                    Share the classroom code with students to invite them.
                  </Empty>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Joined</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.data.map((m) => (
                          <tr key={m.id}>
                            <td>
                              <strong>{m.name}</strong>
                            </td>
                            <td>{m.email || "—"}</td>
                            <td>
                              {new Date(m.joined_at).toLocaleDateString()}
                            </td>
                            <td>
                              <Status state={m.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
