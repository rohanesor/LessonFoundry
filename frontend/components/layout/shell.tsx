"use client";
import { useState } from "react";
import { MenuIcon, CloseIcon } from "@/components/icons/brand";
import {
  LFMark,
  LFWordmark,
  DashboardIcon,
  PacksIcon,
  SourceIcon,
  OverviewIcon,
  ExplanationIcon,
  AssessmentIcon,
  QuizIcon,
  AnswerKeyIcon,
  AITeacherIcon,
  ExamFocusIcon,
  ResourcesIcon,
  VersionIcon,
  ValidationIcon,
  SettingsIcon,
  ApprovalIcon,
  ArrowIcon,
} from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import type { Pack, Screen } from "@/types";

const groups: { label: string; items: Screen[] }[] = [
  { label: "Workspace", items: ["Dashboard", "Learning Packs", "Sources"] },
  {
    label: "Current Pack",
    items: [
      "Overview",
      "Explanation",
      "Assessment",
      "Quiz",
      "Answer Key",
      "AI Teacher",
      "Exam Focus",
      "Resources",
    ],
  },
  { label: "System", items: ["Versions", "Validation", "Settings"] },
];

const navIcons: Record<Screen, React.ComponentType<{ size?: number }>> = {
  Dashboard: DashboardIcon,
  "Learning Packs": PacksIcon,
  Sources: SourceIcon,
  Overview: OverviewIcon,
  Explanation: ExplanationIcon,
  Assessment: AssessmentIcon,
  Quiz: QuizIcon,
  "Answer Key": AnswerKeyIcon,
  "AI Teacher": AITeacherIcon,
  "Exam Focus": ExamFocusIcon,
  Resources: ResourcesIcon,
  Versions: VersionIcon,
  Validation: ValidationIcon,
  Settings: SettingsIcon,
};

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
  const [open, setOpen] = useState(false);
  const inPack =
    pack && !["Dashboard", "Learning Packs", "Settings"].includes(screen);
  const approved =
    pack &&
    pack.assets.length > 0 &&
    pack.assets.every((a) => a.state === "APPROVED" && !a.stale);
  return (
    <div className="shell">
      <a href="#main-content" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <LFMark size={20} />
          </span>
          <span className="brand-wordmark">
            <span className="lesson">Lesson</span>
            <span className="foundry">Foundry</span>
          </span>
          <Button
            className="mobile-menu"
            variant="ghost"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <CloseIcon size={16} />
          </Button>
        </div>
        {groups.map((g) => (
          <nav className="nav-group" key={g.label} aria-label={g.label}>
            <div className="nav-label">{g.label.toUpperCase()}</div>
            {g.label === "Current Pack" && pack && (
              <div className="pack-nav-title">
                {pack.title}
                <br />
                <small>
                  {pack.subject} · {pack.level}
                </small>
              </div>
            )}
            {g.items.map((n) => {
              const Icon = navIcons[n];
              return (
                <button
                  className={`nav-item ${screen === n ? "active" : ""}`}
                  key={n}
                  aria-current={screen === n ? "page" : undefined}
                  onClick={() => {
                    navigate(n);
                    setOpen(false);
                  }}
                >
                  <span className="nav-item-start">
                    <Icon size={16} />
                    <span>{n}</span>
                  </span>
                  <span className="nav-item-end">
                    {n === "Quiz" && pack && (
                      <small>
                        {
                          pack.assets.filter((a) => a.slot.startsWith("quiz"))
                            .length
                        }
                      </small>
                    )}
                    {n === "Versions" && pack && <small>v{pack.revision}</small>}
                  </span>
                </button>
              );
            })}
          </nav>
        ))}
        <div className="sidebar-footer">
          <LFWordmark height={12} />
          <br />
          Source-bound learning infrastructure
          <br />
          <b>LLM proposes. Teacher approves.</b>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <Button
            variant="ghost"
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <MenuIcon size={18} />
          </Button>
          <div className="breadcrumb">
            Workspace / {pack && inPack ? "Learning pack / " : ""}
            <b>{screen}</b>
          </div>
          {pack && (
            <Button asChild>
              <a
                href={`/student/${pack.share_token}`}
                target="_blank"
                rel="noreferrer"
              >
                Student view <ArrowIcon size={14} />
              </a>
            </Button>
          )}
          <span className="user-avatar">T</span>
          <span className="user-name">
            <b>Teacher</b>
            <br />
            <small>LessonFoundry Studio</small>
          </span>
        </header>
        {inPack && (
          <section className="pack-header">
            <div className="row spread">
              <div>
                <h1>{pack.title}</h1>
                <small>
                  {pack.subject} · {pack.level} · {pack.exam} ·{" "}
                  {pack.objectives.length} objectives · {pack.sources.length}{" "}
                  sources
                </small>
              </div>
              <div className="row">
                <Status state={approved ? "APPROVED" : "NEEDS REVIEW"} />
                <span className="meta">Pack v{pack.revision}</span>
                <Button
                  variant="default"
                  disabled={approved || !pack.assets.length}
                  onClick={onApprove}
                >
                  {approved ? (
                    <>
                      <ApprovalIcon size={14} /> Approved
                    </>
                  ) : (
                    "Approve pack"
                  )}
                </Button>
              </div>
            </div>
            <div className="flow">
              {[
                "Source",
                "Evidence",
                "Objectives",
                "Generate",
                "Validate",
                "Review",
                "Approve",
                "Learn",
              ].map((s, i) => (
                <span key={s}>
                  {s}
                  {i < 7 ? " →" : ""}
                </span>
              ))}
            </div>
          </section>
        )}
        {approved && inPack && (
          <div className="banner good">
            <ApprovalIcon size={13} style={{ display: "inline", marginRight: 8 }} />
            <b>APPROVED · v{pack.revision}</b> — Published versions are locked.
            Create a new draft to make changes.
          </div>
        )}
        <main className="content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
