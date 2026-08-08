"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
}
interface AssessmentComponent {
  id: string;
  name: string;
  max_score: number;
  component_type: string;
}
interface AssessmentConfig {
  id: string;
  is_active: boolean;
  components: AssessmentComponent[];
}
interface CAEntry {
  id: string;
  student_id: string;
  component_id: string;
  score: number;
}
interface ExamEntry {
  id: string;
  student_id: string;
  exam_score: number | null;
  status: string;
}

const APPROVAL_CHAIN = ["draft", "submitted", "under_review", "approved", "published"];
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-border text-text/60",
  submitted: "bg-blue-500/10 text-blue-600",
  under_review: "bg-yellow-500/10 text-yellow-600",
  approved: "bg-green-500/10 text-green-600",
  published: "bg-purple-500/10 text-purple-600",
  rejected: "bg-red-500/10 text-red-600",
};

function usePickers() {
  const classesQuery = useQuery({
    queryKey: ["school-classes"],
    queryFn: async () => (await apiClient.get("/school-setup/classes")).data.data as { id: string; name: string }[],
  });
  const subjectsQuery = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await apiClient.get("/school-setup/subjects")).data.data as { id: string; name: string }[],
  });
  const sessionsQuery = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: async () => (await apiClient.get("/school-setup/academic-sessions")).data.data as { id: string; name: string }[],
  });
  return { classesQuery, subjectsQuery, sessionsQuery };
}

function CATab() {
  const { classesQuery, subjectsQuery, sessionsQuery } = usePickers();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [classArmId, setClassArmId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const armsQuery = useQuery({
    queryKey: ["class-arms", classId],
    enabled: !!classId,
    queryFn: async () => (await apiClient.get("/school-setup/class-arms", { params: { class_id: classId } })).data.data as { id: string; name: string }[],
  });
  const termsQuery = useQuery({
    queryKey: ["academic-terms", sessionId],
    enabled: !!sessionId,
    queryFn: async () => (await apiClient.get("/school-setup/academic-terms", { params: { session_id: sessionId } })).data.data as { id: string; name: string }[],
  });
  const configsQuery = useQuery({
    queryKey: ["assessment-configs", sessionId],
    enabled: !!sessionId,
    queryFn: async () => (await apiClient.get("/assessment-configurations", { params: { academic_session_id: sessionId } })).data.data as AssessmentConfig[],
  });
  const activeConfig = configsQuery.data?.find((c) => c.is_active);
  const caComponents = activeConfig?.components.filter((c) => c.component_type === "continuous_assessment") || [];

  const studentsQuery = useQuery({
    queryKey: ["students-for-ca", classArmId],
    enabled: !!classArmId,
    queryFn: async () => (await apiClient.get("/students", { params: { class_arm_id: classArmId, page_size: 100 } })).data.data as Student[],
  });
  const existingQuery = useQuery({
    queryKey: ["ca-existing", classArmId, subjectId, termId],
    enabled: !!classArmId && !!subjectId && !!termId,
    queryFn: async () => (await apiClient.get("/continuous-assessments", { params: { class_arm_id: classArmId, subject_id: subjectId, academic_term_id: termId } })).data.data as CAEntry[],
  });

  function existingScore(studentId: string, compId: string) {
    return existingQuery.data?.find((e) => e.student_id === studentId && e.component_id === compId)?.score;
  }

  async function saveScore(studentId: string) {
    const raw = scores[studentId];
    if (raw === undefined || raw === "") {
      toast.error("Enter a score first.");
      return;
    }
    if (!classArmId || !subjectId || !sessionId || !termId || !componentId) {
      toast.error("Select class arm, subject, session, term, and component first.");
      return;
    }
    setSavingId(studentId);
    try {
      await apiClient.post("/continuous-assessments", {
        student_id: studentId, subject_id: subjectId, class_arm_id: classArmId,
        academic_session_id: sessionId, academic_term_id: termId, component_id: componentId,
        score: Number(raw),
      });
      toast.success("Score saved.");
      queryClient.invalidateQueries({ queryKey: ["ca-existing"] });
      setScores((s) => ({ ...s, [studentId]: "" }));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't save this score.");
    } finally {
      setSavingId(null);
    }
  }

  const component = caComponents.find((c) => c.id === componentId);

  return (
    <div>
      <div className="bg-card border border-border rounded-lg p-4 mb-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <select value={classId} onChange={(e) => { setClassId(e.target.value); setClassArmId(""); }} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Class...</option>
          {classesQuery.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={classArmId} onChange={(e) => setClassArmId(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Class arm...</option>
          {armsQuery.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Subject...</option>
          {subjectsQuery.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setTermId(""); }} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Session...</option>
          {sessionsQuery.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Term...</option>
          {termsQuery.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={componentId} onChange={(e) => setComponentId(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Component...</option>
          {caComponents.map((c) => <option key={c.id} value={c.id}>{c.name} (max {c.max_score})</option>)}
        </select>
      </div>

      {sessionId && !activeConfig && (
        <p className="text-sm text-yellow-600 bg-yellow-500/10 rounded p-3 mb-4">No active assessment configuration for this session. Set one up in Grading & Assessment Setup first.</p>
      )}

      {!classArmId || !subjectId || !termId || !componentId ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">Fill in all selectors above to start entering scores.</div>
      ) : studentsQuery.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !studentsQuery.data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">No students in this class arm.</div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {studentsQuery.data.map((s) => {
            const existing = existingScore(s.id, componentId);
            return (
              <div key={s.id} className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-text/40">{s.admission_number}</p>
                </div>
                {existing !== undefined ? (
                  <span className="text-sm font-medium text-green-600">{existing} / {component?.max_score}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      value={scores[s.id] || ""}
                      onChange={(e) => setScores((sc) => ({ ...sc, [s.id]: e.target.value }))}
                      type="number"
                      placeholder={`/ ${component?.max_score ?? "-"}`}
                      className="w-20 rounded border border-border bg-background px-2 py-1.5 text-sm text-text"
                    />
                    <button
                      onClick={() => saveScore(s.id)}
                      disabled={savingId === s.id}
                      className="text-xs bg-primary text-white px-3 py-1.5 rounded font-medium hover:opacity-90 disabled:opacity-60"
                    >
                      {savingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExamTab() {
  const { classesQuery, subjectsQuery, sessionsQuery } = usePickers();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [classArmId, setClassArmId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const armsQuery = useQuery({
    queryKey: ["class-arms", classId],
    enabled: !!classId,
    queryFn: async () => (await apiClient.get("/school-setup/class-arms", { params: { class_id: classId } })).data.data as { id: string; name: string }[],
  });
  const termsQuery = useQuery({
    queryKey: ["academic-terms", sessionId],
    enabled: !!sessionId,
    queryFn: async () => (await apiClient.get("/school-setup/academic-terms", { params: { session_id: sessionId } })).data.data as { id: string; name: string }[],
  });
  const studentsQuery = useQuery({
    queryKey: ["students-for-exam", classArmId],
    enabled: !!classArmId,
    queryFn: async () => (await apiClient.get("/students", { params: { class_arm_id: classArmId, page_size: 100 } })).data.data as Student[],
  });
  const examsQuery = useQuery({
    queryKey: ["exam-results", classArmId, subjectId, termId],
    enabled: !!classArmId && !!subjectId && !!termId,
    queryFn: async () => (await apiClient.get("/exam-results", { params: { class_arm_id: classArmId, subject_id: subjectId, academic_term_id: termId } })).data.data as ExamEntry[],
  });

  function existing(studentId: string) {
    return examsQuery.data?.find((e) => e.student_id === studentId);
  }

  async function saveScore(studentId: string) {
    const raw = scores[studentId];
    if (raw === undefined || raw === "") {
      toast.error("Enter a score first.");
      return;
    }
    if (!classArmId || !subjectId || !sessionId || !termId) {
      toast.error("Select class arm, subject, session, and term first.");
      return;
    }
    setSavingId(studentId);
    try {
      await apiClient.post("/exam-results", {
        student_id: studentId, subject_id: subjectId, class_arm_id: classArmId,
        academic_session_id: sessionId, academic_term_id: termId, exam_score: Number(raw),
      });
      toast.success("Exam score saved as draft.");
      queryClient.invalidateQueries({ queryKey: ["exam-results"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't save this score.");
    } finally {
      setSavingId(null);
    }
  }

  async function transition(id: string, newStatus: string) {
    try {
      await apiClient.patch(`/exam-results/${id}/transition`, { new_status: newStatus });
      toast.success(`Moved to ${newStatus.replace(/_/g, " ")}.`);
      queryClient.invalidateQueries({ queryKey: ["exam-results"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't update this result's status.");
    }
  }

  function nextStatus(current: string) {
    const idx = APPROVAL_CHAIN.indexOf(current);
    return idx >= 0 && idx < APPROVAL_CHAIN.length - 1 ? APPROVAL_CHAIN[idx + 1] : null;
  }

  return (
    <div>
      <div className="bg-card border border-border rounded-lg p-4 mb-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <select value={classId} onChange={(e) => { setClassId(e.target.value); setClassArmId(""); }} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Class...</option>
          {classesQuery.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={classArmId} onChange={(e) => setClassArmId(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Class arm...</option>
          {armsQuery.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Subject...</option>
          {subjectsQuery.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setTermId(""); }} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Session...</option>
          {sessionsQuery.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Term...</option>
          {termsQuery.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {!classArmId || !subjectId || !termId ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">Fill in all selectors above to start entering exam scores.</div>
      ) : studentsQuery.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !studentsQuery.data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">No students in this class arm.</div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {studentsQuery.data.map((s) => {
            const ex = existing(s.id);
            const next = ex ? nextStatus(ex.status) : null;
            return (
              <div key={s.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-text">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-text/40">{s.admission_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  {ex ? (
                    <>
                      <span className="text-sm font-medium text-text">{ex.exam_score}</span>
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[ex.status])}>{ex.status.replace(/_/g, " ")}</span>
                      {next && (
                        <button onClick={() => transition(ex.id, next)} className="text-xs text-primary hover:underline">
                          Move to {next.replace(/_/g, " ")}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <input
                        value={scores[s.id] || ""}
                        onChange={(e) => setScores((sc) => ({ ...sc, [s.id]: e.target.value }))}
                        type="number"
                        placeholder="Score"
                        className="w-20 rounded border border-border bg-background px-2 py-1.5 text-sm text-text"
                      />
                      <button
                        onClick={() => saveScore(s.id)}
                        disabled={savingId === s.id}
                        className="text-xs bg-primary text-white px-3 py-1.5 rounded font-medium hover:opacity-90 disabled:opacity-60"
                      >
                        {savingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const [tab, setTab] = useState<"ca" | "exam">("ca");

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Results Entry</h2>
      <p className="text-text/60 text-sm mb-6">Enter continuous assessment and exam scores. Once computed, results feed into report cards.</p>

      <div className="flex gap-1 border-b border-border mb-6">
        <button onClick={() => setTab("ca")} className={clsx("px-4 py-2 text-sm font-medium border-b-2 -mb-px", tab === "ca" ? "border-primary text-primary" : "border-transparent text-text/60")}>Continuous Assessment</button>
        <button onClick={() => setTab("exam")} className={clsx("px-4 py-2 text-sm font-medium border-b-2 -mb-px", tab === "exam" ? "border-primary text-primary" : "border-transparent text-text/60")}>Exam Scores</button>
      </div>

      {tab === "ca" ? <CATab /> : <ExamTab />}
    </div>
  );
}
