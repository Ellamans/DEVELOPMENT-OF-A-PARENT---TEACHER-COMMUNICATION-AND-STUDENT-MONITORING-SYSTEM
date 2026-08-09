"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import clsx from "clsx";

interface Teacher {
  id: string;
  employee_id: string;
  qualification: string | null;
  employment_status: string;
  full_name: string | null;
  email: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500/10 text-green-600",
    on_leave: "bg-yellow-500/10 text-yellow-600",
    suspended: "bg-orange-500/10 text-orange-600",
    terminated: "bg-red-500/10 text-red-600",
  };
  return (
    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", colors[status] || "bg-border text-text/60")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function TeachersPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["teachers", page],
    queryFn: async () => {
      const { data } = await apiClient.get("/teachers", { params: { page, page_size: 20 } });
      return data as { data: Teacher[]; pagination: { total: number; page: number; page_size: number } };
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Teachers</h2>
      </div>
      <p className="text-sm text-text/60 mb-4">
        New teacher profiles are created from an existing user account under Users. Once created, subjects and
        classes can be assigned from a teacher's profile.
      </p>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !data?.data?.length ? (
          <div className="py-16 text-center text-text/50 text-sm">No teachers found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-border/20 text-text/70 text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Qualification</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-border/10">
                  <td className="px-4 py-3 font-medium">{t.full_name || "—"}<div className="text-xs text-text/40 font-normal">{t.email}</div></td>
                  <td className="px-4 py-3">{t.employee_id}</td>
                  <td className="px-4 py-3">{t.qualification || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.employment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data?.pagination && data.pagination.total > data.pagination.page_size && (
        <div className="flex justify-end gap-2 mt-4">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm rounded border border-border disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={page * data.pagination.page_size >= data.pagination.total}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm rounded border border-border disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
