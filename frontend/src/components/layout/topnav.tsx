"use client";

import { Menu } from "lucide-react";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { useAuth } from "@/context/auth-context";

export function TopNav({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  const { user } = useAuth();
  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden text-text/70 hover:text-text -ml-1 p-1"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-text">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <ThemeSwitcher />
        <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
          {user?.first_name?.[0]?.toUpperCase() ?? "?"}
        </div>
      </div>
    </header>
  );
}
