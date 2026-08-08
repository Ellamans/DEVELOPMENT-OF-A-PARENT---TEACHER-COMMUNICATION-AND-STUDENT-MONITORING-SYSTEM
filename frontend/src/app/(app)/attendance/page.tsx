"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: string;
  remarks: string | null;
  is_locked: boolean;
}

const STATUSES = ["present", "absent", "late", "excused", "sick", "school_activity"] as const;

const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-500/10 text-green-600 border-green-500/30",
  absent: "bg-red-500/10 text-red-600 border-red-500/30",
  late: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  excused: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  sick: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  school_activity: "bg-border text-text/60 border-border",
};

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"take" | "history">("take");

  const [classId, setClassId] = useState("");
  const [classArmId, setClassArmId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<Record<string, { status: string; remarks: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const classesQuery = useQuery({
    queryKey: ["school-classes"],
    queryFn: async () => (await apiClient.get("/school-setup/classes")).data.data as { id: string; name: string }[],
  });
  const armsQuery = useQuery({
    queryKey: ["class-arms", classId],
    queryFn: async () =>
      (await apiClient.get("/school-setup/class-arms", { params: { class_id: classId || undefined } })).data.data as {
        id: string; name: string; class_id: string;
      }[],
  });
  const sessionsQuery = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: async () => (await apiClient.get("/school-setup/academic-sessions")).data.data as { id: string; name: string; is_active: boolean }[],
  });
  const termsQuery = useQuery({
    queryKey: ["academic-terms", sessionId],
    queryFn: async () =>
      (await apiClient.get("/school-setup/academic-terms", { params: { session_id: sessionId || undefined } })).data.data as {
        id: string; name: string; is_active: boolean;
      }[],
  });

  const studentsQuery = useQuery({
    queryKey: ["students-for-attendance", classArmId],
    enabled: !!classArmId,
    queryFn: async () => {
      const { data } = await apiClient.get("/students", { params: { class_arm_id: classArmId, page_size: 100 } });
      return data.data as Student[];
    },
  });

  const historyQuery = useQuery({
    queryKey: ["attendance-history", classArmId, date],
    enabled: mode === "history" && !!classArmId,
    queryFn: async () => {
      const { data } = await apiClient.get("/attendance", { params: { class_arm_id: classArmId, date_from: date, date_to: date } });
      return data.data as AttendanceRecord[];
    },
  });

  function setEntry(studentId: string, status: string) {
    setEntries((e) => ({ ...e, [studentId]: { status, remarks: e[studentId]?.remarks || "" } }));
  }

  async function submitAttendance() {
    if (!classArmId || !sessionId || !termId) {
      toast.error("Select class arm, session, and term first.");
      return;
    }
    const list = studentsQuery.data || [];
    const missing = list.filter((s) => !entries[s.id]?.status);
    if (missing.length) {
      toast.error(`Mark a status for all ${list.length} students first.`);
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/attendance", {
        class_arm_id: classArmId,
        academic_session_id: sessionId,
        academic_term_id: termId,
        date,
        entries: list.map((s) => ({ student_id: s.id, status: entries[s.id].status, remarks: entries[s.id].remarks || null })),
      });
      toast.success("Attendance submitted.");
      setEntries({});
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't submit attendance.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleLock(lock: boolean) {
    if (!classArmId) return;
    try {
      await apiClient.patch(`/attendance/class/${classArmId}/${lock ? "lock" : "reopen"}`, null, { params: { date } });
      toast.success(lock ? "Attendance window locked." : "Attendance window reopened.");
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
    } catch {
      toast.error("Couldn't update the lock state.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-text">Attendance</h2>
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
          <button
            onClick={() => setMode("take")}
            className={clsx("px-3 py-1.5 text-sm rounded font-medium", mode === "take" ? "bg-primary text-white" : "text-text/60")}
          >
            Take Attendance
          </button>
          <button
            onClick={() => setMode("history")}
            className={clsx("px-3 py-1.5 text-sm rounded font-medium", mode === "history" ? "bg-primary text-white" : "text-text/60")}
          >
            History
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 mb-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <select value={classId} onChange={(e) => { setClassId(e.target.value); setClassArmId(""); }} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Class...</option>
          {classesQuery.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={classArmId} onChange={(e) => setClassArmId(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Class arm...</option>
          {armsQuery.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setTermId(""); }} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Session...</option>
          {sessionsQuery.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={termId} onChange={(e) => setTermId(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
          <option value="">Term...</option>
          {termsQuery.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text" />
      </div>

      {!classArmId ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">
          Select a class arm to {mode === "take" ? "take attendance" : "view history"}.
        </div>
      ) : mode === "take" ? (
        studentsQuery.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !studentsQuery.data?.length ? (
          <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">No students in this class arm yet.</div>
        ) : (
          <div>
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {studentsQuery.data.map((s) => (
                <div key={s.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-text">{s.first_name} {s.last_name}</p>
                    <p className="text-xs text-text/40">{s.admission_number}</p>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {STATUSES.map((st) => (
                      <button
                        key={st}
                        onClick={() => setEntry(s.id, st)}
                        className={clsx(
                          "px-2 py-1 rounded border text-xs font-medium capitalize",
                          entries[s.id]?.status === st ? STATUS_COLORS[st] : "border-border text-text/50"
                        )}
                      >
                        {st.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={submitAttendance}
              disabled={isSubmitting}
              className="mt-4 flex items-center gap-2 rounded bg-primary text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Attendance
            </button>
          </div>
        )
      ) : historyQuery.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !historyQuery.data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">No attendance recorded for this date.</div>
      ) : (
        <div>
          <div className="flex justify-end gap-2 mb-3">
            <button onClick={() => toggleLock(true)} className="flex items-center gap-1 text-xs text-red-500 hover:underline"><Lock className="h-3 w-3" /> Lock window</button>
            <button onClick={() => toggleLock(false)} className="flex items-center gap-1 text-xs text-primary hover:underline"><Unlock className="h-3 w-3" /> Reopen window</button>
          </div>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {historyQuery.data.map((r) => (
              <div key={r.id} className="p-3 flex items-center justify-between text-sm">
                <span className="text-text/70 font-mono text-xs">{r.student_id.slice(0, 8)}...</span>
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[r.status])}>
                  {r.status.replace("_", " ")}
                </span>
                {r.is_locked && <Lock className="h-3 w-3 text-text/40" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
