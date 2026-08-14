"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, X, School, Trash2, Link2 } from "lucide-react";
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

interface TeacherDetail {
  id: string;
  employee_id: string;
  qualification: string | null;
  employment_status: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  subjects: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  class_teacher_of: { id: string; name: string }[];
}

interface SchoolClass {
  id: string;
  name: string;
  level: string;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
}

interface SubjectRow {
  id: string;
  name: string;
  code: string | null;
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
    staleTime: 0,
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
      // Send both identifiers the backend accepts (Teacher profile id and the
      // linked User id) so this works no matter which one it resolves against.
      await apiClient.post(`/school-setup/classes/${classId}/assign-teacher`, {
        teacher_id: teacher.id,
        teacher_user_id: teacher.user_id,
      });
      toast.success(`${teacher.full_name || "Teacher"} is now the class teacher for ${selectedClass?.name}.`);
      queryClient.invalidateQueries({ queryKey: ["school-classes"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
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
            Assign {teacher.full_name || "this teacher"} to a Class
          </h3>
          <button onClick={onClose} className="text-text/50 hover:text-text"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-xs text-text/50 mb-4">
          This makes {teacher.full_name || "this teacher"} the class teacher for the selected class — e.g. "Teacher 1 → JSS 1".
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
              Assigning {teacher.full_name || "this teacher"} will replace them.
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

function ManageTeacherModal({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [subjectId, setSubjectId] = useState("");
  const [isAssigningSubject, setIsAssigningSubject] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["teacher-detail", teacher.id],
    queryFn: async () => (await apiClient.get(`/teachers/${teacher.id}`)).data.data as TeacherDetail,
  });

  const subjectsQuery = useQuery({
    queryKey: ["school-subjects"],
    queryFn: async () => (await apiClient.get("/school-setup/subjects")).data.data as SubjectRow[],
  });

  const assignedSubjectIds = new Set((detailQuery.data?.subjects || []).map((s) => s.id));
  const availableSubjects = (subjectsQuery.data || []).filter((s) => !assignedSubjectIds.has(s.id));

  async function handleAssignSubject() {
    if (!subjectId) return;
    setIsAssigningSubject(true);
    try {
      await apiClient.post(`/teachers/${teacher.id}/subjects`, { subject_id: subjectId });
      toast.success("Subject assigned.");
      setSubjectId("");
      queryClient.invalidateQueries({ queryKey: ["teacher-detail", teacher.id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't assign this subject.");
    } finally {
      setIsAssigningSubject(false);
    }
  }

  const detail = detailQuery.data;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-lg p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">
            {detail?.full_name || teacher.full_name || "Teacher Profile"}
          </h3>
          <button onClick={onClose} className="text-text/50 hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        {detailQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : !detail ? (
          <p className="text-sm text-text/50">Couldn't load this teacher's profile.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
              <div>
                <div className="text-text/40 text-xs">Full name</div>
                <div className="text-text font-medium">{detail.full_name || "—"}</div>
              </div>
              <div>
                <div className="text-text/40 text-xs">Email</div>
                <div className="text-text font-medium">{detail.email || "—"}</div>
              </div>
              <div>
                <div className="text-text/40 text-xs">Employee ID</div>
                <div className="text-text font-medium">{detail.employee_id}</div>
              </div>
              <div>
                <div className="text-text/40 text-xs">Status</div>
                <StatusBadge status={detail.employment_status} />
              </div>
              <div className="col-span-2">
                <div className="text-text/40 text-xs">Qualification</div>
                <div className="text-text font-medium">{detail.qualification || "—"}</div>
              </div>
            </div>

            <div className="mb-5">
              <h4 className="text-sm font-medium text-text mb-2">Class teacher of</h4>
              {detail.class_teacher_of.length ? (
                <ul className="space-y-1">
                  {detail.class_teacher_of.map((c) => (
                    <li key={c.id} className="text-sm bg-background border border-border rounded px-3 py-2">
                      {c.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text/50">Not the class teacher for any class yet.</p>
              )}
            </div>

            <div className="mb-5">
              <h4 className="text-sm font-medium text-text mb-2">Classes taught</h4>
              {detail.classes.length ? (
                <ul className="flex flex-wrap gap-2">
                  {detail.classes.map((c) => (
                    <li key={c.id} className="text-xs bg-background border border-border rounded-full px-2.5 py-1">
                      {c.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text/50">No classes linked yet.</p>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-text mb-2">Subjects</h4>
              {detail.subjects.length ? (
                <ul className="flex flex-wrap gap-2 mb-3">
                  {detail.subjects.map((s) => (
                    <li key={s.id} className="text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1">
                      {s.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text/50 mb-3">No subjects assigned yet.</p>
              )}

              <div className="flex gap-2">
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="flex-1 rounded border border-border bg-background px-2 py-2 text-sm text-text"
                >
                  <option value="">Select a subject to add...</option>
                  {availableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleAssignSubject}
                  disabled={!subjectId || isAssigningSubject}
                  className="flex items-center gap-1 text-xs bg-primary text-white px-3 py-2 rounded font-medium hover:opacity-90 disabled:opacity-50"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {isAssigningSubject ? "Adding..." : "Add"}
                </button>
              </div>
              {!availableSubjects.length && subjectsQuery.data?.length ? (
                <p className="text-xs text-text/40 mt-2">All subjects are already assigned.</p>
              ) : null}
              {!subjectsQuery.data?.length && (
                <p className="text-xs text-text/40 mt-2">
                  No subjects yet — create one first under School Setup → Subjects.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function TeachersPage() {
  const [page, setPage] = useState(1);
  const [assigningTeacher, setAssigningTeacher] = useState<Teacher | null>(null);
  const [managingTeacher, setManagingTeacher] = useState<Teacher | null>(null);
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
    if (!confirm(`Delete ${teacher.full_name || "this teacher"}? This can't be undone.`)) return;
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
                    {t.full_name || <span className="text-text/40 italic font-normal">No name on file</span>}
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
                        onClick={() => setManagingTeacher(t)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Manage
                      </button>
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
      {managingTeacher && (
        <ManageTeacherModal teacher={managingTeacher} onClose={() => setManagingTeacher(null)} />
      )}
    </div>
  );
}
