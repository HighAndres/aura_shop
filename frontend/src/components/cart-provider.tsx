"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import * as api from "@/lib/cart-client";
import type { Cart } from "@/lib/types";

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  count: number;
  add: (sku: string, cantidad?: number) => Promise<void>;
  setQty: (sku: string, cantidad: number) => Promise<void>;
  remove: (sku: string) => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setCart(await api.fetchCart());
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(async (sku: string, cantidad = 1) => {
    setCart(await api.addToCart(sku, cantidad));
  }, []);

  const setQty = useCallback(async (sku: string, cantidad: number) => {
    setCart(await api.updateCartItem(sku, cantidad));
  }, []);

  const remove = useCallback(async (sku: string) => {
    setCart(await api.removeCartItem(sku));
  }, []);

  const clear = useCallback(() => setCart(null), []);

  const count = cart?.total_items ?? 0;

  return (
    <CartContext.Provider
      value={{ cart, loading, count, add, setQty, remove, refresh, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
