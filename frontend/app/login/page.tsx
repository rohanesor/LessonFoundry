"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LessonFoundryLogo } from "@/components/icons/brand";
import { hostedAuth, supabase, accessToken } from "@/lib/auth";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [intent, setIntent] = useState<"teacher" | "student">("teacher");
  const routeUser = (u: { role?: string; onboarding_completed?: boolean }) =>
    router.replace(
      u.onboarding_completed === false
        ? "/onboarding"
        : u.role === "student"
          ? "/student"
          : "/teacher",
    );
  useEffect(() => {
    accessToken().then((t) => {
      if (t)
        api<{ role?: string; onboarding_completed?: boolean }>("/me")
          .then(routeUser)
          .catch(() => {});
    });
  }, [router]);
  async function google() {
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
  async function password(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (mode === "signup") {
        const pass = String(f.get("password") || "");
        if (pass.length < 8)
          throw new Error("Password must be at least 8 characters.");
        if (pass !== String(f.get("confirm") || ""))
          throw new Error("Passwords do not match.");
        const r = await supabase().auth.signUp({
          email: String(f.get("email")),
          password: pass,
          options: {
            data: { requested_role: intent, name: String(f.get("name") || "") },
          },
        });
        if (r.error) throw r.error;
        if (!r.data.session) {
          setError(
            "Account created. Check your email to confirm, then sign in.",
          );
          setMode("signin");
          return;
        }
      } else {
        const r = await supabase().auth.signInWithPassword({
          email: String(f.get("email") || ""),
          password: String(f.get("password") || ""),
        });
        if (r.error || !r.data.session)
          throw r.error || new Error("Session was not created");
      }
      routeUser(await api("/me"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function local(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      sessionStorage.setItem("lf-token", String(f.get("token") || "").trim());
      routeUser(await api("/me"));
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
        <div>
          <h1>
            Generation
            <br />
            with control.
          </h1>
          <p>Trusted sources. Traceable learning. Your approval.</p>
        </div>
        <div className="row">
          <span>Sources</span>
          <span>Evidence</span>
          <span>Review</span>
          <span>Learning</span>
        </div>
      </aside>
      <div className="login-card">
        <LessonFoundryLogo height={28} />
        <p className="login-tagline">Build. Verify. Teach. Learn.</p>
        {hostedAuth ? (
          <>
            <div className="auth-tabs">
              <button
                className={mode === "signin" ? "active" : ""}
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <button
                className={mode === "signup" ? "active" : ""}
                onClick={() => setMode("signup")}
              >
                Create account
              </button>
            </div>
            <button
              className="btn btn-primary btn-block"
              onClick={google}
              disabled={busy}
            >
              Continue with Google
            </button>
            <div className="muted" style={{ textAlign: "center" }}>
              or
            </div>
            <form className="stack" onSubmit={password}>
              {mode === "signup" && (
                <>
                  <div className="role-choice">
                    <button
                      type="button"
                      className={intent === "teacher" ? "selected" : ""}
                      onClick={() => setIntent("teacher")}
                    >
                      Teacher / Educator
                    </button>
                    <button
                      type="button"
                      className={intent === "student" ? "selected" : ""}
                      onClick={() => setIntent("student")}
                    >
                      Student / Learner
                    </button>
                  </div>
                  <label>
                    Full name
                    <input
                      className="input"
                      name="name"
                      required
                      minLength={2}
                    />
                  </label>
                </>
              )}
              <label>
                Email
                <input
                  className="input"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  className="input"
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  required
                />
              </label>
              {mode === "signup" && (
                <label>
                  Confirm password
                  <input
                    className="input"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </label>
              )}
              <button className="btn btn-secondary btn-block" disabled={busy}>
                {busy
                  ? mode === "signup"
                    ? "Creating…"
                    : "Signing in…"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in with email"}
              </button>
            </form>
          </>
        ) : (
          <form className="stack" onSubmit={local}>
            <div className="notice">Local development mode.</div>
            <label>
              Token
              <input
                className="input"
                name="token"
                type="password"
                defaultValue="local-development-only"
                required
              />
            </label>
            <button className="btn btn-primary btn-block" disabled={busy}>
              Sign in →
            </button>
          </form>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
