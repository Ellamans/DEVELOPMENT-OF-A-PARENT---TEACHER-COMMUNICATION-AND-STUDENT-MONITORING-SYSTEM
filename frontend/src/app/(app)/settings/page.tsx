"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useTheme } from "@/context/theme-context";
import { useAuth } from "@/context/auth-context";
import { Loader2, Sun, Moon, Monitor } from "lucide-react";
import clsx from "clsx";

interface FeatureFlag {
  key: string;
  label: string;
  is_enabled: boolean;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { hasRole } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const { data } = await apiClient.get("/settings/feature-flags");
      return data as { data: FeatureFlag[] };
    },
    enabled: hasRole("super_admin", "school_administrator"),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text mb-1">Settings</h2>
        <p className="text-text/60 text-sm">Your preferences and system configuration.</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-sm font-medium text-text mb-3">Theme</h3>
        <div className="flex gap-2">
          {[
            { value: "light" as const, icon: Sun, label: "Light" },
            { value: "dark" as const, icon: Moon, label: "Dark" },
            { value: "system" as const, icon: Monitor, label: "System" },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={clsx(
                "flex items-center gap-2 rounded border px-3 py-2 text-sm",
                theme === value ? "border-primary bg-primary/10 text-primary" : "border-border text-text/70"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {hasRole("super_admin", "school_administrator") && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-text mb-3">Feature Flags</h3>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : !data?.data?.length ? (
            <p className="text-sm text-text/50">No feature flags configured yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {data.data.map((flag) => (
                <div key={flag.key} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-text">{flag.label}</span>
                  <span className={flag.is_enabled ? "text-green-600" : "text-text/40"}>
                    {flag.is_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
