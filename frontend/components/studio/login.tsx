"use client";
import { useState } from "react";
import { LessonFoundryLogo } from "@/components/icons/brand";
import { hostedAuth, supabase } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
export function Login({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hosted = hostedAuth;
  return (
    <div className="login stack">
      <div className="brand" style={{ padding: 0, gap: 10 }}>
        <LessonFoundryLogo height={24} />
      </div>
      <div className="kicker">Teacher workspace</div>
      <h1>Generation with control.</h1>
      <p className="muted">
        Trusted sources. Traceable learning. Your approval.
      </p>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            let token = String(f.get("token") || "");
            if (hosted) {
              const r = await supabase().auth.signInWithPassword({
                email: String(f.get("email")),
                password: String(f.get("password")),
              });
              if (r.error) throw r.error;
              token = r.data.session!.access_token;
            }
            if (!hosted) sessionStorage.setItem("lf-token", token);
            await api("/packs");
            onLogin();
          } catch (err) {
            sessionStorage.removeItem("lf-token");
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {hosted ? (
          <>
            <label>
              Email
              <input
                className="input"
                type="email"
                name="email"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                className="input"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
          </>
        ) : (
          <>
            <div className="notice">
              Local development mode. Enter LOCAL_TEACHER_TOKEN from your
              backend environment. Do not deploy local authentication publicly.
            </div>
            <label>
              Teacher token
              <input
                className="input"
                name="token"
                type="password"
                required
                defaultValue="local-development-only"
                autoComplete="current-password"
              />
            </label>
          </>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        <Button type="submit" variant="default" disabled={busy}>
          {busy ? "Connecting…" : "Open teacher studio →"}
        </Button>
      </form>
    </div>
  );
}
