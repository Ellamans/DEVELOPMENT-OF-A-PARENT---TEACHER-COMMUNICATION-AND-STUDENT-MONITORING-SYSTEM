"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, User } from "lucide-react";
import clsx from "clsx";

interface Child {
  id: string;
  full_name: string;
  admission_number: string;
  status: string;
}

interface ChildActivity {
  student: { id: string; full_name: string; admission_number: string; status: string };
  attendance_rate_last_30_records: number | null;
  attendance: { date: string; status: string; remarks: string | null }[];
  behaviour: { category: string; description: string; severity: string; recorded_at: string; status: string }[];
}

export default function MyChildrenPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ["my-children"],
    queryFn: async () => {
      const { data } = await apiClient.get("/parents/me/children");
      return data.data as Child[];
    },
  });

  const activeId = selectedId || children?.[0]?.id || null;

  const { data: activity, isLoading: loadingActivity } = useQuery({
    queryKey: ["my-child-activity", activeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/parents/me/children/${activeId}/activity`);
      return data.data as ChildActivity;
    },
    enabled: !!activeId,
  });

  if (loadingChildren) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!children?.length) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-text mb-2">My Children</h2>
        <div className="bg-card border border-border rounded-lg p-6 text-sm text-text/60">
          No children are linked to your account yet. Contact the school administrator to have your
          child(ren) linked to your parent profile.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-4">My Children</h2>

      {children.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm border",
                activeId === c.id ? "bg-primary text-white border-primary" : "border-border text-text/70 hover:bg-border/20"
              )}
            >
              <User className="h-3.5 w-3.5" />
              {c.full_name}
            </button>
          ))}
        </div>
      )}

      {loadingActivity ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : activity ? (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-medium text-text mb-1">{activity.student.full_name}</h3>
            <p className="text-sm text-text/60">
              Admission No. {activity.student.admission_number} · Status: <span className="capitalize">{activity.student.status}</span>
            </p>
            {activity.attendance_rate_last_30_records !== null && (
              <p className="text-sm text-text/60 mt-1">
                Attendance rate (last {activity.attendance.length} records): {activity.attendance_rate_last_30_records}%
              </p>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-text/70 mb-2">Recent Attendance</h4>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {!activity.attendance.length ? (
                <p className="p-4 text-sm text-text/50">No attendance records yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-border/20 text-text/70 text-left">
                    <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Remarks</th></tr>
                  </thead>
                  <tbody>
                    {activity.attendance.map((a, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-2">{a.date}</td>
                        <td className="px-4 py-2 capitalize">{a.status}</td>
                        <td className="px-4 py-2 text-text/60">{a.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-text/70 mb-2">Recent Behaviour Records</h4>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {!activity.behaviour.length ? (
                <p className="p-4 text-sm text-text/50">No behaviour records yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {activity.behaviour.map((b, i) => (
                    <li key={i} className="p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text capitalize">{b.category.replace(/_/g, " ")}</span>
                        <span className="text-xs text-text/50 capitalize">{b.severity}</span>
                      </div>
                      <p className="text-text/60 mt-1">{b.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
