// Cliente de carrito (se ejecuta en el navegador). Persiste el token de
// invitado en localStorage y lo reenvía como X-Cart-Token. Si en el futuro
// hay sesión, también manda el Authorization.

import type { Cart, CheckoutPayload, Pedido } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";
const TOKEN_KEY = "aura_cart_token";
const ACCESS_KEY = "aura_access_token";

export function getCartToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setCartToken(token: string | null) {
  if (typeof window === "undefined" || !token) return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

/** Olvida el carrito local (p. ej. tras un checkout exitoso). */
export function clearStoredCart() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = getCartToken();
  if (token) h["X-Cart-Token"] = token;
  const access =
    typeof window !== "undefined"
      ? window.localStorage.getItem(ACCESS_KEY)
      : null;
  if (access) h["Authorization"] = `Bearer ${access}`;
  return h;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : detail;
    } catch {
      /* sin cuerpo */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

async function asCart(promise: Promise<Cart>): Promise<Cart> {
  const cart = await promise;
  if (cart.token) setCartToken(cart.token);
  return cart;
}

export function fetchCart() {
  return asCart(request<Cart>("/cart"));
}

export function addToCart(sku: string, cantidad = 1) {
  return asCart(
    request<Cart>("/cart/items", {
      method: "POST",
      body: JSON.stringify({ sku, cantidad }),
    }),
  );
}

export function updateCartItem(sku: string, cantidad: number) {
  return asCart(
    request<Cart>(`/cart/items/${encodeURIComponent(sku)}`, {
      method: "PUT",
      body: JSON.stringify({ cantidad }),
    }),
  );
}

export function removeCartItem(sku: string) {
  return asCart(
    request<Cart>(`/cart/items/${encodeURIComponent(sku)}`, {
      method: "DELETE",
    }),
  );
}

export function checkout(payload: CheckoutPayload) {
  return request<Pedido>("/orders/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Fusiona el carrito de invitado (token) en el del usuario (requiere sesión). */
export function mergeGuestCart(token: string) {
  return asCart(
    request<Cart>("/cart/merge", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  );
}

export function fetchMisPedidos() {
  return request<Pedido[]>("/orders");
}
