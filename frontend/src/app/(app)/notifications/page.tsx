"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  source_module: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  info: "border-l-blue-500",
  success: "border-l-green-500",
  warning: "border-l-yellow-500",
  error: "border-l-red-500",
  critical: "border-l-red-700",
};

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", unreadOnly],
    queryFn: async () => {
      const { data } = await apiClient.get("/notifications", { params: { unread_only: unreadOnly, page_size: 50 } });
      return data as { data: Notification[]; pagination: { total: number } };
    },
  });

  async function markRead(id: string) {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error("Couldn't mark that as read.");
    }
  }

  async function markAllRead() {
    try {
      await apiClient.patch("/notifications/mark-all-read");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read.");
    } catch {
      toast.error("Couldn't mark all as read.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-text">Notifications</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text/70">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Unread only
          </label>
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data?.data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm flex flex-col items-center gap-2">
          <Bell className="h-6 w-6 text-text/30" />
          {unreadOnly ? "No unread notifications." : "No notifications yet."}
        </div>
      ) : (
        <div className="space-y-2">
          {data.data.map((n) => (
            <div
              key={n.id}
              className={clsx(
                "bg-card border border-border border-l-4 rounded-lg p-4 flex items-start justify-between gap-3",
                TYPE_COLORS[n.notification_type] || "border-l-border",
                !n.is_read && "bg-primary/5"
              )}
            >
              <div>
                <p className="font-medium text-text text-sm">{n.title}</p>
                <p className="text-sm text-text/70 mt-0.5">{n.message}</p>
                <p className="text-xs text-text/40 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                  {n.source_module && ` · ${n.source_module}`}
                </p>
              </div>
              {!n.is_read && (
                <button
                  onClick={() => markRead(n.id)}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
