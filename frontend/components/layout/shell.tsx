"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "./app-header";
import { Button } from "@/components/ui/button";
import { PublishModal } from "@/components/studio/publish-modal";
import { api } from "@/lib/api";
import type { Pack, Screen } from "@/types";

const sections: Screen[] = [
  "Overview",
  "Explanation",
  "Assessment",
  "Quiz",
  "Answer Key",
  "AI Teacher",
  "Exam Focus",
  "Resources",
  "Sources",
];

const groups: {
  label: string;
  screens: Screen[];
}[] = [
  { label: "Overview", screens: ["Overview"] },
  { label: "Lesson content", screens: ["Explanation", "Exam Focus"] },
  { label: "Assessment", screens: ["Assessment", "Quiz", "Answer Key"] },
  { label: "AI Teacher", screens: ["AI Teacher"] },
  { label: "Resources & sources", screens: ["Resources", "Sources"] },
];

function groupFor(screen: Screen) {
  return groups.find((g) => g.screens.includes(screen)) || groups[0];
}

export function Shell({
  screen,
  navigate,
  pack,
  onApprove,
  children,
}: {
  screen: Screen;
  navigate: (s: Screen) => void;
  pack?: Pack;
  onApprove: () => void;
  children: React.ReactNode;
}) {
  const [publishing, setPublishing] = useState(false);
  const qc = useQueryClient();
  const [moreOpen, setMoreOpen] = useState(false);

  const classroom = useQuery({
    queryKey: ["classroom", pack?.classroom_id],
    queryFn: () => api<{ name: string }>(`/classrooms/${pack!.classroom_id}`),
    enabled: !!pack?.classroom_id,
  });

  const inPack =
    pack && !["Dashboard", "Learning Packs", "Settings"].includes(screen);
  const approved =
    !!pack?.assets.length &&
    pack.assets.every((a) => a.state === "APPROVED" && !a.stale);
  const running = pack?.jobs.some((j) => ["Queued", "Running"].includes(j.state));
  const stale = pack?.assets.some((a) => a.stale);
  const fails =
    pack?.assets.flatMap((a) => a.checks).filter((c) => c.state === "FAIL")
      .length || 0;
  const warnings =
    pack?.assets
      .flatMap((a) => a.checks)
      .filter((c) => ["WARNING", "NEEDS_REVIEW"].includes(c.state)).length || 0;
  const stage = running
    ? 0
    : approved
      ? pack?.published_at
        ? 3
        : 2
      : pack?.assets.length
        ? 1
        : 0;

  const crumbs = pack
    ? [
        ...(pack.classroom_id
          ? [
              {
                label: classroom.data?.name || "Classroom",
                href: `/teacher/classrooms/${pack.classroom_id}`,
              },
            ]
          : []),
        { label: pack.title },
      ]
    : [{ label: screen }];

  const activeGroup = groupFor(screen);

  return (
    <div className="v5-workspace">
      <a href="#main-content" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <AppHeader
        role="Teacher"
        crumbs={crumbs}
        actions={
          pack && (
            <a
              href={`/student/${pack.share_token}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              Preview as student
            </a>
          )
        }
      />

      {inPack ? (
        <section className="v5-pack-header">
          <div className="row spread" style={{ alignItems: "flex-start", gap: "var(--space-5)" }}>
            <div className="v5-pack-title">
              <div className="kicker">
                {pack.subject} · {pack.level} · {pack.exam}
              </div>
              <h1>{pack.title}</h1>
              <div className="row" style={{ gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
                <span className="badge draft">Version {pack.revision}</span>
                {running ? (
                  <span className="badge warning">In progress</span>
                ) : approved ? (
                  <span className="badge good">Approved</span>
                ) : pack.assets.length ? (
                  <span className="badge warning">In review</span>
                ) : (
                  <span className="badge draft">Draft</span>
                )}
              </div>
            </div>
            <div className="row" style={{ gap: "var(--space-2)" }}>
              <Button onClick={() => navigate("Validation")}>Review</Button>
              {!approved ? (
                <Button
                  variant="default"
                  disabled={!pack.assets.length || !!running}
                  onClick={onApprove}
                >
                  Approve pack
                </Button>
              ) : !pack.published_at && pack.classroom_id ? (
                <Button
                  variant="default"
                  onClick={() => setPublishing(true)}
                >
                  Publish to classroom
                </Button>
              ) : (
                <span className="status good">
                  {pack.published_at ? "Published" : "Approved"}
                </span>
              )}
            </div>
          </div>

          <ol className="lifecycle" aria-label="Pack lifecycle">
            {["Draft", "Review", "Approved", "Published"].map((label, i) => (
              <li
                key={i}
                className={i <= stage ? "reached" : ""}
                aria-current={stage === i ? "step" : undefined}
              >
                {label}
              </li>
            ))}
          </ol>

          {stale && (
            <div className="notice" style={{ marginTop: "var(--space-4)" }}>
              Sources have changed. Current assets need review before approval;
              published snapshots remain separate.
            </div>
          )}

          <nav className="pack-tabs" aria-label="Pack sections">
            {groups.map((g) => (
              <button
                key={g.label}
                className={`tab-btn ${activeGroup.label === g.label ? "active" : ""}`}
                onClick={() => navigate(g.screens[0])}
                aria-current={activeGroup.label === g.label ? "true" : undefined}
              >
                {g.label}
              </button>
            ))}
            <div style={{ position: "relative", marginLeft: "auto" }}>
              <button
                className="tab-btn"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
              >
                More
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    marginTop: 4,
                    minWidth: 180,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-lg)",
                    zIndex: 40,
                  }}
                >
                  {[
                    { label: "Validation", screen: "Validation" as Screen },
                    { label: "Evidence & sources", screen: "Sources" as Screen },
                  ].map((item) => (
                    <button
                      key={item.label}
                      role="menuitem"
                      className="nav-item"
                      style={{
                        width: "100%",
                        padding: "var(--space-3) var(--space-4)",
                        textAlign: "left",
                        fontSize: 14,
                        borderBottom: "1px solid var(--color-border)",
                      }}
                      onClick={() => {
                        navigate(item.screen);
                        setMoreOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="trust-actions">
            <small>Trust &amp; history</small>
            <a
              href={`/student/${pack.share_token}`}
              target="_blank"
              rel="noreferrer"
            >
              Student preview ↗
            </a>
            <Button variant="ghost" onClick={() => navigate("Validation")}>
              Validation
            </Button>
            <Button variant="ghost" onClick={() => navigate("Versions")}>
              Versions
            </Button>
            <Button variant="ghost" onClick={() => navigate("Sources")}>
              Evidence &amp; sources
            </Button>
          </div>

          {activeGroup.screens.length > 1 && (
            <nav
              className="row"
              style={{
                gap: "var(--space-1)",
                marginTop: "var(--space-3)",
                paddingLeft: "var(--space-2)",
              }}
              aria-label={`${activeGroup.label} sections`}
            >
              {activeGroup.screens.map((s) => (
                <button
                  key={s}
                  className={`tab-btn ${screen === s ? "active" : ""}`}
                  onClick={() => navigate(s)}
                  style={{
                    borderBottom: "none",
                    borderRadius: "var(--radius-md)",
                    fontSize: 13,
                    padding: "var(--space-2) var(--space-3)",
                  }}
                >
                  {s}
                </button>
              ))}
            </nav>
          )}
        </section>
      ) : (
        <nav
          className="pack-tabs workspace-links"
          aria-label="Workspace"
          style={{ padding: "var(--space-3) var(--space-5)" }}
        >
          {(["Dashboard", "Learning Packs", "Sources", "Settings"] as Screen[]).map(
            (s) => (
              <button
                className={`tab-btn ${s === screen ? "active" : ""}`}
                key={s}
                onClick={() => navigate(s)}
              >
                {s}
              </button>
            )
          )}
        </nav>
      )}

      <main className="content" id="main-content">
        {children}
      </main>

      {pack && (
        <PublishModal
          pack={pack}
          open={publishing}
          onClose={() => setPublishing(false)}
          onPublished={() => {
            void qc.invalidateQueries({ queryKey: ["pack", pack.id] });
            void qc.invalidateQueries({
              queryKey: ["classroom-packs", pack.classroom_id],
            });
          }}
        />
      )}
    </div>
  );
}
