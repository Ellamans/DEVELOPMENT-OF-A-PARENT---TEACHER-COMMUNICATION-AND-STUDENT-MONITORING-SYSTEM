"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Calculator, FileCheck, Download } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface ReportCardRow {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string | null;
  overall_average: number | null;
  overall_position: number | null;
  promotion_status: string | null;
  published: boolean;
  pdf_url: string | null;
}

export default function ReportCardsPage() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [classArmId, setClassArmId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [isComputing, setIsComputing] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const classesQuery = useQuery({
    queryKey: ["school-classes"],
    queryFn: async () => (await apiClient.get("/school-setup/classes")).data.data as { id: string; name: string }[],
  });
  const armsQuery = useQuery({
    queryKey: ["class-arms", classId],
    enabled: !!classId,
    queryFn: async () => (await apiClient.get("/school-setup/class-arms", { params: { class_id: classId } })).data.data as { id: string; name: string }[],
  });
  const sessionsQuery = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: async () => (await apiClient.get("/school-setup/academic-sessions")).data.data as { id: string; name: string }[],
  });
  const termsQuery = useQuery({
    queryKey: ["academic-terms", sessionId],
    enabled: !!sessionId,
    queryFn: async () => (await apiClient.get("/school-setup/academic-terms", { params: { session_id: sessionId } })).data.data as { id: string; name: string }[],
  });

  const cardsQuery = useQuery({
    queryKey: ["report-cards", classArmId, termId],
    enabled: !!classArmId && !!termId,
    queryFn: async () => (await apiClient.get("/report-cards", { params: { class_arm_id: classArmId, academic_term_id: termId } })).data.data as ReportCardRow[],
  });

  async function computeResults() {
    if (!classArmId || !sessionId || !termId) {
      toast.error("Select class arm, session, and term first.");
      return;
    }
    setIsComputing(true);
    try {
      const { data } = await apiClient.post("/report-cards/compute-class", {
        class_arm_id: classArmId, academic_session_id: sessionId, academic_term_id: termId,
      });
      toast.success(data.message || "Results computed.");
      queryClient.invalidateQueries({ queryKey: ["report-cards"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't compute results — make sure scores have been entered first.");
    } finally {
      setIsComputing(false);
    }
  }

  async function publish(cardId: string) {
    setPublishingId(cardId);
    try {
      await apiClient.patch(`/report-cards/${cardId}/publish`);
      toast.success("Report card published.");
      queryClient.invalidateQueries({ queryKey: ["report-cards"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't publish this report card.");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Report Cards</h2>
      <p className="text-text/60 text-sm mb-6">
        Compute results from entered CA and approved exam scores, then publish to make them visible to parents and students.
      </p>

      <div className="bg-card border border-border rounded-lg p-4 mb-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
      </div>

      <button
        onClick={computeResults}
        disabled={isComputing || !classArmId || !sessionId || !termId}
        className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50 mb-4"
      >
        {isComputing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
        Compute Results for this Class
      </button>

      {!classArmId || !termId ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">Select a class arm and term to view report cards.</div>
      ) : cardsQuery.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !cardsQuery.data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm">No results computed yet — enter scores in Results Entry, then compute results here.</div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-border/20 text-text/70 text-left">
              <tr>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Average</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cardsQuery.data.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{c.overall_position ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.student_name}
                    {c.admission_number && <span className="text-text/40 text-xs ml-1">({c.admission_number})</span>}
                  </td>
                  <td className="px-4 py-3">{c.overall_average?.toFixed(1) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", c.published ? "bg-green-500/10 text-green-600" : "bg-border text-text/60")}>
                      {c.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.published ? (
                      c.pdf_url && (
                        <a href={c.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <Download className="h-3 w-3" /> PDF
                        </a>
                      )
                    ) : (
                      <button
                        onClick={() => publish(c.id)}
                        disabled={publishingId === c.id}
                        className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        {publishingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileCheck className="h-3 w-3" />}
                        Publish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
