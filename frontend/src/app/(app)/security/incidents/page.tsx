"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface Incident {
  id: string;
  incident_type: string;
  incident_date: string;
  incident_time: string | null;
  location: string | null;
  description: string;
  severity: string;
  status: string;
  follow_up_required: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  high: "bg-orange-500/10 text-orange-600",
  critical: "bg-red-500/10 text-red-600",
};

function ReportIncidentModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    incident_type: "",
    incident_date: new Date().toISOString().slice(0, 10),
    incident_time: "",
    location: "",
    description: "",
    severity: "low",
    follow_up_required: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.incident_type.trim() || !form.description.trim()) {
      toast.error("Incident type and description are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/incidents", {
        ...form,
        incident_time: form.incident_time || null,
        location: form.location || null,
      });
      toast.success("Incident reported.");
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't report this incident.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Report Incident</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Incident type *</label>
            <input
              value={form.incident_type}
              onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
              placeholder="e.g. fight, theft, vandalism"
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Date *</label>
              <input
                type="date"
                value={form.incident_date}
                onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Time</label>
              <input
                type="time"
                value={form.incident_time}
                onChange={(e) => setForm({ ...form, incident_time: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Severity *</label>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text/80">
            <input
              type="checkbox"
              checked={form.follow_up_required}
              onChange={(e) => setForm({ ...form, follow_up_required: e.target.checked })}
            />
            Follow-up required
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60 mt-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Report Incident
          </button>
        </form>
      </div>
    </div>
  );
}

export default function IncidentsPage() {
  const [severity, setSeverity] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["incidents", severity, statusFilter],
    queryFn: async () => {
      const { data } = await apiClient.get("/incidents", {
        params: { severity: severity || undefined, status: statusFilter || undefined },
      });
      return data as { data: Incident[] };
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-text">Security Incidents</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Report Incident
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded border border-border bg-card px-3 py-2 text-sm text-text"
        >
          <option value="">All severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-border bg-card px-3 py-2 text-sm text-text"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data?.data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm flex flex-col items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-text/30" />
          No incidents reported.
        </div>
      ) : (
        <div className="space-y-2">
          {data.data.map((i) => (
            <div key={i.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text capitalize">{i.incident_type}</span>
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", SEVERITY_COLORS[i.severity])}>
                    {i.severity}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize bg-border text-text/60">
                    {i.status.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-xs text-text/50">
                  {i.incident_date}{i.incident_time && ` · ${i.incident_time}`}
                </span>
              </div>
              <p className="text-sm text-text/80 mt-2">{i.description}</p>
              {i.location && <p className="text-xs text-text/50 mt-1">Location: {i.location}</p>}
              {i.follow_up_required && (
                <p className="text-xs text-orange-600 mt-1 font-medium">Follow-up required</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && <ReportIncidentModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
