"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, ScrollText } from "lucide-react";
import clsx from "clsx";

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  details: string | null;
  status: string;
  created_at: string;
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: async () => {
      const { data } = await apiClient.get("/audit-logs", { params: { page, page_size: 50 } });
      return data as { data: AuditLogEntry[]; pagination: { total: number; page: number; page_size: number } };
    },
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ScrollText className="h-5 w-5 text-text/60" />
        <h2 className="text-xl font-semibold text-text">Audit Log</h2>
      </div>
      <p className="text-sm text-text/60 mb-4">
        A record of sensitive actions across the system. Visible to super admins and school administrators only.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data?.data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">No audit activity recorded yet.</div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-border/20 text-text/70 text-left">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-3 text-xs text-text/60 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize">{l.module}</td>
                  <td className="px-4 py-3">{l.action}</td>
                  <td className="px-4 py-3">
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", l.status === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600")}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text/60 text-xs">{l.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && data.pagination.total > data.pagination.page_size && (
        <div className="flex justify-end gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm rounded border border-border disabled:opacity-40">Previous</button>
          <button disabled={page * data.pagination.page_size >= data.pagination.total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm rounded border border-border disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
