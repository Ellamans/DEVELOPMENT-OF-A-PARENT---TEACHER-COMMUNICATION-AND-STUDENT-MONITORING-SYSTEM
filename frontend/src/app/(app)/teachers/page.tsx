"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, X, School, Trash2 } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";

interface Teacher {
  id: string;
  employee_id: string;
  qualification: string | null;
  employment_status: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface SchoolClass {
  id: string;
  name: string;
  level: string;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
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

function AssignClassModal({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const classesQuery = useQuery({
    queryKey: ["school-classes"],
    queryFn: async () => (await apiClient.get("/school-setup/classes")).data.data as SchoolClass[],
  });

  const selectedClass = classesQuery.data?.find((c) => c.id === classId);
  const willReplace = !!selectedClass?.class_teacher_id && selectedClass.class_teacher_id !== teacher.user_id;

  async function handleAssign() {
    if (!classId) {
      toast.error("Pick a class first.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post(`/school-setup/classes/${classId}/assign-teacher`, { teacher_id: teacher.id });
      toast.success(`${teacher.full_name} is now the class teacher for ${selectedClass?.name}.`);
      queryClient.invalidateQueries({ queryKey: ["school-classes"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't assign this class.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">
            Assign {teacher.full_name} to a Class
          </h3>
          <button onClick={onClose} className="text-text/50 hover:text-text"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-xs text-text/50 mb-4">
          This makes {teacher.full_name} the class teacher for the selected class — e.g. "Teacher 1 → JSS 1".
          Parents and students in that class will then be able to message them directly.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select class...</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {willReplace && (
            <p className="text-xs text-orange-600 bg-orange-500/10 rounded p-2">
              {selectedClass?.class_teacher_name} is currently the class teacher for {selectedClass?.name}.
              Assigning {teacher.full_name} will replace them.
            </p>
          )}

          {!classesQuery.data?.length && (
            <p className="text-xs text-text/40">
              No classes yet — create one first under School Setup → Classes.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded border border-border text-text">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={isSubmitting || !classId}
              className="flex items-center gap-2 rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Assign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeachersPage() {
  const [page, setPage] = useState(1);
  const [assigningTeacher, setAssigningTeacher] = useState<Teacher | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["teachers", page],
    queryFn: async () => {
      const { data } = await apiClient.get("/teachers", { params: { page, page_size: 20 } });
      return data as { data: Teacher[]; pagination: { total: number; page: number; page_size: number } };
    },
  });

  // Used to show each teacher's currently assigned class(es) right in the table.
  const classesQuery = useQuery({
    queryKey: ["school-classes"],
    queryFn: async () => (await apiClient.get("/school-setup/classes")).data.data as SchoolClass[],
  });

  function classesFor(userId: string) {
    return (classesQuery.data ?? []).filter((c) => c.class_teacher_id === userId);
  }

  async function handleDelete(teacher: Teacher) {
    if (!confirm(`Delete ${teacher.full_name}? This can't be undone.`)) return;
    setDeletingId(teacher.id);
    try {
      await apiClient.delete(`/teachers/${teacher.id}`);
      toast.success("Teacher deleted.");
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't delete teacher.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Teachers</h2>
      </div>
      <p className="text-sm text-text/60 mb-4">
        New teacher profiles are created from an existing user account under Users. Use "Assign to Class" below to
        make a teacher the class teacher for a class (e.g. Teacher 1 → JSS 1) — once assigned, parents and
        students in that class can message them directly.
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
                <th className="px-4 py-3">Class Teacher Of</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-border/10">
                  <td className="px-4 py-3 font-medium">
                    {t.full_name || "—"}
                    <div className="text-xs text-text/40 font-normal">{t.email}</div>
                  </td>
                  <td className="px-4 py-3">{t.employee_id}</td>
                  <td className="px-4 py-3">
                    {classesFor(t.user_id).length ? (
                      classesFor(t.user_id).map((c) => c.name).join(", ")
                    ) : (
                      <span className="text-text/40 italic">Not assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={t.employment_status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setAssigningTeacher(t)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <School className="h-3.5 w-3.5" /> Assign to Class
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        disabled={deletingId === t.id}
                        className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        {deletingId === t.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </button>
                    </div>
                  </td>
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

      {assigningTeacher && (
        <AssignClassModal teacher={assigningTeacher} onClose={() => setAssigningTeacher(null)} />
      )}
    </div>
  );
}
