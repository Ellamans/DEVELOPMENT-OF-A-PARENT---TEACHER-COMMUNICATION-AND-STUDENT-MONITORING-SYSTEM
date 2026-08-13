"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface SchoolProfile {
  name: string;
  motto: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
}

const EMPTY_PROFILE: SchoolProfile = { name: "", motto: "", email: "", phone: "", address: "", city: "", state: "", country: "Nigeria" };

const TABS = ["Profile", "Sessions & Terms", "Classes", "Subjects", "Departments"] as const;
type Tab = (typeof TABS)[number];

function ProfileTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SchoolProfile>(EMPTY_PROFILE);
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["school-profile"],
    queryFn: async () => {
      const { data } = await apiClient.get("/school-setup/school-profile");
      return data as { data: SchoolProfile | null };
    },
  });

  useEffect(() => {
    if (data?.data) setForm({ ...EMPTY_PROFILE, ...data.data });
  }, [data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.put("/school-setup/school-profile", form);
      toast.success("School profile saved.");
      queryClient.invalidateQueries({ queryKey: ["school-profile"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Only admins can edit the school profile.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const field = (key: keyof SchoolProfile, label: string, required = false) => (
    <div>
      <label className="block text-sm font-medium text-text mb-1">{label}</label>
      <input
        value={form[key] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        required={required}
        className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );

  return (
    <form onSubmit={handleSave} className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-2xl">
      {field("name", "School Name", true)}
      {field("motto", "School Motto")}
      <div className="grid grid-cols-2 gap-4">
        {field("email", "School Email")}
        {field("phone", "School Phone")}
      </div>
      {field("address", "Address")}
      <div className="grid grid-cols-2 gap-4">
        {field("city", "City")}
        {field("state", "State")}
      </div>
      <button
        type="submit"
        disabled={isSaving}
        className="flex items-center gap-2 rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
      >
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Changes
      </button>
    </form>
  );
}

function SessionsTermsTab() {
  const queryClient = useQueryClient();
  const [newSessionName, setNewSessionName] = useState("");
  const [termForm, setTermForm] = useState({ session_id: "", name: "", start_date: "", end_date: "" });

  const sessionsQuery = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: async () => {
      const { data } = await apiClient.get("/school-setup/academic-sessions");
      return data.data as { id: string; name: string; is_active: boolean }[];
    },
  });

  const termsQuery = useQuery({
    queryKey: ["academic-terms"],
    queryFn: async () => {
      const { data } = await apiClient.get("/school-setup/academic-terms");
      return data.data as { id: string; session_id: string; name: string; is_active: boolean }[];
    },
  });

  async function addSession(e: React.FormEvent) {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    try {
      await apiClient.post("/school-setup/academic-sessions", { name: newSessionName });
      toast.success("Session created.");
      setNewSessionName("");
      queryClient.invalidateQueries({ queryKey: ["academic-sessions"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't create session.");
    }
  }

  async function activateSession(id: string) {
    try {
      await apiClient.patch(`/school-setup/academic-sessions/${id}/activate`);
      queryClient.invalidateQueries({ queryKey: ["academic-sessions"] });
      toast.success("Session activated.");
    } catch {
      toast.error("Couldn't activate this session.");
    }
  }

  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    if (!termForm.session_id || !termForm.name.trim()) {
      toast.error("Pick a session and enter a term name.");
      return;
    }
    try {
      await apiClient.post("/school-setup/academic-terms", {
        ...termForm,
        start_date: termForm.start_date || null,
        end_date: termForm.end_date || null,
      });
      toast.success("Term created.");
      setTermForm({ session_id: "", name: "", start_date: "", end_date: "" });
      queryClient.invalidateQueries({ queryKey: ["academic-terms"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't create term.");
    }
  }

  async function activateTerm(id: string) {
    try {
      await apiClient.patch(`/school-setup/academic-terms/${id}/activate`);
      queryClient.invalidateQueries({ queryKey: ["academic-terms"] });
      toast.success("Term activated.");
    } catch {
      toast.error("Couldn't activate this term.");
    }
  }

  const sessionName = (id: string) => sessionsQuery.data?.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-semibold text-text mb-2">Academic Sessions</h3>
        <form onSubmit={addSession} className="flex gap-2 mb-3">
          <input
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="e.g. 2026/2027"
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="rounded bg-primary text-white px-3 py-2 text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" />
          </button>
        </form>
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {sessionsQuery.isLoading ? (
            <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !sessionsQuery.data?.length ? (
            <p className="p-4 text-sm text-text/50">No sessions yet.</p>
          ) : (
            sessionsQuery.data.map((s) => (
              <div key={s.id} className="p-3 flex items-center justify-between text-sm">
                <span className="text-text">{s.name}</span>
                {s.is_active ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Check className="h-3 w-3" /> Active</span>
                ) : (
                  <button onClick={() => activateSession(s.id)} className="text-xs text-primary hover:underline">Activate</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-text mb-2">Academic Terms</h3>
        <form onSubmit={addTerm} className="space-y-2 mb-3">
          <select
            value={termForm.session_id}
            onChange={(e) => setTermForm({ ...termForm, session_id: e.target.value })}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text"
          >
            <option value="">Select session...</option>
            {sessionsQuery.data?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={termForm.name}
              onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
              placeholder="e.g. First Term"
              className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button type="submit" className="rounded bg-primary text-white px-3 py-2 text-sm font-medium hover:opacity-90">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </form>
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {termsQuery.isLoading ? (
            <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !termsQuery.data?.length ? (
            <p className="p-4 text-sm text-text/50">No terms yet.</p>
          ) : (
            termsQuery.data.map((t) => (
              <div key={t.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <span className="text-text">{t.name}</span>
                  <span className="text-text/40 text-xs ml-2">{sessionName(t.session_id)}</span>
                </div>
                {t.is_active ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Check className="h-3 w-3" /> Active</span>
                ) : (
                  <button onClick={() => activateTerm(t.id)} className="text-xs text-primary hover:underline">Activate</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ClassesTab() {
  const queryClient = useQueryClient();
  const [classForm, setClassForm] = useState({ name: "", level: "", capacity: "40" });
  const [savingClassId, setSavingClassId] = useState<string | null>(null);

  const classesQuery = useQuery({
    queryKey: ["school-classes"],
    queryFn: async () => {
      const { data } = await apiClient.get("/school-setup/classes");
      return data.data as {
        id: string;
        name: string;
        level: string;
        capacity: number;
        status: string;
        class_teacher_id: string | null;
        class_teacher_name: string | null;
      }[];
    },
  });

  // The class teacher field on a class stores a user ID directly, so we
  // Pull actual Teacher profiles. A class stores the linked User ID, so
  // using active teacher profiles prevents assigning an arbitrary user that
  // only happens to have the teacher role.
  const teachersQuery = useQuery({
    queryKey: ["teacher-profiles-for-class-assignment"],
    queryFn: async () => {
      const { data } = await apiClient.get("/teachers", { params: { page: 1, page_size: 100 } });
      return data.data as {
        id: string;
        user_id: string;
        full_name: string | null;
        email: string | null;
      }[];
    },
  });

  const teacherUserOptions = useMemo(() => {
    return (teachersQuery.data ?? []).map((t) => ({
      user_id: t.user_id,
      name: t.full_name || t.email || "Unnamed teacher",
    }));
  }, [teachersQuery.data]);

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    if (!classForm.name.trim() || !classForm.level.trim()) {
      toast.error("Class name and level are required.");
      return;
    }
    try {
      await apiClient.post("/school-setup/classes", {
        name: classForm.name,
        level: classForm.level,
        capacity: Number(classForm.capacity) || 40,
      });
      toast.success("Class created.");
      setClassForm({ name: "", level: "", capacity: "40" });
      queryClient.invalidateQueries({ queryKey: ["school-classes"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't create class.");
    }
  }

  async function assignClassTeacher(classId: string, teacherUserId: string) {
    setSavingClassId(classId);
    try {
      await apiClient.patch(`/school-setup/classes/${classId}`, {
        class_teacher_id: teacherUserId || null,
      });
      toast.success(teacherUserId ? "Class teacher assigned." : "Class teacher removed.");
      queryClient.invalidateQueries({ queryKey: ["school-classes"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't assign class teacher.");
    } finally {
      setSavingClassId(null);
    }
  }

  async function deleteClass(classId: string, name: string) {
    if (!confirm(`Delete ${name}? This can't be undone.`)) return;
    try {
      await apiClient.delete(`/school-setup/classes/${classId}`);
      toast.success("Class deleted.");
      queryClient.invalidateQueries({ queryKey: ["school-classes"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't delete class.");
    }
  }

  return (
    <div className="max-w-2xl">
      <h3 className="text-sm font-semibold text-text mb-2">Classes</h3>
      <p className="text-xs text-text/50 mb-2">
        e.g. "JSS 1", "JSS 2", "SS 3" — no arms/streams. Assign a class teacher below —
        that teacher becomes the contact parents and students of that class see in Messaging.
      </p>
      <form onSubmit={addClass} className="space-y-2 mb-4">
        <div className="flex gap-2">
          <input
            value={classForm.name}
            onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
            placeholder="e.g. JSS 1"
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            value={classForm.level}
            onChange={(e) => setClassForm({ ...classForm, level: e.target.value })}
            placeholder="Level, e.g. junior_secondary"
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            value={classForm.capacity}
            onChange={(e) => setClassForm({ ...classForm, capacity: e.target.value })}
            placeholder="Capacity"
            type="number"
            className="w-24 rounded border border-border bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="rounded bg-primary text-white px-3 py-2 text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {classesQuery.isLoading ? (
          <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !classesQuery.data?.length ? (
          <p className="p-4 text-sm text-text/50">No classes yet.</p>
        ) : (
          classesQuery.data.map((c) => (
            <div key={c.id} className="p-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-text font-medium">{c.name}</span>
                  <span className="text-text/40 text-xs ml-2">{c.level}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text/40 text-xs">capacity {c.capacity}</span>
                  <button
                    onClick={() => deleteClass(c.id, c.name)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={c.class_teacher_id || ""}
                  onChange={(e) => assignClassTeacher(c.id, e.target.value)}
                  disabled={savingClassId === c.id}
                  className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs text-text disabled:opacity-60"
                >
                  <option value="">No class teacher assigned</option>
                  {teacherUserOptions.map((t) => (
                    <option key={t.user_id} value={t.user_id}>{t.name}</option>
                  ))}
                </select>
                {savingClassId === c.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              </div>
              {c.class_teacher_name && (
                <p className="text-xs text-green-600">Class teacher: {c.class_teacher_name}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SubjectsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", code: "" });

  const subjectsQuery = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data } = await apiClient.get("/school-setup/subjects");
      return data.data as { id: string; name: string; code: string | null }[];
    },
  });

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Subject name is required.");
      return;
    }
    try {
      await apiClient.post("/school-setup/subjects", { name: form.name, code: form.code || null });
      toast.success("Subject created.");
      setForm({ name: "", code: "" });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't create subject.");
    }
  }

  return (
    <div className="max-w-md">
      <form onSubmit={addSubject} className="flex gap-2 mb-3">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Subject name, e.g. Mathematics"
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="Code"
          className="w-24 rounded border border-border bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button type="submit" className="rounded bg-primary text-white px-3 py-2 text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" />
        </button>
      </form>
      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {subjectsQuery.isLoading ? (
          <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !subjectsQuery.data?.length ? (
          <p className="p-4 text-sm text-text/50">No subjects yet.</p>
        ) : (
          subjectsQuery.data.map((s) => (
            <div key={s.id} className="p-3 flex items-center justify-between text-sm">
              <span className="text-text">{s.name}</span>
              {s.code && <span className="text-text/40 text-xs font-mono">{s.code}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DepartmentsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", description: "" });

  const deptsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await apiClient.get("/school-setup/departments");
      return data.data as { id: string; name: string; description: string | null }[];
    },
  });

  async function addDept(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Department name is required.");
      return;
    }
    try {
      await apiClient.post("/school-setup/departments", { name: form.name, description: form.description || null });
      toast.success("Department created.");
      setForm({ name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't create department.");
    }
  }

  return (
    <div className="max-w-md">
      <form onSubmit={addDept} className="space-y-2 mb-3">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Department name, e.g. Sciences"
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex gap-2">
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="rounded bg-primary text-white px-3 py-2 text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>
      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {deptsQuery.isLoading ? (
          <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !deptsQuery.data?.length ? (
          <p className="p-4 text-sm text-text/50">No departments yet.</p>
        ) : (
          deptsQuery.data.map((d) => (
            <div key={d.id} className="p-3 text-sm">
              <span className="text-text">{d.name}</span>
              {d.description && <p className="text-text/50 text-xs mt-0.5">{d.description}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function SchoolSetupPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Profile");

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">School Setup</h2>
      <p className="text-text/60 text-sm mb-6">Core information and academic structure used across the system.</p>

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px",
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-text/60 hover:text-text"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Profile" && <ProfileTab />}
      {activeTab === "Sessions & Terms" && <SessionsTermsTab />}
      {activeTab === "Classes" && <ClassesTab />}
      {activeTab === "Subjects" && <SubjectsTab />}
      {activeTab === "Departments" && <DepartmentsTab />}
    </div>
  );
}
