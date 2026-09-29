"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LessonFoundryLogo } from "@/components/icons/brand";
import { hostedAuth, supabase, accessToken } from "@/lib/auth";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [intent, setIntent] = useState<"teacher" | "student">("teacher");

  useEffect(() => {
    accessToken().then((t) => {
      if (t) {
        api<{ role?: string }>("/me")
          .then((u) => router.replace(u.role === "student" ? "/student" : "/teacher"))
          .catch(() => {});
      }
    });
  }, [router]);

  async function handleGoogle() {
    if (!hostedAuth) {
      setError("Google login requires Supabase configuration.");
      return;
    }
    setBusy(true);
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (error) setError(error.message);
    setBusy(false);
  }

  async function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const result = await supabase().auth.signInWithPassword({
        email: String(fd.get("email") || ""),
        password: String(fd.get("password") || ""),
      });
      if (result.error || !result.data.session) throw result.error || new Error("Session was not created");
      const user = await api<{ role?: string }>("/me");
      router.replace(user.role === "student" ? "/student" : "/teacher");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLocal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const token = String(fd.get("token") || "").trim();
    try {
      sessionStorage.setItem("lf-token", token);
      const u = await api<{ role?: string }>("/me");
      router.replace(u.role === "student" ? "/student" : "/teacher");
    } catch (err) {
      sessionStorage.removeItem("lf-token");
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page v5-login">
      <aside className="login-story">
        <div className="kicker">LessonFoundry</div>
        <div><h1>Generation<br />with control.</h1><p>Trusted sources. Traceable learning. Your approval.</p></div>
        <div className="row"><span>Sources</span><span>Evidence</span><span>Review</span><span>Learning</span></div>
      </aside>
      <div className="login-card">
        <div className="brand" style={{ padding: 0, gap: 10, borderBottom: "none" }}>
          <LessonFoundryLogo height={28} />
        </div>
        <p className="login-tagline">Build. Verify. Teach. Learn.</p>

        {hostedAuth ? (
          <>
            <button className="btn btn-primary btn-block" onClick={handleGoogle} disabled={busy}>
              Continue with Google
            </button>
            <div className="muted" style={{ textAlign: "center" }}>or</div>
            <form className="stack" onSubmit={handlePassword}>
              <label>Email<input className="input" name="email" type="email" autoComplete="username" required /></label>
              <label>Password<input className="input" name="password" type="password" autoComplete="current-password" required /></label>
              <button className="btn btn-secondary btn-block" type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in with email"}
              </button>
            </form>
            <div className="login-role-selector">
              <span className="muted">I am a…</span>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className={`btn ${intent === "teacher" ? "btn-secondary" : "btn-ghost"}`}
                  onClick={() => setIntent("teacher")}
                >Teacher</button>
                <button
                  className={`btn ${intent === "student" ? "btn-secondary" : "btn-ghost"}`}
                  onClick={() => setIntent("student")}
                >Student</button>
              </div>
              <small className="muted">Role is confirmed by your account, not this selection.</small>
            </div>
          </>
        ) : (
          <form className="stack" onSubmit={handleLocal}>
            <div className="notice">
              Local development mode. Google OAuth requires Supabase configuration.
            </div>
            <label>
              Token
              <input className="input" name="token" type="password" required
                defaultValue="local-development-only" />
            </label>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? "Connecting…" : "Sign in →"}
            </button>
          </form>
        )}

        {error && <div className="alert" role="alert">{error}</div>}
      </div>
    </div>
  );
}
