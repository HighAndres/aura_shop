// Cliente de autenticación (navegador).
// El ACCESS token se guarda en localStorage; el REFRESH vive en una cookie
// httpOnly (no accesible a JS) que el navegador envía a /auth/* con credentials.

import type { Usuario } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const ACCESS_KEY = "aura_access_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

function setAccess(token: string) {
  window.localStorage.setItem(ACCESS_KEY, token);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    /* sin cuerpo */
  }
  return res.statusText;
}

/** Login con email + contraseña (OAuth2 password flow: form-urlencoded). */
export async function login(email: string, password: string): Promise<void> {
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    credentials: "include", // recibe la cookie httpOnly del refresh
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  setAccess(data.access_token);
}

export async function register(
  email: string,
  password: string,
  nombre_completo?: string,
): Promise<void> {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, nombre_completo }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function forgotPassword(email: string): Promise<void> {
  // Respuesta genérica (no revela si el correo existe).
  await fetch(`${API}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

/** Renueva el access usando la cookie de refresh. Devuelve true si lo logró. */
async function refresh(): Promise<boolean> {
  const res = await fetch(`${API}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = await res.json();
  setAccess(data.access_token);
  return true;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
  } catch {
    /* aunque falle la red, limpiamos local */
  }
  clearTokens();
}

/** Devuelve el usuario actual; si el access expiró, intenta refrescar una vez. */
export async function me(): Promise<Usuario | null> {
  const token = getAccessToken();
  // Sin access pero quizá haya cookie de refresh: intenta refrescar.
  if (!token) {
    if (!(await refresh())) return null;
  }
  let res = await fetch(`${API}/users/me`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (res.status === 401 && (await refresh())) {
    res = await fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
  }
  if (!res.ok) {
    clearTokens();
    return null;
  }
  return res.json() as Promise<Usuario>;
}
