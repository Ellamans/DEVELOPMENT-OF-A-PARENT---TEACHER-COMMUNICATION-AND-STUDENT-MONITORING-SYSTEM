"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, X, Users2, FileText } from "lucide-react";
import { toast } from "sonner";

interface PTAMeeting {
  id: string;
  title: string;
  scheduled_at: string;
  venue: string | null;
  agenda: string | null;
}
interface PTAMinutesEntry {
  id: string;
  content: string;
  action_items: string | null;
  created_at: string;
}

function NewPTAMeetingModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", scheduled_at: "", venue: "", agenda: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.scheduled_at) {
      toast.error("Title and date/time are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/pta/meetings", {
        ...form, scheduled_at: new Date(form.scheduled_at).toISOString(),
        venue: form.venue || null, agenda: form.agenda || null,
      });
      toast.success("PTA meeting scheduled.");
      queryClient.invalidateQueries({ queryKey: ["pta-meetings"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't schedule this meeting.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Schedule PTA Meeting</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" required />
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
            <label className="block text-sm font-medium text-text mb-1">Agenda</label>
            <textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={2} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60 mt-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Schedule Meeting
          </button>
        </form>
      </div>
    </div>
  );
}

function MinutesPanel({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pta-minutes", meetingId],
    queryFn: async () => (await apiClient.get(`/pta/meetings/${meetingId}/minutes`)).data.data as PTAMinutesEntry[],
  });

  async function record(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("Minutes content is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post(`/pta/meetings/${meetingId}/minutes`, { content, action_items: actionItems || null });
      toast.success("Minutes recorded.");
      setContent("");
      setActionItems("");
      queryClient.invalidateQueries({ queryKey: ["pta-minutes", meetingId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't record minutes.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text flex items-center gap-2"><FileText className="h-4 w-4" /> Minutes</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text"><X className="h-5 w-5" /></button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !data?.length ? (
          <p className="text-sm text-text/50 mb-4">No minutes recorded yet for this meeting.</p>
        ) : (
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {data.map((m) => (
              <div key={m.id} className="bg-background border border-border rounded p-3 text-sm">
                <p className="text-text/80">{m.content}</p>
                {m.action_items && <p className="text-xs text-text/50 mt-1">Action items: {m.action_items}</p>}
                <p className="text-xs text-text/30 mt-1">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={record} className="space-y-3 border-t border-border pt-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">New minutes entry</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Action items</label>
            <input value={actionItems} onChange={(e) => setActionItems(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Record Minutes
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PTAPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [minutesFor, setMinutesFor] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pta-meetings"],
    queryFn: async () => (await apiClient.get("/pta/meetings")).data.data as PTAMeeting[],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">PTA Meetings</h2>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Schedule Meeting
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm flex flex-col items-center gap-2">
          <Users2 className="h-6 w-6 text-text/30" />
          No PTA meetings scheduled.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((m) => (
            <div key={m.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium text-text text-sm">{m.title}</p>
                  <p className="text-xs text-text/50">{new Date(m.scheduled_at).toLocaleString()}{m.venue && ` · ${m.venue}`}</p>
                  {m.agenda && <p className="text-sm text-text/70 mt-1">{m.agenda}</p>}
                </div>
                <button onClick={() => setMinutesFor(m.id)} className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0">
                  <FileText className="h-3 w-3" /> Minutes
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && <NewPTAMeetingModal onClose={() => setShowAddModal(false)} />}
      {minutesFor && <MinutesPanel meetingId={minutesFor} onClose={() => setMinutesFor(null)} />}
    </div>
  );
}
