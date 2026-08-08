"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, X, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface Meeting {
  id: string;
  title: string;
  meeting_type: string;
  scheduled_at: string;
  venue: string | null;
  virtual_link: string | null;
  status: string;
}

const MEETING_TYPES = ["parent_teacher", "disciplinary", "academic_review", "pta", "emergency", "staff"];

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-yellow-500/10 text-yellow-600",
  approved: "bg-green-500/10 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
  rescheduled: "bg-blue-500/10 text-blue-600",
  completed: "bg-border text-text/60",
};

function RequestMeetingModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", meeting_type: "parent_teacher", scheduled_at: "", venue: "", virtual_link: "", agenda: "", participant_ids: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.scheduled_at) {
      toast.error("Title and date/time are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/meetings", {
        ...form,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        venue: form.venue || null,
        virtual_link: form.virtual_link || null,
        agenda: form.agenda || null,
        participant_ids: form.participant_ids.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Meeting requested.");
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't request this meeting.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Request Meeting</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Type *</label>
            <select value={form.meeting_type} onChange={(e) => setForm({ ...form, meeting_type: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text">
              {MEETING_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Date & time *</label>
            <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Venue</label>
            <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Virtual link</label>
            <input value={form.virtual_link} onChange={(e) => setForm({ ...form, virtual_link: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Agenda</label>
            <textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={2} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Other participant user IDs</label>
            <input value={form.participant_ids} onChange={(e) => setForm({ ...form, participant_ids: e.target.value })} placeholder="comma-separated" className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60 mt-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Request Meeting
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => (await apiClient.get("/meetings")).data.data as Meeting[],
  });

  async function updateStatus(id: string, status: string) {
    try {
      await apiClient.patch(`/meetings/${id}/status`, { status });
      toast.success(`Meeting ${status}.`);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't update this meeting.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Meetings</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Request Meeting
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm flex flex-col items-center gap-2">
          <CalendarClock className="h-6 w-6 text-text/30" />
          No meetings scheduled.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((m) => (
            <div key={m.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium text-text text-sm">{m.title}</p>
                  <p className="text-xs text-text/50 capitalize">{m.meeting_type.replace(/_/g, " ")} · {new Date(m.scheduled_at).toLocaleString()}</p>
                  {m.venue && <p className="text-xs text-text/40 mt-0.5">{m.venue}</p>}
                </div>
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[m.status])}>{m.status}</span>
              </div>
              {m.status === "requested" && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => updateStatus(m.id, "approved")} className="text-xs text-green-600 hover:underline">Approve</button>
                  <button onClick={() => updateStatus(m.id, "rejected")} className="text-xs text-red-500 hover:underline">Reject</button>
                </div>
              )}
              {m.status === "approved" && (
                <button onClick={() => updateStatus(m.id, "completed")} className="text-xs text-primary hover:underline mt-3">Mark completed</button>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && <RequestMeetingModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
