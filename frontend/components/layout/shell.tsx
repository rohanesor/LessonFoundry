"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "./app-header";
import { Button } from "@/components/ui/button";
import { PublishModal } from "@/components/studio/publish-modal";
import { api } from "@/lib/api";
import type { Pack, Screen } from "@/types";

const sections: Screen[] = ["Overview", "Explanation", "Assessment", "Quiz", "Answer Key", "AI Teacher", "Exam Focus", "Resources", "Sources"];
export function Shell({ screen, navigate, pack, onApprove, children }: { screen: Screen; navigate: (s: Screen) => void; pack?: Pack; onApprove: () => void; children: React.ReactNode }) {
  const [publishing,setPublishing] = useState(false); const qc = useQueryClient();
  const classroom = useQuery({ queryKey: ["classroom",pack?.classroom_id], queryFn: () => api<{name:string}>(`/classrooms/${pack!.classroom_id}`), enabled: !!pack?.classroom_id });
  const inPack = pack && !["Dashboard","Learning Packs","Settings"].includes(screen);
  const approved = !!pack?.assets.length && pack.assets.every(a => a.state === "APPROVED" && !a.stale);
  const running = pack?.jobs.some(j => ["Queued","Running"].includes(j.state));
  const stale = pack?.assets.some(a=>a.stale);
  const fails = pack?.assets.flatMap(a=>a.checks).filter(c=>c.state === "FAIL").length || 0;
  const warnings = pack?.assets.flatMap(a=>a.checks).filter(c=>["WARNING","NEEDS_REVIEW"].includes(c.state)).length || 0;
  const stage = running ? 0 : approved ? pack?.published_at ? 3 : 2 : pack?.assets.length ? 1 : 0;
  const crumbs = pack ? [...(pack.classroom_id ? [{label:classroom.data?.name || "Classroom",href:`/teacher/classrooms/${pack.classroom_id}`}] : []),{label:pack.title}] : [{label:screen}];
  return <div className="v5-workspace">
    <a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>
    <AppHeader role="Teacher" crumbs={crumbs} />
    {inPack ? <section className="v5-pack-header"><div className="row spread">
      <div className="v5-pack-title"><div className="kicker">Learning pack · {pack.subject} · {pack.level} · {pack.exam}</div><h1>{pack.title}</h1><small>Version {pack.revision}</small></div>
      <div className="row"><Button onClick={()=>navigate("Validation")}>Review · {fails ? `${fails} blocking` : `${warnings} warnings`}</Button>
        {!approved ? <Button variant="default" disabled={!pack.assets.length || !!running} onClick={onApprove}>Approve pack</Button> : !pack.published_at && pack.classroom_id ? <Button variant="default" onClick={()=>setPublishing(true)}>Publish to classroom</Button> : <span className="status good">{pack.published_at ? "Published" : "Approved"}</span>}
      </div></div>
      <ol className="lifecycle" aria-label="Pack lifecycle">{[running ? "Generating" : "Draft", "Review", "Approved", "Published"].map((label,i)=><li key={i} className={i<=stage?"reached":""} aria-current={stage===i?"step":undefined}>{label}</li>)}</ol>
      {stale && <div className="notice">Sources have changed. Current assets need review before approval; published snapshots remain separate.</div>}
      {approved && <div className="banner good">Approved versions are locked. {pack.published_at ? "This pack has been published to its classroom." : "Publish separately to make this pack available in its classroom."}</div>}
      <nav className="pack-tabs" aria-label="Pack sections">{sections.map(s=><button key={s} aria-current={s===screen?"page":undefined} className={`tab-btn ${s===screen?"active":""}`} onClick={()=>navigate(s)}>{s}</button>)}</nav>
      <div className="row trust-actions"><small>Trust &amp; history</small><a href={`/student/${pack.share_token}`} target="_blank" rel="noreferrer">Student preview ↗</a><Button variant="ghost" onClick={()=>navigate("Validation")}>Validation</Button><Button variant="ghost" onClick={()=>navigate("Versions")}>Versions</Button><Button variant="ghost" onClick={()=>navigate("Sources")}>Evidence &amp; sources</Button></div>
    </section> : <nav className="pack-tabs workspace-links" aria-label="Workspace">{(["Dashboard","Learning Packs","Sources","Settings"] as Screen[]).map(s=><button className={`tab-btn ${s===screen?"active":""}`} key={s} onClick={()=>navigate(s)}>{s}</button>)}</nav>}
    <main className="content" id="main-content">{children}</main>
    {pack && <PublishModal pack={pack} open={publishing} onClose={()=>setPublishing(false)} onPublished={()=>{void qc.invalidateQueries({queryKey:["pack",pack.id]});void qc.invalidateQueries({queryKey:["classroom-packs",pack.classroom_id]});}} />}
  </div>;
}
