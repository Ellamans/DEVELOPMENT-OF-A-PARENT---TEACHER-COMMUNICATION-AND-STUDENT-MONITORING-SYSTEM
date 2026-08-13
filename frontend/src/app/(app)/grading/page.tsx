"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, X, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface GradeRange {
  id: string;
  grade: string;
  min_score: number;
  max_score: number;
  remark: string | null;
  grade_point: number | null;
}
interface GradingSystem {
  id: string;
  name: string;
  is_active: boolean;
  ranges: GradeRange[];
}
interface AssessmentComponent {
  id: string;
  name: string;
  max_score: number;
  component_type: string;
}
interface AssessmentConfig {
  id: string;
  academic_session_id: string;
  name: string;
  is_active: boolean;
  components: AssessmentComponent[];
}

function NewGradingSystemModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [ranges, setRanges] = useState([{ grade: "", min_score: "", max_score: "", remark: "", grade_point: "" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function addRow() {
    setRanges([...ranges, { grade: "", min_score: "", max_score: "", remark: "", grade_point: "" }]);
  }
  function updateRow(i: number, field: string, value: string) {
    setRanges(ranges.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function removeRow(i: number) {
    setRanges(ranges.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !ranges.length) {
      toast.error("Name and at least one grade range are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/grading-systems", {
        name,
        ranges: ranges.map((r) => ({
          grade: r.grade, min_score: Number(r.min_score), max_score: Number(r.max_score),
          remark: r.remark || null, grade_point: r.grade_point ? Number(r.grade_point) : null,
        })),
      });
      toast.success("Grading system created.");
      queryClient.invalidateQueries({ queryKey: ["grading-systems"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't create grading system.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">New Grading System</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. WAEC Standard" className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Grade ranges *</label>
            <div className="space-y-2">
              {ranges.map((r, i) => (
                <div key={i} className="grid grid-cols-6 gap-1 items-center">
                  <input value={r.grade} onChange={(e) => updateRow(i, "grade", e.target.value)} placeholder="A" className="col-span-1 rounded border border-border bg-background px-2 py-1.5 text-sm text-text" />
                  <input value={r.min_score} onChange={(e) => updateRow(i, "min_score", e.target.value)} placeholder="Min" type="number" className="col-span-1 rounded border border-border bg-background px-2 py-1.5 text-sm text-text" />
                  <input value={r.max_score} onChange={(e) => updateRow(i, "max_score", e.target.value)} placeholder="Max" type="number" className="col-span-1 rounded border border-border bg-background px-2 py-1.5 text-sm text-text" />
                  <input value={r.remark} onChange={(e) => updateRow(i, "remark", e.target.value)} placeholder="Remark" className="col-span-2 rounded border border-border bg-background px-2 py-1.5 text-sm text-text" />
                  <button type="button" onClick={() => removeRow(i)} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addRow} className="text-xs text-primary hover:underline mt-2">+ Add range</button>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60 mt-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Grading System
          </button>
        </form>
      </div>
    </div>
  );
}

function GradingTab() {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["grading-systems"],
    queryFn: async () => (await apiClient.get("/grading-systems")).data.data as GradingSystem[],
  });

  async function activate(id: string) {
    try {
      await apiClient.patch(`/grading-systems/${id}/activate`);
      toast.success("Grading system activated.");
      queryClient.invalidateQueries({ queryKey: ["grading-systems"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't activate this grading system.");
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> New Grading System
        </button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">No grading systems yet.</div>
      ) : (
        <div className="space-y-3">
          {data.map((g) => (
            <div key={g.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-text">{g.name}</span>
                {g.is_active ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Check className="h-3 w-3" /> Active</span>
                ) : (
                  <button onClick={() => activate(g.id)} className="text-xs text-primary hover:underline">Activate</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.ranges.map((r) => (
                  <span key={r.id} className="text-xs bg-border/30 rounded px-2 py-1">
                    {r.grade}: {r.min_score}–{r.max_score} {r.remark && `(${r.remark})`}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {showModal && <NewGradingSystemModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

function NewAssessmentConfigModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState("");
  const [name, setName] = useState("");
  const [components, setComponents] = useState([{ name: "", max_score: "", component_type: "continuous_assessment" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: async () => (await apiClient.get("/school-setup/academic-sessions")).data.data as { id: string; name: string }[],
  });

  function addRow() {
    setComponents([...components, { name: "", max_score: "", component_type: "continuous_assessment" }]);
  }
  function updateRow(i: number, field: string, value: string) {
    setComponents(components.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }
  function removeRow(i: number) {
    setComponents(components.filter((_, idx) => idx !== i));
  }

  const total = components.reduce((sum, c) => sum + (Number(c.max_score) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !name.trim()) {
      toast.error("Session and name are required.");
      return;
    }
    if (total !== 100) {
      toast.error(`Component max scores must total 100 (currently ${total}).`);
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/assessment-configurations", {
        academic_session_id: sessionId, name,
        components: components.map((c) => ({ name: c.name, max_score: Number(c.max_score), component_type: c.component_type })),
      });
      toast.success("Assessment configuration created.");
      queryClient.invalidateQueries({ queryKey: ["assessment-configs"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't create this configuration.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">New Assessment Configuration</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Academic session *</label>
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 text-text">
              <option value="">Select session...</option>
              {sessionsQuery.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Model A" className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Components — must total 100 *</label>
            <div className="space-y-2">
              {components.map((c, i) => (
                <div key={i} className="grid grid-cols-6 gap-1 items-center">
                  <input value={c.name} onChange={(e) => updateRow(i, "name", e.target.value)} placeholder="e.g. CA1" className="col-span-2 rounded border border-border bg-background px-2 py-1.5 text-sm text-text" />
                  <input value={c.max_score} onChange={(e) => updateRow(i, "max_score", e.target.value)} placeholder="Max" type="number" className="col-span-1 rounded border border-border bg-background px-2 py-1.5 text-sm text-text" />
                  <select value={c.component_type} onChange={(e) => updateRow(i, "component_type", e.target.value)} className="col-span-2 rounded border border-border bg-background px-2 py-1.5 text-sm text-text">
                    <option value="continuous_assessment">Continuous assessment</option>
                    <option value="exam">Exam</option>
                  </select>
                  <button type="button" onClick={() => removeRow(i)} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <button type="button" onClick={addRow} className="text-xs text-primary hover:underline">+ Add component</button>
              <span className={clsx("text-xs font-medium", total === 100 ? "text-green-600" : "text-red-500")}>Total: {total}/100</span>
            </div>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60 mt-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Configuration
          </button>
        </form>
      </div>
    </div>
  );
}

function AssessmentConfigTab() {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["assessment-configs"],
    queryFn: async () => (await apiClient.get("/assessment-configurations")).data.data as AssessmentConfig[],
  });

  async function activate(id: string) {
    try {
      await apiClient.patch(`/assessment-configurations/${id}/activate`);
      toast.success("Configuration activated.");
      queryClient.invalidateQueries({ queryKey: ["assessment-configs"] });
    } catch {
      toast.error("Couldn't activate this configuration.");
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> New Configuration
        </button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">No assessment configurations yet.</div>
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-text">{c.name}</span>
                {c.is_active ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Check className="h-3 w-3" /> Active</span>
                ) : (
                  <button onClick={() => activate(c.id)} className="text-xs text-primary hover:underline">Activate</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {c.components.map((comp) => (
                  <span key={comp.id} className="text-xs bg-border/30 rounded px-2 py-1 capitalize">
                    {comp.name} — {comp.max_score} ({comp.component_type.replace(/_/g, " ")})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {showModal && <NewAssessmentConfigModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

export default function GradingPage() {
  const [tab, setTab] = useState<"grading" | "config">("grading");

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Grading & Assessment Setup</h2>
      <p className="text-text/60 text-sm mb-6">Define how raw scores turn into letter grades, and how each term's assessments are weighted.</p>

      <div className="flex gap-1 border-b border-border mb-6">
        <button onClick={() => setTab("grading")} className={clsx("px-4 py-2 text-sm font-medium border-b-2 -mb-px", tab === "grading" ? "border-primary text-primary" : "border-transparent text-text/60")}>Grading Systems</button>
        <button onClick={() => setTab("config")} className={clsx("px-4 py-2 text-sm font-medium border-b-2 -mb-px", tab === "config" ? "border-primary text-primary" : "border-transparent text-text/60")}>Assessment Configuration</button>
      </div>

      {tab === "grading" ? <GradingTab /> : <AssessmentConfigTab />}
    </div>
  );
}
