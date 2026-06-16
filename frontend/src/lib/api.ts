// Cliente HTTP mínimo hacia la API de Aura.
// En Server Components se ejecuta servidor-a-servidor (sin CORS).

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions extends RequestInit {
  // Segundos de revalidación de la caché de Next (ISR). 0 = sin caché.
  revalidate?: number;
}

export async function apiFetch<T>(
  path: string,
  { revalidate = 60, ...init }: ApiOptions = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
    next: { revalidate },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}
