"use client";
import { AppHeader } from "@/components/layout/app-header";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusIcon, ArrowIcon } from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { Status, Skeleton, Empty } from "@/components/ui/status";
import { api, post } from "@/lib/api";
import { useState } from "react";

interface ClassroomSummary {
  id: string;
  name: string;
  description: string;
  join_code: string;
  member_count: number;
  pack_count: number;
  created_at: string;
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

export default function TeacherDashboard() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ name: string; role: string }>("/me"),
  });
  const classrooms = useQuery({
    queryKey: ["classrooms"],
    queryFn: () => api<ClassroomSummary[]>("/classrooms"),
  });

  const recent = useQuery({
    queryKey: ["packs"],
    queryFn: () => api<PackSummary[]>("/packs"),
  });
  const details = useQueries({
    queries: (recent.data || []).slice(0, 5).map((p) => ({
      queryKey: ["pack", p.id],
      queryFn: () => api<import("@/types").Pack>(`/packs/${p.id}`),
    })),
  });
  const attention = details
    .flatMap((q) => (q.data ? [q.data] : []))
    .filter((p) => !p.published_at || p.assets.some((a) => a.stale));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const r = await post<{ id: string; join_code: string }>("/classrooms", {
      name,
      description: desc,
    });
    setCreatedCode(r.join_code);
    setName("");
    setDesc("");
    classrooms.refetch();
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch {
      setCopyStatus("Copy failed");
    }
  }

  const firstName = me.data?.name?.split(" ")[0] || "Teacher";

  return (
    <div className="teacher-shell">
      <AppHeader role="Teacher" />

      <main className="page">
        <section
          className="row spread"
          style={{ alignItems: "flex-end", marginBottom: "var(--space-6)" }}
        >
          <div>
            <p className="muted" style={{ margin: "0 0 var(--space-1)" }}>
              Welcome back, {firstName}
            </p>
            <h1 style={{ margin: 0 }}>Your classrooms</h1>
            <p className="muted" style={{ margin: "var(--space-1) 0 0" }}>
              Manage your classes, learning materials, and students.
            </p>
          </div>
          <Button
            variant="default"
            onClick={() => {
              setCreating(true);
              setCreatedCode("");
            }}
          >
            <PlusIcon size={16} /> Create classroom
          </Button>
        </section>

        <section className="attention-center" aria-label="Needs your attention">
          <h2>Needs your attention</h2>
          <p className="muted">Next steps for your recent learning packs.</p>
          {details.some((q) => q.isLoading) ? (
            <p role="status">Checking recent packs…</p>
          ) : attention.length ? (
            attention.map((p) => {
              const stale = p.assets.some((a) => a.stale);
              const failures = p.assets
                .flatMap((a) => a.checks)
                .filter((c) => c.state === "FAIL").length;
              const approved =
                p.assets.length > 0 &&
                p.assets.every((a) => a.state === "APPROVED" && !a.stale);
              const label = stale
                ? "Source changes need review"
                : failures
                  ? `${failures} blocking checks`
                  : approved
                    ? "Ready to publish"
                    : p.assets.length
                      ? "Ready for teacher review"
                      : "Add sources and prepare learning";
              return (
                <Link
                  className="attention-row"
                  href={`/teacher/packs/${p.id}`}
                  key={p.id}
                >
                  <strong>{p.title}</strong>
                  <span className="row" style={{ gap: "var(--space-2)" }}>
                    <Status state={approved ? "Ready" : stale ? "WARNING" : p.assets.length ? "NEEDS_REVIEW" : "DRAFT"} />
                    <span>{label} →</span>
                  </span>
                </Link>
              );
            })
          ) : (
            <div
              className="row"
              style={{ gap: "var(--space-2)", color: "var(--lf-green)" }}
            >
              <span>✓</span>
              <span>
                {details.some((q) => q.error) || recent.error
                  ? "Recent pack status is unavailable."
                  : "You're all caught up. No pending reviews or publishing actions."}
              </span>
            </div>
          )}
        </section>

        {creating && (
          <section className="card" style={{ marginBottom: "var(--space-6)" }}>
            {createdCode ? (
              <div className="stack">
                <h3>Classroom created</h3>
                <p>Share this code with your students:</p>
                <div className="row">
                  <div className="join-code-display">{createdCode}</div>
                  <Button onClick={() => copyCode(createdCode)}>
                    Copy code
                  </Button>
                </div>
                {copyStatus && (
                  <small style={{ color: "var(--lf-green)" }}>
                    {copyStatus}
                  </small>
                )}
                <div className="row">
                  <Button variant="ghost" onClick={() => setCreating(false)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form className="stack" onSubmit={handleCreate}>
                <h3>Create classroom</h3>
                <label>
                  Name
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    className="input"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    rows={3}
                  />
                </label>
                <div className="row">
                  <Button type="submit" variant="default">
                    Create classroom
                  </Button>
                  <Button type="button" onClick={() => setCreating(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </section>
        )}

        {classrooms.isLoading ? (
          <Skeleton />
        ) : !classrooms.data?.length ? (
          <Empty title="No classrooms yet">
            <p>Create your first classroom to organize students and learning packs.</p>
            <Button
              variant="default"
              onClick={() => {
                setCreating(true);
                setCreatedCode("");
              }}
              style={{ marginTop: "var(--space-3)" }}
            >
              <PlusIcon size={16} /> Create your first classroom
            </Button>
          </Empty>
        ) : (
          <section>
            <h2 style={{ fontSize: 18, marginBottom: "var(--space-4)" }}>
              Classrooms
            </h2>
            <div className="classroom-grid">
              {classrooms.data.map((c) => (
                <Link
                  key={c.id}
                  href={`/teacher/classrooms/${c.id}`}
                  className="card classroom-card"
                >
                  <div className="card-kicker">{c.join_code}</div>
                  <h3 className="card-title">{c.name}</h3>
                  <p className="card-body">
                    {c.description || "No description"}
                  </p>
                  <div className="card-meta">
                    <span>{c.member_count} students</span>
                    <span>·</span>
                    <span>{c.pack_count} packs</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="stack" style={{ marginTop: "var(--space-8)" }}>
          <div className="row spread" style={{ alignItems: "center" }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Recent learning packs</h2>
            <Link href="/" style={{ fontSize: 14 }}>
              Legacy studio →
            </Link>
          </div>
          {recent.error ? (
            <p role="alert">{recent.error.message}</p>
          ) : !(recent.data || []).length ? (
            <Empty title="No learning packs yet">
              <p>
                Create your first learning pack to begin building lessons for
                your students.
              </p>
              <Button
                variant="default"
                onClick={() => router.push("/")}
                style={{ marginTop: "var(--space-3)" }}
              >
                Create learning pack
              </Button>
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pack</th>
                    <th>Subject / class</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(recent.data || []).slice(0, 5).map((p) => (
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
                          onClick={() => router.push(`/teacher/packs/${p.id}`)}
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
        </section>
      </main>
    </div>
  );
}
