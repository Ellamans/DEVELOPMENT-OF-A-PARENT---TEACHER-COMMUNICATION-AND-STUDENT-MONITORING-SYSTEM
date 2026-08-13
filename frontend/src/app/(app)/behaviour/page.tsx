"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface BehaviourRecord {
  id: string;
  student_id: string;
  category: string;
  description: string;
  severity: string;
  follow_up_action: string | null;
  parent_notified: boolean;
  status: string;
  created_at: string;
}

const CATEGORIES = [
  "excellent_conduct", "leadership", "respect", "teamwork", "homework_completion", "punctuality",
  "neatness", "discipline", "bullying", "fighting", "late_coming", "noise_making", "cheating",
  "absenteeism", "other",
];

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  high: "bg-red-500/10 text-red-600",
};

const POSITIVE_CATEGORIES = new Set(["excellent_conduct", "leadership", "respect", "teamwork", "homework_completion", "punctuality", "neatness"]);

function AddRecordModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    student_id: "", category: "respect", description: "", severity: "low",
    follow_up_action: "", parent_notified: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.student_id.trim() || !form.description.trim()) {
      toast.error("Student ID and description are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/behaviour/records", { ...form, follow_up_action: form.follow_up_action || null });
      toast.success("Behaviour record added.");
      queryClient.invalidateQueries({ queryKey: ["behaviour-records"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't add this record.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Add Behaviour Record</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Student ID *</label>
            <input
              value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              placeholder="Paste the student's ID from the Students page"
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Category *</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
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
          <div>
            <label className="block text-sm font-medium text-text mb-1">Follow-up action</label>
            <input
              value={form.follow_up_action}
              onChange={(e) => setForm({ ...form, follow_up_action: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text/80">
            <input
              type="checkbox"
              checked={form.parent_notified}
              onChange={(e) => setForm({ ...form, parent_notified: e.target.checked })}
            />
            Parent notified
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60 mt-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add Record
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BehaviourPage() {
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["behaviour-records", category, page],
    queryFn: async () => {
      const { data } = await apiClient.get("/behaviour/records", { params: { category: category || undefined, page, page_size: 20 } });
      return data as { data: BehaviourRecord[]; pagination: { total: number; page: number; page_size: number } };
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-text">Behaviour Records</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Record
        </button>
      </div>

      <div className="mb-4">
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="rounded border border-border bg-card px-3 py-2 text-sm text-text">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data?.data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">No behaviour records yet.</div>
      ) : (
        <div className="space-y-2">
          {data.data.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                      POSITIVE_CATEGORIES.has(r.category) ? "bg-green-500/10 text-green-600" : "bg-border text-text/60"
                    )}
                  >
                    {r.category.replace(/_/g, " ")}
                  </span>
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", SEVERITY_COLORS[r.severity])}>
                    {r.severity}
                  </span>
                  {r.parent_notified && <span className="text-xs text-text/40">Parent notified</span>}
                </div>
                <span className="text-xs text-text/50">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-text/80 mt-2">{r.description}</p>
              {r.follow_up_action && <p className="text-xs text-text/50 mt-1">Follow-up: {r.follow_up_action}</p>}
            </div>
          ))}
        </div>
      )}

      {data?.pagination && data.pagination.total > data.pagination.page_size && (
        <div className="flex justify-end gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm rounded border border-border disabled:opacity-40">Previous</button>
          <button disabled={page * data.pagination.page_size >= data.pagination.total} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm rounded border border-border disabled:opacity-40">Next</button>
        </div>
      )}

      {showAddModal && <AddRecordModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
