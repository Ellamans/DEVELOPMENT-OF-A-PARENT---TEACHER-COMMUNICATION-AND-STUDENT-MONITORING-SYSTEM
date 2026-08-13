"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, X, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface Assignment {
  id: string;
  title: string;
  instructions: string | null;
  due_date: string;
  max_score: string;
  submission_type: string;
}

function CreateAssignmentModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "", instructions: "", subject_id: "", class_id: "", teacher_id: "",
    due_date: "", max_score: "100", submission_type: "file_upload",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subjectsQuery = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await apiClient.get("/school-setup/subjects")).data.data as { id: string; name: string }[],
  });
  const classesQuery = useQuery({
    queryKey: ["school-classes"],
    queryFn: async () => (await apiClient.get("/school-setup/classes")).data.data as { id: string; name: string }[],
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.subject_id || !form.class_id || !form.teacher_id || !form.due_date) {
      toast.error("Title, subject, class, teacher, and due date are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/assignments", { ...form, instructions: form.instructions || null, due_date: new Date(form.due_date).toISOString() });
      toast.success("Assignment created.");
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't create this assignment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">New Assignment</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Instructions</label>
            <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Subject *</label>
            <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text">
              <option value="">Select subject...</option>
              {subjectsQuery.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Class *</label>
            <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text">
              <option value="">Select class...</option>
              {classesQuery.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Teacher ID *</label>
            <input value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} placeholder="Paste teacher's user ID" className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Due date *</label>
            <input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Max score</label>
              <input value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Submission type</label>
              <select value={form.submission_type} onChange={(e) => setForm({ ...form, submission_type: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text">
                <option value="file_upload">File upload</option>
                <option value="text">Text</option>
                <option value="in_person">In person</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60 mt-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Assignment
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AssignmentsPage() {
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => (await apiClient.get("/assignments")).data.data as Assignment[],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Assignments</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> New Assignment
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm flex flex-col items-center gap-2">
          <ClipboardList className="h-6 w-6 text-text/30" />
          No assignments yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-text text-sm">{a.title}</p>
                <span className="text-xs text-text/50">Due {new Date(a.due_date).toLocaleString()}</span>
              </div>
              {a.instructions && <p className="text-sm text-text/70 mt-1">{a.instructions}</p>}
              <p className="text-xs text-text/40 mt-1">Max score: {a.max_score} · {a.submission_type.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>
      )}

      {showModal && <CreateAssignmentModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
