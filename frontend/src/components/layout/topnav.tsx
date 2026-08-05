"use client";

import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { useAuth } from "@/context/auth-context";

export function TopNav({ title }: { title: string }) {
  const { user } = useAuth();
  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <h1 className="text-lg font-semibold text-text">{title}</h1>
      <div className="flex items-center gap-4">
        <ThemeSwitcher />
        <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
          {user?.first_name?.[0]?.toUpperCase() ?? "?"}
        </div>
      </div>
    </header>
  );
}
