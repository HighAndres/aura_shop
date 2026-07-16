"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useCart } from "@/components/cart-provider";
import * as auth from "@/lib/auth-client";
import { getCartToken, mergeGuestCart } from "@/lib/cart-client";
import type { Usuario } from "@/lib/types";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;

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
  /** Relee /users/me. Para cuando el propio usuario edita su perfil. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cart = useCart();
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const doLogout = useCallback(() => {
    auth.clearTokens();
    setUser(null);
    void cart.refresh();
  }, [cart]);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await auth.me());
    } catch {
      setUser(null);
    }
  }, []);

  // Inactivity timer: reset on user activity, logout when expired.
  useEffect(() => {
    if (!user) return;

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        doLogout();
        window.location.href = "/login";
      }, INACTIVITY_TIMEOUT_MS);
    }

    resetTimer();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, resetTimer);
      }
    };
  }, [user, doLogout]);

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

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout: doLogout, refresh: refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
