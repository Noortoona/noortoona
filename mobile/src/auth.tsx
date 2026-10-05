import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

export type Role = "admin" | "supervisor" | "customer" | "partner";
export type User = { id: string; name: string; email: string; phone?: string; role: Role; status: string };

type AuthContextValue = {
  loading: boolean;
  user: User | null;
  token: string | null;
  requestOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string, name?: string): Promise<void>;
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

  async function requestOtp(phone: string) {
    await api("/api/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone })
    });
  }

  async function verifyOtp(phone: string, code: string, name?: string) {
    const data = await api<{ token: string; user: User }>("/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code, name })
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

  const value = useMemo(() => ({ loading, user, token, requestOtp, verifyOtp, signOut }), [loading, user, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
