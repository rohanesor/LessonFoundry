"use client";
import { useQuery } from "@tanstack/react-query";
import { api, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Status, Skeleton, Empty } from "@/components/ui/status";
import { PlayIcon, AITeacherIcon } from "@/components/icons/brand";
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
  return (
    <div className="page stack">
      <div className="kicker">Supplementary · Not source evidence</div>
      <h1>Resources</h1>
      <p className="muted">
        Real YouTube search results, reviewed by you before students see them.
      </p>
      <Button
        onClick={() =>
          run(async () => {
            await post(`/packs/${pack.id}/resources/search`);
            await q.refetch();
          }, "Search completed")
        }
      >
        Search YouTube resources
      </Button>
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
  return (
    <div className="page stack">
      <div className="kicker">AI teacher · Script-controlled presentation</div>
      <h1>Teach through an AI presenter</h1>
      <div className="notice">
        Development avatar provider · workflow simulation only. No playable
        video is generated. HeyGen integration is not enabled.
      </div>
      <div className="video-stage">
        <AITeacherIcon size={44} />
        <h3>Approved script → AI presenter</h3>
        <span>
          LessonFoundry controls the lesson. The avatar only presents it.
        </span>
      </div>
      {script ? (
        <>
          <article className="asset-card">
            <div className="row spread">
              <h4>Video script · v{script.version}</h4>
              <Status state={script.state} />
            </div>
            <p className="prose">{script.payload.body}</p>
            <div className="row">
              <Button
                disabled={script.state === "APPROVED" || script.stale}
                onClick={() => onApprove(script)}
              >
                Review & approve script
              </Button>
              <Button
                variant="default"
                disabled={script.state !== "APPROVED" || script.stale}
                onClick={() =>
                  run(
                    () => post("/video-jobs", { pack_id: pack.id }),
                    "Mock render queued",
                  )
                }
              >
                <PlayIcon size={14} />
                Simulate rendering
              </Button>
            </div>
          </article>
          {pack.videos.map((v) => (
            <div className="asset-card" key={v.id}>
              <div className="row spread">
                <b>
                  Generated from approved script{" "}
                  {v.script_version_id === script.version_id
                    ? `v${script.version}`
                    : "(historical version)"}
                </b>
                <Status state={v.state} />
              </div>
              <small>
                {v.provider} ·{" "}
                {v.url ? "Output available" : "No MP4: mock workflow only"}
              </small>
            </div>
          ))}
        </>
      ) : (
        <Empty title="No script yet">
          Generate your learning pack first, then review the script before
          rendering.
        </Empty>
      )}
    </div>
  );
}
