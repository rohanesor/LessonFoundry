"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accessToken, hostedAuth, supabase, signOut } from "@/lib/auth";
import { api, post } from "@/lib/api";
import { Shell } from "@/components/layout/shell";
import { Dashboard } from "@/components/dashboard/dashboard";
import { CreatePack } from "@/components/sources/create-pack";
import { Sources } from "@/components/sources/sources";
import { EvidenceDrawer } from "@/components/evidence/evidence-drawer";
import { AssetEditor } from "./asset-editor";
import { Overview } from "./overview";
import { Approval } from "./approval";
import { ReviewDrawer, type ReviewTab } from "./drawer";
import { Login } from "./login";
import {
  Versions,
  Validation,
  AnswerKey,
  Resources,
  VideoWorkflow,
} from "./system-pages";
import { Skeleton, Empty, Status } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import type { Pack, PackSummary, Screen, Asset, Evidence } from "@/types";
export function Studio({ initialPackId }: { initialPackId?: string }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [logged, setLogged] = useState(false);
  const [pid, setPid] = useState(initialPackId || "");
  const [screen, setScreen] = useState<Screen>(initialPackId ? "Overview" : "Dashboard");
  const [createOpen, setCreateOpen] = useState(false);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [review, setReview] = useState<Asset | "pack" | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewRevision, setReviewRevision] = useState(0);
  const [reviewTab, setReviewTab] = useState<ReviewTab | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => {
    let active = true;
    let currentUser: string | null = null;
    const reset = () => {
      qc.clear();
      setPid("");
      setScreen("Dashboard");
      setLogged(false);
      setReview(null);
      setEvidence(null);
      setCreateOpen(false);
      localStorage.removeItem("lf-pack");
    };
    const expired = () => {
      reset();
      setError("Your session expired. Sign in again.");
    };
    window.addEventListener("lf-auth-required", expired);
    window.addEventListener("lf-signed-out", reset);
    const subscription = hostedAuth
      ? supabase().auth.onAuthStateChange((event, session) => {
          if (!active) return;
          if (!session) {
            currentUser = null;
            reset();
          } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
            if (currentUser && currentUser !== session.user.id) reset();
            currentUser = session.user.id;
            setLogged(true);
          }
        }).data.subscription
      : null;
    void accessToken()
      .then((token) => {
        if (active) {
          setLogged(!!token);
          const routePack = initialPackId || localStorage.getItem("lf-pack") || "";
          setPid(routePack);
          if (routePack) {
            localStorage.setItem("lf-pack", routePack);
            setScreen("Overview");
          }
        }
      })
      .catch(() => {
        if (active) reset();
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      subscription?.unsubscribe();
      window.removeEventListener("lf-auth-required", expired);
      window.removeEventListener("lf-signed-out", reset);
    };
  }, [qc, initialPackId]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api<{ provider: string; auth: string }>("/health"),
    enabled: logged,
  });
  const list = useQuery({
    queryKey: ["packs"],
    queryFn: () => api<PackSummary[]>("/packs"),
    enabled: logged,
  });
  const packQuery = useQuery({
    queryKey: ["pack", pid],
    queryFn: () => api<Pack>(`/packs/${pid}`),
    enabled: logged && !!pid,
    refetchInterval: (q) =>
      q.state.data?.jobs.some((j) => ["Queued", "Running"].includes(j.state))
        ? 1200
        : false,
  });
  const pack = packQuery.data;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["pack", pid] });
    void qc.invalidateQueries({ queryKey: ["packs"] });
    void qc.invalidateQueries({ queryKey: ["versions", pid] });
  };
  const run = async (fn: () => Promise<unknown>, message = "Saved") => {
    setBusy(true);
    setError("");
    try {
      await fn();
      refresh();
      setToast(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const navigate = (s: Screen) => {
    if (s === "Validation" || s === "Versions") {
      setReviewTab(s);
      return;
    }
    setScreen(s);
    setError("");
  };
  const open = (id: string, s: Screen = "Overview") => {
    setPid(id);
    localStorage.setItem("lf-pack", id);
    setScreen(s);
  };
  if (!ready) return <Skeleton />;
  if (!logged) return <Login onLogin={() => setLogged(true)} />;
  const latest = pack?.jobs[0];
  const showPack =
    pack && !["Dashboard", "Learning Packs", "Settings"].includes(screen);
  return (
    <>
      <Shell
        screen={screen}
        navigate={navigate}
        pack={pack}
        onApprove={() => {
          setReviewRevision(pack?.revision || 0);
          setReview("pack");
        }}
      >
        {health.data?.provider === "mock" && (
          <div className="banner warning">
            <b>DEVELOPMENT PROVIDER</b> · Mock / authored demo fixtures, not
            live AI. Content and semantic judgments require review.
          </div>
        )}
        {(error || list.error || packQuery.error) && (
          <div className="alert row spread" role="alert">
            <span>
              {error || list.error?.message || packQuery.error?.message}
            </span>
            <Button
              onClick={() => {
                setError("");
                refresh();
              }}
            >
              Retry / reload
            </Button>
          </div>
        )}
        {showPack && latest && (
          <div
            className={`banner job-banner ${latest.state === "Failed" ? "bad" : latest.state === "Succeeded" ? "good" : "warning"}`}
            role="status"
          >
            <span>
              <Status state={latest.state} /> <b>{latest.kind}</b> ·{" "}
              {latest.message}
            </span>
            {["Queued", "Running"].includes(latest.state) && (
              <Button
                onClick={() =>
                  run(() => post(`/jobs/${latest.id}/cancel`), "Job cancelled")
                }
              >
                Cancel job
              </Button>
            )}
          </div>
        )}
        {screen === "Dashboard" || screen === "Learning Packs" ? (
          list.isLoading ? (
            <Skeleton />
          ) : (
            <Dashboard
              packs={list.data || []}
              title={screen}
              onOpen={open}
              onCreate={() => setCreateOpen(true)}
              onDemo={() =>
                run(async () => {
                  const r = await post<{ id: string }>("/demo");
                  open(r.id);
                }, "Labeled demo created; evidence mapping queued")
              }
            />
          )
        ) : screen === "Settings" ? (
          <div className="page stack">
            <div className="kicker">System</div>
            <h1>Workspace settings</h1>
            <div className="asset-card">
              <h4>Execution providers</h4>
              <p>
                Generation: <b>{health.data?.provider || "Unavailable"}</b>
              </p>
              <p>
                Authentication: <b>{health.data?.auth || "Unavailable"}</b>
              </p>
              <p>
                Video: <b>Mock workflow — no MP4</b>
              </p>
              <p className="muted">
                Provider keys and database credentials are configured on the
                server, never in this browser.
              </p>
            </div>
            <Button
              onClick={() => {
                void signOut().catch((e) => setError((e as Error).message));
              }}
            >
              Sign out
            </Button>
          </div>
        ) : packQuery.isLoading ? (
          <Skeleton />
        ) : !pack ? (
          <div className="page">
            <Empty title="Select a learning pack">
              Open a pack from the dashboard, or create one to begin.
            </Empty>
            <Button onClick={() => navigate("Dashboard")}>
              Go to dashboard
            </Button>
          </div>
        ) : (
          <>
            {screen === "Overview" && (
              <Overview pack={pack} run={run} navigate={navigate} />
            )}
            {screen === "Sources" && (
              <Sources
                pack={pack}
                run={run}
                refresh={refresh}
                viewEvidence={setEvidence}
              />
            )}
            {screen === "Explanation" && (
              <AssetEditor
                pack={pack}
                title="Explanation"
                assets={pack.assets.filter((a) => a.slot === "explanation")}
                run={run}
                onApprove={setReview}
                onEvidence={setEvidence}
              />
            )}
            {screen === "Assessment" && (
              <AssetEditor
                pack={pack}
                title="Assessment"
                assets={pack.assets.filter((a) =>
                  a.slot.startsWith("assessment"),
                )}
                run={run}
                onApprove={setReview}
                onEvidence={setEvidence}
              />
            )}
            {screen === "Quiz" && (
              <AssetEditor
                pack={pack}
                title="Quiz"
                quiz
                assets={pack.assets
                  .filter((a) => a.slot.startsWith("quiz"))
                  .sort((a, b) => a.slot.localeCompare(b.slot))}
                run={run}
                onApprove={setReview}
                onEvidence={setEvidence}
              />
            )}
            {screen === "Answer Key" && <AnswerKey pack={pack} />}
            {screen === "Exam Focus" && (
              <>
                <AssetEditor
                  pack={pack}
                  title="Exam focus"
                  assets={pack.assets.filter((a) => a.slot === "exam_focus")}
                  run={run}
                  onApprove={setReview}
                  onEvidence={setEvidence}
                />
                <div className="page">
                  <h4>Verified previous-year questions</h4>
                  <p className="muted">
                    No verified PYQs available. Upload attributed question-bank
                    material; historical exam questions are never fabricated.
                  </p>
                </div>
              </>
            )}
            {screen === "AI Teacher" && (
              <VideoWorkflow
                pack={pack}
                script={pack.assets.find((a) => a.slot === "video_script")}
                onApprove={setReview}
                run={run}
              />
            )}
            {screen === "Resources" && <Resources pack={pack} run={run} />}
            {screen === "Versions" && <Versions pack={pack} />}
            {screen === "Validation" && <Validation pack={pack} />}
          </>
        )}
      </Shell>
      <CreatePack
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          open(id, "Sources");
          void qc.invalidateQueries({ queryKey: ["packs"] });
        }}
      />
      {pack && (
        <EvidenceDrawer
          pack={pack}
          evidence={evidence}
          onClose={() => setEvidence(null)}
        />
      )}
      {pack && <ReviewDrawer key={pack.id} pack={pack} tab={reviewTab} onTab={setReviewTab} onClose={() => setReviewTab(null)} onEvidence={(e) => { setReviewTab(null); setEvidence(e); }} />}
      <Approval
        pack={pack}
        target={review}
        onClose={() => setReview(null)}
        busy={busy}
        onConfirm={async (note) => {
          setBusy(true);
          setError("");
          try {
            await post(
              review === "pack"
                ? `/packs/${pid}/approve`
                : `/assets/${(review as Asset).id}/approve`,
              {
                note,
                ...(review === "pack"
                  ? { expected_revision: reviewRevision }
                  : { expected_version: (review as Asset).version }),
              },
            );
            setReview(null);
            refresh();
            setToast("Approved version locked. Classroom publication is a separate step.");
          } catch (e) {
            setError((e as Error).message);
            setReview(null);
          } finally {
            setBusy(false);
          }
        }}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
