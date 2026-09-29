"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, post } from "@/lib/api";
import type { Pack } from "@/types";

export function PublishModal({ pack, open, onClose, onPublished }: {
  pack: Pack; open: boolean; onClose: () => void; onPublished: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const classroom = useQuery({
    queryKey: ["classroom", pack.classroom_id],
    queryFn: () => api<{ name: string; join_code: string; member_count: number }>(`/classrooms/${pack.classroom_id}`),
    enabled: open && !!pack.classroom_id,
  });
  const eligible = !!pack.classroom_id && !pack.published_at && pack.assets.length > 0 && pack.assets.every(a => a.state === "APPROVED" && !a.stale);
  return <Panel open={open} onClose={() => { if (!busy) { setError(""); onClose(); } }} title="Publish to classroom" description="Approval locks your review. Publication makes this pack available to your classroom.">
    <div className="stack">
      <h3>{pack.title}</h3>
      {classroom.isLoading ? <p role="status">Loading classroom…</p> : classroom.data && <>
        <p><b>{classroom.data.name}</b> · {classroom.data.member_count} students</p>
        <p>Class code: <b>{classroom.data.join_code}</b></p>
      </>}
      <p>Students in this classroom will be able to open the published pack. PDF export will be queued automatically.</p>
      {(error || classroom.error) && <div role="alert" className="alert">{error || classroom.error?.message}</div>}
      <div className="row"><Button disabled={busy || !eligible || !classroom.data || !!classroom.error} variant="default" onClick={async () => {
        setBusy(true); setError("");
        try { await post(`/packs/${pack.id}/publish`); onPublished(); onClose(); }
        catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
      }}>{busy ? "Publishing…" : "Confirm publication"}</Button><Button disabled={busy} onClick={onClose}>Cancel</Button></div>
    </div>
  </Panel>;
}
