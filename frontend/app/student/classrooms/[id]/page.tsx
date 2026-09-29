"use client";
import { AppHeader } from "@/components/layout/app-header";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LFMark, LFWordmark } from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { Skeleton, Empty } from "@/components/ui/status";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth";

interface ClassroomDetail {
  id: string; name: string; description: string; teacher_name: string;
  packs: { id: string; title: string; subject: string; level: string; published_at: string }[];
}

export default function StudentClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const detail = useQuery({
    queryKey: ["student-classroom", id],
    queryFn: () => api<ClassroomDetail>(`/student/classrooms/${id}`),
  });
  const c = detail.data;

  return (
    <div className="student-shell">
      <AppHeader role="Student" crumbs={[{ label: c?.name || "Classroom" }]} />

      <main className="student-content" style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {detail.error ? <div role="alert" className="alert">{detail.error.message}</div> : !c ? <Skeleton /> : (
          <>
            <Link href="/student" className="muted" style={{ fontSize: 13 }}>← My Classrooms</Link>
            <h1 style={{ fontSize: 30, marginBottom: 4 }}>{c.name}</h1>
            <p className="muted" style={{ margin: "0 0 4px" }}>Teacher: {c.teacher_name}</p>
            {c.description && <p style={{ margin: "0 0 24px" }}>{c.description}</p>}

            <h2 style={{ fontSize: 22, marginTop: 24 }}>Learning Packs</h2>
            {!c.packs.length ? (
              <Empty title="No published packs yet">Your teacher will publish learning packs here.</Empty>
            ) : (
              <div className="stack">
                {c.packs.map((p) => (
                  <Link key={p.id} href={`/student/packs/${p.id}`} className="card classroom-card">
                    <h3 className="card-title">{p.title}</h3>
                    <div className="card-meta">
                      <span>{p.subject} · {p.level}</span>
                      <span>Published {new Date(p.published_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
