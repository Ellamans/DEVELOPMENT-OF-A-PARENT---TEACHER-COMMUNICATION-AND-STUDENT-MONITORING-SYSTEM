"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiClient } from "@/lib/api-client";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = "pps-theme-preference";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && systemDark);
  root.classList.toggle("dark", isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const cached = (window.localStorage.getItem(STORAGE_KEY) as Theme) || "system";
    setThemeState(cached);
    applyTheme(cached);
  }, []);

  async function setTheme(newTheme: Theme) {
    setThemeState(newTheme);
    applyTheme(newTheme);
    window.localStorage.setItem(STORAGE_KEY, newTheme);
    try {
      await apiClient.put("/users/me/preferences", { theme: newTheme });
    } catch {
      // Non-fatal: preference still cached locally even if the sync call fails.
    }
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
