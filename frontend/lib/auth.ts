"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let instance: SupabaseClient | null = null;
export const hostedAuth = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
export function supabase(): SupabaseClient {
  if (!instance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
      throw new Error(
        "Supabase public URL and anon key must both be configured.",
      );
    instance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return instance;
}
export async function accessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!hostedAuth) return sessionStorage.getItem("lf-token");
  const { data, error } = await supabase().auth.getSession();
  if (error) throw new Error("Session could not be restored. Sign in again.");
  return data.session?.access_token ?? null;
}
export async function signOut(): Promise<void> {
  if (hostedAuth) {
    const { error } = await supabase().auth.signOut({ scope: "local" });
    if (error)
      throw new Error(
        "Sign out could not be completed. Retry while connected.",
      );
  }
  sessionStorage.removeItem("lf-token");
  localStorage.removeItem("lf-pack");
  window.dispatchEvent(new Event("lf-signed-out"));
}
