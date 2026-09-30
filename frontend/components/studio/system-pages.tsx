"use client";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Status, Skeleton, Empty } from "@/components/ui/status";
import { PlayIcon, AITeacherIcon, RegenerateIcon } from "@/components/icons/brand";
import type { Pack, TimelineEntry, Resource, Asset } from "@/types";
export function Versions({ pack }: { pack: Pack }) {
  const q = useQuery({
    queryKey: ["versions", pack.id, pack.revision],
    queryFn: () => api<TimelineEntry[]>(`/packs/${pack.id}/versions`),
  });
  return (
    <div className="page stack">
      <div className="kicker">System · Immutable history</div>
      <h1>Version timeline</h1>
      <p className="muted">
        Changes are scoped. Approved neighbors never silently change.
      </p>
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <div role="alert" className="alert">
          {q.error.message}
        </div>
      ) : (
        q.data?.map((e) => (
          <article className="timeline-entry" key={e.id}>
            <div className="row">
              <span className="status">v{e.revision}</span>
              <small>{new Date(e.created_at).toLocaleString()}</small>
            </div>
            <h3>{e.title}</h3>
            <p>{e.detail}</p>
          </article>
        ))
      )}
    </div>
  );
}
export function Validation({ pack }: { pack: Pack }) {
  return (
    <div className="page stack">
      <div className="kicker">System · Quality engine</div>
      <h1>Validation & provenance</h1>
      <p className="muted">
        Explicit results, not a single AI quality score. NEEDS REVIEW checks
        require teacher judgment.
      </p>
      {!pack.assets.length && (
        <Empty title="No checks yet">
          Generate the pack to run validators.
        </Empty>
      )}
      {pack.assets.map((a) => (
        <section key={a.id}>
          <div className="row spread">
            <h4>
              {a.payload.title} · v{a.version}
            </h4>
            <Status
              state={a.stale ? "FAIL" : a.state}
              label={a.stale ? "STALE SOURCE" : undefined}
            />
          </div>
          <table>
            <thead>
              <tr>
                <th>Validator</th>
                <th>Result</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {a.checks.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>
                    <Status state={c.state} />
                  </td>
                  <td>{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
export function AnswerKey({ pack }: { pack: Pack }) {
  const q = useQuery({
    queryKey: ["answer-key", pack.id, pack.revision],
    queryFn: () => api<Asset[]>(`/packs/${pack.id}/answer-key`),
  });
  const rows = q.data || [];
  return (
    <div className="page stack">
      <div className="kicker">Assessment · Teacher only</div>
      <h1>Answer key</h1>
      <p className="muted">
        Derived from approved question versions. No independent answer
        generation.
      </p>
      {!rows.length && (
        <Empty title="Approve questions first">
          Keys appear only for approved current questions.
        </Empty>
      )}
      {rows.map((a) => (
        <article className="asset-card" key={a.id}>
          <div className="row spread">
            <h4>{a.payload.title}</h4>
            <Status state="APPROVED" label={`v${a.version}`} />
          </div>
          <p>{a.payload.body}</p>
          <b>
            {a.payload.answer !== null
              ? `${String.fromCharCode(65 + a.payload.answer)}. ${a.payload.options[a.payload.answer]}`
              : "Worked solution"}
          </b>
          <p className="prose">{a.payload.solution}</p>
        </article>
      ))}
    </div>
  );
}
export function Resources({
  pack,
  run,
}: {
  pack: Pack;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}) {
  const q = useQuery({
    queryKey: ["resources", pack.id],
    queryFn: () => api<Resource[]>(`/packs/${pack.id}/resources`),
  });
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  return (
    <div className="page stack">
      <div className="kicker">Supplementary · Not source evidence</div>
      <h1>Resources</h1>
      <p className="muted">
        Real YouTube search results, reviewed by you before students see them.
      </p>
      <div className="asset-card stack">
        <h3>Add a teacher-selected video</h3>
        <p className="muted">Paste a YouTube watch, youtu.be, or Shorts link. It stays private to students until you approve it.</p>
        <label>YouTube URL<input className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtu.be/..." /></label>
        <label>Optional title<input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Lesson resource" /></label>
        <Button disabled={!url.trim()} onClick={() => run(async () => { await post(`/packs/${pack.id}/resources/custom`, { url, title: title || undefined }); setUrl(""); setTitle(""); await q.refetch(); }, "YouTube link added for review")}>Add video</Button>
      </div>
      <Button onClick={() => run(async () => { await post(`/packs/${pack.id}/resources/search`); await q.refetch(); }, "Search completed")}>Search YouTube resources</Button>
      {q.error && <div className="alert">{q.error.message}</div>}
      {q.isLoading ? (
        <Skeleton />
      ) : !q.data?.length ? (
        <Empty title="No recommended resources yet">
          Configure the server-side YouTube API key, search, inspect the video,
          then approve it. No URLs are invented.
        </Empty>
      ) : (
        q.data.map((r) => (
          <article className="asset-card" key={r.id}>
            <h4>{r.title}</h4>
            <p className="muted">{r.channel}</p>
            <div className="row">
              <a href={r.url} target="_blank" rel="noreferrer">
                Review on YouTube ↗
              </a>
              <Button
                disabled={r.approved}
                onClick={() =>
                  run(async () => {
                    await post(`/resources/${r.id}/approve`);
                    await q.refetch();
                  }, "Resource approved")
                }
              >
                {r.approved ? "Approved" : "Approve recommendation"}
              </Button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
export function VideoWorkflow({
  pack,
  script,
  onApprove,
  run,
}: {
  pack: Pack;
  script?: Asset;
  onApprove: (a: Asset) => void;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}) {
  const latest = pack.videos[0];
  const scriptApproved = script && script.state === "APPROVED" && !script.stale;
  const [avatarId, setAvatarId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const avatars = useQuery({ queryKey: ["avatars"], queryFn: () => api<{id:string;name:string;description:string;status:string}[]>("/avatars") });
  const videos = useQuery({ queryKey: ["videos", pack.id], queryFn: () => api<{id:string;title:string;status:string;approved:boolean;published:boolean;is_demo:boolean}[]>(`/videos?pack_id=${pack.id}`) });
  async function createAvatar(file: File) {
    const form = new FormData(); form.append("file", file); form.append("name", file.name.replace(/\\.[^.]+$/, ""));
    setUploading(true); setMessage(""); try { await api("/avatars", { method: "POST", body: form }); await avatars.refetch(); setMessage("Avatar profile created. It is private to your teacher account."); } catch(e) { setMessage((e as Error).message); } finally { setUploading(false); }
  }
  async function uploadVideo(file: File) {
    const form = new FormData(); form.append("file", file); form.append("title", file.name.replace(/\\.[^.]+$/, "")); form.append("pack_id", pack.id);
    setUploading(true); setMessage(""); try { const video = await api<{id:string}>("/videos", { method: "POST", body: form }); await api(`/videos/${video.id}/attach`, { method: "POST", body: (() => { const f = new FormData(); f.append("pack_id", pack.id); if (avatarId) f.append("avatar_id", avatarId); return f; })() }); await videos.refetch(); setMessage("Existing video uploaded and attached. Approve it before publication."); } catch(e) { setMessage((e as Error).message); } finally { setUploading(false); }
  }
  const selectedAvatar = (avatars.data || []).find((a) => a.id === avatarId);
  useEffect(() => {
    if (!avatarId && avatars.data && avatars.data.length > 0) {
      const first = avatars.data[0];
      setAvatarId(first.id);
      void api<{ url: string }>(`/avatars/${first.id}/download`)
        .then((r) => setAvatarPreview(r.url))
        .catch(() => setAvatarPreview(""));
    }
  }, [avatarId, avatars.data]);
  return (
    <div className="page stack">
      <div className="kicker">AI Teacher</div>
      <h1>Script, avatar, video</h1>
      <p className="muted">
        LessonFoundry keeps the approved script as the source of truth. The
        avatar presents it. Video generation is provider-agnostic and currently
        runs in demo mode.
      </p>
      <div className="notice">
        Development mode · no paid AI provider configured. Generated outputs use
        configured demo media only.
      </div>

      <div className="v5-studio-grid">
        <section className="stack">
          <h3>Script</h3>
          {script ? (
            <article className="asset-card">
              <div className="row spread">
                <h4>{script.payload.title} · v{script.version}</h4>
                <Status state={script.stale ? "FAIL" : script.state} label={script.stale ? "STALE SOURCE" : undefined} />
              </div>
              {script.stale && (
                <div className="alert" style={{ margin: "10px 0" }}>
                  <strong>Source material updated.</strong> The source text was changed after this script was generated. Regenerate the script to ground it in the latest sources before reviewing and approving.
                </div>
              )}
              <p className="prose">{script.payload.body}</p>
              <div className="row" style={{ gap: "8px" }}>
                {script.stale && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      run(
                        () => post(`/assets/${script.id}/regenerate`),
                        "Script regeneration queued",
                      )
                    }
                  >
                    <RegenerateIcon size={14} />
                    Regenerate script
                  </Button>
                )}
                <Button
                  disabled={script.state === "APPROVED" || script.stale}
                  onClick={() => onApprove(script)}
                >
                  {script.state === "APPROVED" ? "Script approved ✓" : script.stale ? "Script stale (source changed)" : "Review & approve script"}
                </Button>
              </div>
            </article>
          ) : (
            <Empty title="No script yet">
              Generate the learning pack first. The script is derived from the
              approved explanation.
            </Empty>
          )}
        </section>

        <section className="stack">
          <h3>Avatar</h3>
          <div className="asset-card">
            <div className="video-stage" style={{ minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Selected teacher avatar"
                  style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--accent, #6366f1)" }}
                />
              ) : (
                <AITeacherIcon size={48} />
              )}
              <h4>{selectedAvatar ? selectedAvatar.name : "Avatar library"}</h4>
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem", textAlign: "center" }}>
                {selectedAvatar
                  ? (selectedAvatar.description || "Active AI Teacher avatar profile.")
                  : (avatars.isLoading ? "Loading avatar library…" : "Select or upload an avatar profile.")}
              </p>
            </div>
            <div className="row">
              <label className="row">Avatar<select className="input" value={avatarId} onChange={async e => { const id=e.target.value; setAvatarId(id); if(id) { try { const r=await api<{url:string}>(`/avatars/${id}/download`); setAvatarPreview(r.url); } catch { setAvatarPreview(""); } } else setAvatarPreview(""); }}><option value="">Choose an avatar</option>{(avatars.data || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <label className="btn btn-secondary">Create avatar from photo<input hidden type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={e => { const f=e.target.files?.[0]; if(f) void createAvatar(f); e.currentTarget.value=""; }} /></label>
            </div>
          </div>
        </section>
      </div>

      <section className="stack">
        <h3>Video</h3>
        {latest ? (
          <article className="asset-card">
            <div className="row spread">
              <b>
                {latest.provider} · v{latest.script_version_id === script?.version_id ? script?.version : "historical"}
              </b>
              <Status state={latest.approved ? "APPROVED" : latest.state} />
            </div>
            {latest.url ? (
              <video src={latest.url} controls poster="" style={{ width: "100%", maxHeight: 420 }} />
            ) : (
              <p className="muted">No playable video is available from the demo provider.</p>
            )}
            <div className="row spread" style={{ alignItems: "center", marginTop: "8px" }}>
              <small>{latest.approved ? "Approved for students" : latest.state} · {latest.url ? "Demo media attached" : "Simulation only"}</small>
              {latest.teacher_video_id && (
                <Button
                  disabled={latest.approved}
                  onClick={() =>
                    run(
                      async () => {
                        await post(`/videos/${latest.teacher_video_id}/approve`);
                        await videos.refetch();
                      },
                      "AI Teacher video approved",
                    )
                  }
                >
                  {latest.approved ? "Video approved ✓" : "Approve video"}
                </Button>
              )}
            </div>
          </article>
        ) : (
          <Empty title="No AI Teacher video yet">
            Upload an existing video or run the mock generator once an approved
            script and avatar are ready.
          </Empty>
        )}
        {message && <div className="alert" role="status">{message}</div>}
        {videos.data?.filter(v => v.id !== latest?.teacher_video_id).map(v => <div className="asset-card stack" key={v.id}><div className="row spread"><span><b>{v.title}</b>{v.is_demo && <small className="muted"> · Supplied development recording</small>}</span><Status state={v.approved ? "APPROVED" : v.status} /></div>{previewUrl && <video src={previewUrl} controls preload="metadata" style={{width:"100%",maxHeight:360}} /> }<div className="row"><Button onClick={async()=>{try{const r=await api<{url:string}>(`/videos/${v.id}/download`);setPreviewUrl(r.url);}catch(e){setMessage((e as Error).message);}}}>Preview</Button><Button disabled={v.approved} onClick={() => run(async () => { await post(`/videos/${v.id}/approve`); await videos.refetch(); }, "Existing video approved")}>{v.approved ? "Approved" : "Approve video"}</Button></div></div>)}
        <div className="row">
          <label className="btn btn-secondary">Upload existing video<input hidden type="file" accept="video/mp4,video/webm,video/quicktime" disabled={uploading} onChange={e => { const f=e.target.files?.[0]; if(f) void uploadVideo(f); e.currentTarget.value=""; }} /></label>
          <Button
            variant="default"
            disabled={!scriptApproved || !avatarId}
            onClick={() =>
              run(
                async () => {
                  await post("/video-jobs", { pack_id: pack.id, avatar_id: avatarId });
                  await videos.refetch();
                },
                "Mock generation queued",
              )
            }
          >
            <PlayIcon size={14} />
            Generate AI Teacher video
          </Button>
        </div>
      </section>
    </div>
  );
}
