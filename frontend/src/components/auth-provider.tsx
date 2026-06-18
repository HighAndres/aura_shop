"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useCart } from "@/components/cart-provider";
import * as auth from "@/lib/auth-client";
import { getCartToken, mergeGuestCart } from "@/lib/cart-client";
import type { Usuario } from "@/lib/types";

interface AuthContextValue {
  user: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    nombre?: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cart = useCart();
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Tras autenticarse: hereda el carrito de invitado y refresca todo.
  const afterAuth = useCallback(async () => {
    const guestToken = getCartToken();
    if (guestToken) {
      try {
        await mergeGuestCart(guestToken);
      } catch {
        /* sin carrito de invitado que fusionar */
      }
    }
    await cart.refresh();
    setUser(await auth.me());
  }, [cart]);

  const login = useCallback(
    async (email: string, password: string) => {
      await auth.login(email, password);
      await afterAuth();
    },
    [afterAuth],
  );

  const register = useCallback(
    async (email: string, password: string, nombre?: string) => {
      await auth.register(email, password, nombre);
      await auth.login(email, password);
      await afterAuth();
    },
    [afterAuth],
  );

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
    void cart.refresh();
  }, [cart]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
