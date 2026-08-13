"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, X, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface SavedReport {
  id: string;
  name: string;
  report_type: string;
  filters: string | null;
}
interface ReportExportEntry {
  id: string;
  report_type: string;
  file_format: string;
  created_at: string;
}

const REPORT_TYPES = ["students", "attendance", "teachers", "parents", "visitors", "incidents"];

function SaveReportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", report_type: "students" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/reports/saved", form);
      toast.success("Report configuration saved.");
      queryClient.invalidateQueries({ queryKey: ["saved-reports"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't save this report.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Save Report Configuration</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Report type *</label>
            <select value={form.report_type} onChange={(e) => setForm({ ...form, report_type: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text">
              {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60 mt-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Report
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [showModal, setShowModal] = useState(false);
  const [exportType, setExportType] = useState("students");
  const [exportFormat, setExportFormat] = useState("csv");
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  const savedQuery = useQuery({
    queryKey: ["saved-reports"],
    queryFn: async () => (await apiClient.get("/reports/saved")).data.data as SavedReport[],
  });
  const historyQuery = useQuery({
    queryKey: ["export-history"],
    queryFn: async () => (await apiClient.get("/reports/export-history")).data.data as ReportExportEntry[],
  });

  async function runExport() {
    setIsExporting(true);
    try {
      await apiClient.post("/reports/export", { report_type: exportType, file_format: exportFormat });
      toast.success("Export generated — find it below.");
      queryClient.invalidateQueries({ queryKey: ["export-history"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't generate this export.");
    } finally {
      setIsExporting(false);
    }
  }

  async function download(exportId: string, reportType: string, format: string) {
    try {
      const res = await apiClient.get(`/reports/export/${exportId}/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}.${format === "csv" ? "csv" : "xlsx"}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "This export is no longer available — try generating a new one.");
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Reports & Exports</h2>
      <p className="text-text/60 text-sm mb-6">
        Generate CSV/Excel exports of your data, and save report configurations to reuse later. Note: exported files
        live on the server temporarily — download them soon after generating, since a server restart clears them.
      </p>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-text mb-3">Generate an export</h3>
        <div className="flex flex-wrap gap-3">
          <select value={exportType} onChange={(e) => setExportType(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
            {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="rounded border border-border bg-background px-3 py-2 text-sm text-text">
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
          </select>
          <button onClick={runExport} disabled={isExporting} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Generate Export
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text">Saved Report Configurations</h3>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Plus className="h-3 w-3" /> Save New
        </button>
      </div>
      <div className="bg-card border border-border rounded-lg divide-y divide-border mb-6">
        {savedQuery.isLoading ? (
          <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !savedQuery.data?.length ? (
          <p className="p-4 text-sm text-text/50">No saved reports yet.</p>
        ) : (
          savedQuery.data.map((r) => (
            <div key={r.id} className="p-3 flex items-center justify-between text-sm">
              <span className="text-text">{r.name}</span>
              <span className="text-xs text-text/40 capitalize">{r.report_type}</span>
            </div>
          ))
        )}
      </div>

      <h3 className="text-sm font-semibold text-text mb-3">Export History</h3>
      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {historyQuery.isLoading ? (
          <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !historyQuery.data?.length ? (
          <p className="p-4 text-sm text-text/50">No exports generated yet.</p>
        ) : (
          historyQuery.data.map((e) => (
            <div key={e.id} className="p-3 flex items-center justify-between text-sm">
              <div>
                <span className="text-text capitalize">{e.report_type}</span>
                <span className={clsx("ml-2 text-xs px-1.5 py-0.5 rounded uppercase font-medium", "bg-border/40 text-text/60")}>{e.file_format}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text/40">{new Date(e.created_at).toLocaleString()}</span>
                <button onClick={() => download(e.id, e.report_type, e.file_format)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Download className="h-3 w-3" /> Download
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && <SaveReportModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
