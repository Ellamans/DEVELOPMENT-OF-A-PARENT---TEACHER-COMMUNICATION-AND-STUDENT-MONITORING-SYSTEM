"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiClient, setTokens, clearTokens } from "@/lib/api-client";

export interface AuthUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  roles: string[];
  profile_photo_url: string | null;
  status: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  async function loadUser() {
    try {
      const { data } = await apiClient.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string, rememberMe = false) {
    const { data } = await apiClient.post("/auth/login", { email, password, remember_me: rememberMe });
    setTokens(data.access_token, data.refresh_token);
    await loadUser();
    router.push("/dashboard");
  }

  async function logout() {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      clearTokens();
      setUser(null);
      router.push("/login");
    }
  }

  function hasRole(...roles: string[]) {
    if (!user) return false;
    return user.roles.some((r) => roles.includes(r));
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
