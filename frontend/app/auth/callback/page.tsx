"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hostedAuth, supabase } from "@/lib/auth";
import { api } from "@/lib/api";

export default function AuthCallback() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hostedAuth) {
      router.replace("/login");
      return;
    }

    async function finalizeUser() {
      try {
        const oauthRole = sessionStorage.getItem("lf_oauth_intent");
        if (oauthRole) {
          try {
            await api("/me", {
              method: "PATCH",
              body: JSON.stringify({ role: oauthRole }),
            });
          } catch (e) {
            console.warn("Could not patch oauth role", e);
          } finally {
            sessionStorage.removeItem("lf_oauth_intent");
          }
        }
        const u = await api<{ role?: string; onboarding_completed?: boolean }>("/me");
        if (u.onboarding_completed === false) {
          router.replace("/onboarding");
        } else {
          router.replace(u.role === "student" ? "/student" : "/teacher");
        }
      } catch (err) {
        console.error("User resolution error:", err);
        setErrorMessage((err as Error).message);
      }
    }

    async function handleAuth() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error_description") || url.searchParams.get("error");

        if (error) {
          throw new Error(error);
        }

        if (code) {
          const { data, error: exchangeError } = await supabase().auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          if (data.session) {
            await finalizeUser();
            return;
          }
        }

        // Check active session if already resolved or implicit tokens
        const { data: sessionData } = await supabase().auth.getSession();
        if (sessionData.session) {
          await finalizeUser();
          return;
        }

        // Wait briefly on auth state change
        const { data: listener } = supabase().auth.onAuthStateChange(async (event, session) => {
          if (session) {
            listener.subscription.unsubscribe();
            await finalizeUser();
          }
        });

        setTimeout(() => {
          setErrorMessage("Authentication timed out. Returning to login…");
          setTimeout(() => router.replace("/login"), 3000);
        }, 8000);
      } catch (err) {
        console.error("OAuth callback error:", err);
        setErrorMessage((err as Error).message);
        setTimeout(() => router.replace("/login"), 3000);
      }
    }

    handleAuth();
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--color-bg)",
      }}
    >
      {errorMessage ? (
        <div className="card" style={{ maxWidth: 420, width: "100%", padding: 32, textAlign: "center" }}>
          <div className="kicker">Sign in error</div>
          <h3 style={{ margin: "8px 0" }}>Authentication Failed</h3>
          <p className="muted" style={{ margin: "8px 0 16px" }}>{errorMessage}</p>
          <small className="muted">Returning to login…</small>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div className="kicker" style={{ marginBottom: 12 }}>LessonFoundry</div>
          <h2>Signing in with Google…</h2>
          <p className="muted">Verifying your credentials and establishing your session.</p>
        </div>
      )}
    </div>
  );
}
