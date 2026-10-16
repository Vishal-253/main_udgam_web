// HTTP client for the Udgam backend (backend/ folder).
// - Website and API served by the SAME server (one Render service): leave VITE_API_URL unset;
//   requests go to this site's own /api/... paths.
// - API hosted separately: set VITE_API_URL to its public URL (no trailing slash).
// - Local dev: defaults to the backend's dev server on http://localhost:4000.

const configured = (import.meta.env["VITE_API_URL"] as string | undefined)
  ?.trim()
  .replace(/\/+$/, "");
export const API_URL = configured || (import.meta.env.DEV ? "http://localhost:4000" : "");

export class ApiError extends Error {}

/**
 * Calls the backend and returns its JSON body — also for 4xx/5xx answers, which carry
 * structured `{ ok: false, message }` results. Throws ApiError on network failure or a
 * non-JSON answer.
 */
export async function apiFetch<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; token?: string | null; timeoutMs?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.token) headers["authorization"] = `Bearer ${init.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : null,
      // a free-tier server waking up can take a while; don't hang forever
      signal: AbortSignal.timeout(init.timeoutMs ?? 45_000),
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.");
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(`Unexpected server response (${res.status}).`);
  }
}
