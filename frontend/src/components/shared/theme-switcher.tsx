"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import clsx from "clsx";

const OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-1 bg-border/30 rounded-full p-1">
      {OPTIONS.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={clsx(
            "p-1.5 rounded-full transition-colors",
            theme === value ? "bg-primary text-white" : "text-text/60 hover:text-text"
          )}
          aria-label={`${value} theme`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
