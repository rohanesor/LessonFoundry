import { accessToken } from "./auth";
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await accessToken();
  const form = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(!form ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("lf-auth-required"));
    }
    const data = await response.json().catch(() => ({
      detail: "Backend unavailable. Check API and worker processes.",
    }));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail),
    );
  }
  return response.json() as Promise<T>;
}
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
