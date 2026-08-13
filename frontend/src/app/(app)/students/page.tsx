"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { Search, Loader2, Plus, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  status: string;
  current_class_id: string | null;
  class_name: string | null;
}

interface SchoolClass {
  id: string;
  name: string;
  level: string;
  class_teacher_name: string | null;
}

function useClassOptions() {
  return useQuery({
    queryKey: ["school-classes"],
    queryFn: async () => (await apiClient.get("/school-setup/classes")).data.data as SchoolClass[],
  });
}

function ClassField({
  classId,
  onClassChange,
  classesQuery,
}: {
  classId: string;
  onClassChange: (v: string) => void;
  classesQuery: ReturnType<typeof useClassOptions>;
}) {
  const selectedClass = classesQuery.data?.find((c) => c.id === classId);

  return (
    <div>
      <label className="block text-sm font-medium text-text mb-1">Class</label>
      <select
        value={classId}
        onChange={(e) => onClassChange(e.target.value)}
        className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Not assigned</option>
        {classesQuery.data?.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {selectedClass && (
        <p className="text-xs text-text/40 mt-1">
          Class teacher: {selectedClass.class_teacher_name || "not yet assigned"}
        </p>
      )}
    </div>
  );
}

const studentSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, "Last name is required"),
  gender: z.enum(["male", "female"]).optional(),
  admission_number: z.string().optional(),
});
type StudentForm = z.infer<typeof studentSchema>;

function AddStudentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classId, setClassId] = useState("");
  const classesQuery = useClassOptions();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StudentForm>({ resolver: zodResolver(studentSchema) });

  async function onSubmit(values: StudentForm) {
    setIsSubmitting(true);
    try {
      await apiClient.post("/students", {
        ...values,
        current_class_id: classId || null,
      });
      toast.success("Student added.");
      onCreated();
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.response?.data?.detail;
      toast.error(
        typeof detail === "string"
          ? detail
          : err?.response?.status === 403
          ? "Only school administrators can add students."
          : "Couldn't add student. Please check the form and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Add Student</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text mb-1">First name</label>
              <input
                {...register("first_name")}
                className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {errors.first_name && <p className="text-sm text-red-500 mt-1">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Last name</label>
              <input
                {...register("last_name")}
                className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {errors.last_name && <p className="text-sm text-red-500 mt-1">{errors.last_name.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Middle name (optional)</label>
            <input
              {...register("middle_name")}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Gender</label>
              <select
                {...register("gender")}
                className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Admission No.</label>
              <input
                {...register("admission_number")}
                placeholder="Auto-generated if blank"
                className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <ClassField classId={classId} onClassChange={setClassId} classesQuery={classesQuery} />
          <p className="text-xs text-text/40 -mt-2">
            No classes yet? Create them first under School Setup → Classes.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded border border-border text-text">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Student
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditClassModal({
  student,
  onClose,
  onSaved,
}: {
  student: Student;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [classId, setClassId] = useState(student.current_class_id ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const classesQuery = useClassOptions();

  useEffect(() => {
    setClassId(student.current_class_id ?? "");
  }, [student]);

  async function handleSave() {
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/students/${student.id}`, {
        first_name: student.first_name,
        last_name: student.last_name,
        current_class_id: classId || null,
      });
      toast.success("Class assignment updated.");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't update class assignment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">
            Assign Class — {student.first_name} {student.last_name}
          </h3>
          <button onClick={onClose} className="text-text/50 hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <ClassField classId={classId} onClassChange={setClassId} classesQuery={classesQuery} />

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded border border-border text-text">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["students", search, page],
    queryFn: async () => {
      const { data } = await apiClient.get("/students", { params: { search, page, page_size: 20 } });
      return data as { data: Student[]; pagination: { total: number; page: number; page_size: number } };
    },
  });

  function refreshStudents() {
    queryClient.invalidateQueries({ queryKey: ["students"] });
  }

  async function handleDelete(student: Student) {
    if (!confirm(`Delete ${student.first_name} ${student.last_name}? This can't be undone.`)) return;
    setDeletingId(student.id);
    try {
      await apiClient.delete(`/students/${student.id}`);
      toast.success("Student deleted.");
      refreshStudents();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't delete student.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Students</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Student
        </button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-text/40" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or admission number..."
          className="w-full pl-9 pr-3 py-2 rounded border border-border bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-text/50 text-sm">
            Couldn't load students. You may not have permission to view this page.
          </div>
        ) : !data?.data?.length ? (
          <div className="py-16 text-center text-text/50 text-sm">No students found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-border/20 text-text/70 text-left">
              <tr>
                <th className="px-4 py-3">Admission No.</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-border/10">
                  <td className="px-4 py-3">{s.admission_number}</td>
                  <td className="px-4 py-3">{s.first_name} {s.last_name}</td>
                  <td className="px-4 py-3">
                    {s.class_name ? (
                      s.class_name
                    ) : (
                      <span className="text-text/40 italic">Not assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{s.status}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setEditingStudent(s)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Assign class
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.id}
                        className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        {deletingId === s.id ? (
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

      {showAddModal && (
        <AddStudentModal onClose={() => setShowAddModal(false)} onCreated={refreshStudents} />
      )}

      {editingStudent && (
        <EditClassModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={refreshStudents}
        />
      )}
    </div>
  );
}
