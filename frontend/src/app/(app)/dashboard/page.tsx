"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";

interface DashboardResponse {
  success: boolean;
  role: string;
  data: Record<string, any>;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-sm text-text/60">{label}</p>
      <p className="text-2xl font-semibold text-text mt-1">{value}</p>
    </div>
  );
}

function formatLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardResponse>("/dashboard");
      return data;
    },
  });

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Welcome, {user?.first_name}</h2>
      <p className="text-text/60 text-sm mb-6">Here's what's happening today.</p>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {isError && (
        <div className="bg-card border border-border rounded-lg p-6 text-sm text-text/60">
          Couldn't load your dashboard data. Try refreshing the page.
        </div>
      )}

      {data?.data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(data.data).map(([key, value]) => {
            // Skip nested arrays/objects (e.g. "children" list) — those need
            // a richer widget than a stat card; show only scalar values here.
            if (typeof value === "object" && value !== null) return null;
            return <StatCard key={key} label={formatLabel(key)} value={value as string | number} />;
          })}
        </div>
      )}

      {data?.data?.children && Array.isArray(data.data.children) && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-text/70 mb-2">Your Children</h3>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {data.data.children.length === 0 ? (
              <p className="p-4 text-sm text-text/50">No children linked to your account yet.</p>
            ) : (
              data.data.children.map((c: any) => (
                <div key={c.id} className="p-4 text-sm text-text">{c.name}</div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
