import { getAccessToken, tryRefresh } from "@/lib/auth-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

export class AdminApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

function parseError(body: unknown): string {
  const d = (body as Record<string, unknown>)?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((e: { msg?: string; loc?: string[] }) =>
        e.msg
          ? `${(e.loc ?? []).slice(-1).join(".")}: ${e.msg}`
          : JSON.stringify(e),
      )
      .join("; ");
  }
  if (d) return JSON.stringify(d);
  return "";
}

async function doFetch(path: string, init: RequestInit, token: string): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let token = getAccessToken();
  if (!token) throw new AdminApiError(401, "No autenticado");

  let res = await doFetch(path, init, token);

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      token = getAccessToken();
      if (token) {
        res = await doFetch(path, init, token);
      }
    }
    if (!token || res.status === 401) {
      throw new AdminApiError(401, "Sesión expirada, inicia sesión de nuevo");
    }
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = parseError(await res.json()) || detail;
    } catch {
      /* sin cuerpo */
    }
    throw new AdminApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}
