"use client";
import { useState } from "react";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { Versions } from "./system-pages";
import type { Pack, Evidence } from "@/types";

export type ReviewTab = "Validation" | "Evidence" | "Versions";

/** Review annotations are local session notes; they never change validator results. */
export function ReviewDrawer({ pack, tab, onTab, onClose, onEvidence }: {
  pack: Pack; tab: ReviewTab | null; onTab: (tab: ReviewTab) => void;
  onClose: () => void; onEvidence: (e: Evidence) => void;
}) {
  const [filter, setFilter] = useState("All");
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const checks = pack.assets.flatMap(asset => asset.checks.map(check => ({ asset, check })));
  const warnings = checks.filter(({ check }) => ["WARNING", "NEEDS_REVIEW"].includes(check.state));
  const blocking = checks.filter(({ check }) => check.state === "FAIL");
  const passed = checks.filter(({ check }) => check.state === "PASS");
  const visible = checks.filter(({ check }) => filter === "All" ||
    (filter === "Blocking" && check.state === "FAIL") ||
    (filter === "Warnings" && ["WARNING", "NEEDS_REVIEW"].includes(check.state)) ||
    (filter === "Passed" && check.state === "PASS"));
  return <Panel open={tab !== null} onClose={onClose} title="Review" description={`${pack.title} · v${pack.revision}`} drawer>
    <div className="review-panel stack">
      <nav className="row" aria-label="Review sections">
        {(["Validation", "Evidence", "Versions"] as const).map(value => <Button key={value} aria-pressed={tab === value} variant={tab === value ? "default" : "ghost"} onClick={() => onTab(value)}>{value}</Button>)}
      </nav>
      {tab === "Validation" && <>
        <h3>Validation &amp; provenance</h3>
        <div className="row" aria-label="Validation summary"><Status state="PASS" label={`${passed.length} passed`} /><Status state="WARNING" label={`${warnings.length} warnings`} /><Status state={blocking.length ? "FAIL" : "PASS"} label={`${blocking.length} blocking checks`} /></div>
        {pack.assets.some(a => a.stale) && <div className="notice">Source changes have made assets stale. Approval requires current evidence.</div>}
        {!checks.length && <p>No validation results yet.</p>}
        <div className="row" aria-label="Filter validation results">{["All", "Blocking", "Warnings", "Passed"].map(value => <Button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</Button>)}</div>
        {visible.map(({ asset, check }) => {
          const key = `${asset.version_id}:${check.name}:${check.state}:${check.detail}`;
          return <details key={key} className="review-check"><summary><Status state={check.state} /> <strong>{check.name}</strong><small>{asset.payload.title} · v{asset.version}</small></summary>
            <p>{check.detail}</p>
            {["WARNING", "NEEDS_REVIEW"].includes(check.state) && <Button aria-pressed={!!reviewed[key]} onClick={() => setReviewed(old => ({ ...old, [key]: !old[key] }))}>{reviewed[key] ? "Reviewed this session" : "Mark reviewed"}</Button>}
          </details>;
        })}
        <small>Review marks are local to this session. Warnings remain warnings; approval still requires your explicit acknowledgment.</small>
      </>}
      {tab === "Evidence" && <>
        {!pack.evidence.length && <p>No source passages yet.</p>}
        {pack.evidence.map(e => <article key={e.id} className="asset-card">
          <h4>{e.source_name} · v{e.source_version}</h4><small>{e.location}</small><p className="prose">{e.text}</p>
          <p className="muted">Used by: {pack.assets.filter(a => a.payload.evidence_ids.includes(e.id)).map(a => a.payload.title).join(", ") || "No current assets"}</p>
          <Button onClick={() => onEvidence(e)}>Inspect source passage</Button>
        </article>)}
      </>}
      {tab === "Versions" && <Versions pack={pack} />}
    </div>
  </Panel>;
}
