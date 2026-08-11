"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "@/lib/constants";

interface User {
  id: number;
  email: string;
  role: string;
  full_name?: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (role: string) => boolean;
  getHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("wf_token");
    const refresh = localStorage.getItem("wf_refresh");
    let restored = false;
    const restoreSession = async () => {
      if (!saved) return;
      const me = await fetch(api("/api/v1/auth/me"), { headers: { Authorization: `Bearer ${saved}` } });
      if (me.ok) {
        setToken(saved);
        setUser(await me.json());
        restored = true;
        return;
      }
      if (!refresh) return;
      const renewed = await fetch(api("/api/v1/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!renewed.ok) return;
      const data = await renewed.json();
      localStorage.setItem("wf_token", data.access_token);
      localStorage.setItem("wf_refresh", data.refresh_token);
      setToken(data.access_token);
      setUser(data.user);
      restored = true;
    };
    restoreSession()
      .catch(() => undefined)
      .finally(() => {
        if (!restored) {
          localStorage.removeItem("wf_token");
          localStorage.removeItem("wf_refresh");
        }
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch(api("/api/v1/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.detail || "Login failed");
    }
    const data = await r.json();
    localStorage.setItem("wf_token", data.access_token);
    localStorage.setItem("wf_refresh", data.refresh_token);
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("wf_token");
    localStorage.removeItem("wf_refresh");
    setToken(null);
    setUser(null);
  }, []);

  const hasRole = useCallback((role: string) => user?.role === role, [user]);

  const getHeaders = useCallback(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
        hasRole,
        getHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
