import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

export type Role = "admin" | "supervisor" | "customer";
export type User = { id: string; name: string; email: string; phone?: string; role: Role; status: string };

type AuthContextValue = {
  loading: boolean;
  user: User | null;
  token: string | null;
  signIn(email: string, password: string): Promise<void>;
  register(input: { name: string; email: string; phone?: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "hala.session.token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!saved) return;
        const result = await api<{ user: User }>("/api/auth/me", {}, saved);
        setToken(saved);
        setUser(result.user);
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function acceptSession(data: { token: string; user: User }) {
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function signIn(email: string, password: string) {
    const data = await api<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    await acceptSession(data);
  }

  async function register(input: { name: string; email: string; phone?: string; password: string }) {
    const data = await api<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });
    await acceptSession(data);
  }

  async function signOut() {
    try {
      if (token) await api("/api/auth/logout", { method: "POST" }, token);
    } finally {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  }

  const value = useMemo(() => ({ loading, user, token, signIn, register, signOut }), [loading, user, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
