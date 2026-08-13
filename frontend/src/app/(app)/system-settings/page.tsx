"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

const TABS = ["Branding", "Password Policy", "Maintenance Mode", "Feature Flags", "Backups", "System Logs", "System Health"] as const;
type Tab = (typeof TABS)[number];

function BrandingTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ primary_colour: "#1E40AF", secondary_colour: "", accent_colour: "", welcome_message: "", footer_text: "" });
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["branding"],
    queryFn: async () => (await apiClient.get("/settings/branding")).data.data,
  });

  useEffect(() => {
    if (data) setForm((f) => ({ ...f, ...data }));
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.put("/settings/branding", { ...form, secondary_colour: form.secondary_colour || null, accent_colour: form.accent_colour || null });
      toast.success("Branding updated.");
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't update branding.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <form onSubmit={save} className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-lg">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-text mb-1">Primary</label>
          <input type="color" value={form.primary_colour} onChange={(e) => setForm({ ...form, primary_colour: e.target.value })} className="w-full h-10 rounded border border-border bg-background" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Secondary</label>
          <input type="color" value={form.secondary_colour || "#64748b"} onChange={(e) => setForm({ ...form, secondary_colour: e.target.value })} className="w-full h-10 rounded border border-border bg-background" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Accent</label>
          <input type="color" value={form.accent_colour || "#f59e0b"} onChange={(e) => setForm({ ...form, accent_colour: e.target.value })} className="w-full h-10 rounded border border-border bg-background" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text mb-1">Welcome message</label>
        <input value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <label className="block text-sm font-medium text-text mb-1">Footer text</label>
        <input value={form.footer_text} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <button type="submit" disabled={isSaving} className="flex items-center gap-2 rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60">
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Save Branding
      </button>
    </form>
  );
}

function PasswordPolicyTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    minimum_length: 8, require_uppercase: true, require_lowercase: true, require_numbers: true,
    require_special_chars: true, max_failed_attempts: 5, account_lock_minutes: 15, session_timeout_minutes: 30,
  });
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["password-policy"],
    queryFn: async () => (await apiClient.get("/settings/password-policy")).data.data,
  });

  useEffect(() => {
    if (data) setForm((f) => ({ ...f, ...data }));
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.put("/settings/password-policy", form);
      toast.success("Password policy updated.");
      queryClient.invalidateQueries({ queryKey: ["password-policy"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't update password policy.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <form onSubmit={save} className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">Minimum length</label>
          <input type="number" value={form.minimum_length} onChange={(e) => setForm({ ...form, minimum_length: Number(e.target.value) })} className="w-full rounded border border-border bg-background px-3 py-2 text-text" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Max failed attempts</label>
          <input type="number" value={form.max_failed_attempts} onChange={(e) => setForm({ ...form, max_failed_attempts: Number(e.target.value) })} className="w-full rounded border border-border bg-background px-3 py-2 text-text" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Account lock (minutes)</label>
          <input type="number" value={form.account_lock_minutes} onChange={(e) => setForm({ ...form, account_lock_minutes: Number(e.target.value) })} className="w-full rounded border border-border bg-background px-3 py-2 text-text" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Session timeout (minutes)</label>
          <input type="number" value={form.session_timeout_minutes} onChange={(e) => setForm({ ...form, session_timeout_minutes: Number(e.target.value) })} className="w-full rounded border border-border bg-background px-3 py-2 text-text" />
        </div>
      </div>
      <div className="space-y-2">
        {([
          ["require_uppercase", "Require uppercase letters"],
          ["require_lowercase", "Require lowercase letters"],
          ["require_numbers", "Require numbers"],
          ["require_special_chars", "Require special characters"],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-text/80">
            <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>
      <button type="submit" disabled={isSaving} className="flex items-center gap-2 rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60">
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Save Policy
      </button>
    </form>
  );
}

function MaintenanceModeTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ is_enabled: false, custom_message: "" });
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance-mode"],
    queryFn: async () => (await apiClient.get("/settings/maintenance-mode")).data.data,
  });

  useEffect(() => {
    if (data) setForm({ is_enabled: !!data.is_enabled, custom_message: data.custom_message || "" });
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.put("/settings/maintenance-mode", { ...form, custom_message: form.custom_message || null });
      toast.success(`Maintenance mode ${form.is_enabled ? "enabled" : "disabled"}.`);
      queryClient.invalidateQueries({ queryKey: ["maintenance-mode"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't update maintenance mode.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <form onSubmit={save} className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-lg">
      <div className="flex items-start gap-2 bg-yellow-500/10 text-yellow-700 rounded p-3 text-sm">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        Enabling this blocks non-admin access to the entire system. Only super admins can toggle this.
      </div>
      <label className="flex items-center gap-2 text-sm text-text/80">
        <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} />
        Enable maintenance mode
      </label>
      <div>
        <label className="block text-sm font-medium text-text mb-1">Custom message</label>
        <textarea value={form.custom_message} onChange={(e) => setForm({ ...form, custom_message: e.target.value })} rows={2} className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <button type="submit" disabled={isSaving} className="flex items-center gap-2 rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60">
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Save
      </button>
    </form>
  );
}

function FeatureFlagsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => (await apiClient.get("/settings/feature-flags")).data.data as { key: string; label: string; is_enabled: boolean }[],
  });

  async function toggle(key: string, is_enabled: boolean) {
    try {
      await apiClient.patch(`/settings/feature-flags/${key}`, { is_enabled });
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
    } catch {
      toast.error("Couldn't update this feature flag.");
    }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="bg-card border border-border rounded-lg divide-y divide-border max-w-lg">
      {!data?.length ? (
        <p className="p-4 text-sm text-text/50">No feature flags configured yet.</p>
      ) : (
        data.map((f) => (
          <div key={f.key} className="p-3 flex items-center justify-between text-sm">
            <span className="text-text">{f.label}</span>
            <button
              onClick={() => toggle(f.key, !f.is_enabled)}
              className={clsx("relative w-10 h-5 rounded-full transition-colors", f.is_enabled ? "bg-primary" : "bg-border")}
            >
              <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", f.is_enabled ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function SystemHealthTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => (await apiClient.get("/settings/system-health")).data.data,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="bg-card border border-border rounded-lg p-6 max-w-lg space-y-3 text-sm">
      <div className="flex justify-between"><span className="text-text/60">Database</span><span className={clsx("font-medium capitalize", data?.database === "healthy" ? "text-green-600" : "text-red-500")}>{data?.database}</span></div>
      <div className="flex justify-between"><span className="text-text/60">Cloudinary configured</span><span className="font-medium">{data?.cloudinary_configured ? "Yes" : "No"}</span></div>
      <div className="flex justify-between"><span className="text-text/60">Environment</span><span className="font-medium">{data?.environment}</span></div>
    </div>
  );
}

function BackupsTab() {
  const queryClient = useQueryClient();
  const [isTriggering, setIsTriggering] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: async () => (await apiClient.get("/settings/backups")).data.data as {
      id: string; backup_type: string; status: string; created_at: string;
    }[],
  });

  async function trigger(backupType: string) {
    setIsTriggering(backupType);
    try {
      await apiClient.post("/settings/backups", null, { params: { backup_type: backupType } });
      toast.success(`${backupType} backup recorded.`);
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't trigger this backup.");
    } finally {
      setIsTriggering(null);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-start gap-2 bg-blue-500/10 text-blue-700 rounded p-3 text-sm mb-4">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        This records a backup request — the actual dump/snapshot runs as an infrastructure job outside this app, not something this button performs directly.
      </div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => trigger("database")} disabled={!!isTriggering} className="flex items-center gap-2 rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60">
          {isTriggering === "database" && <Loader2 className="h-4 w-4 animate-spin" />} Trigger Database Backup
        </button>
        <button onClick={() => trigger("configuration")} disabled={!!isTriggering} className="flex items-center gap-2 rounded border border-border px-4 py-2 text-sm font-medium hover:bg-border/30 disabled:opacity-60">
          {isTriggering === "configuration" && <Loader2 className="h-4 w-4 animate-spin" />} Trigger Config Backup
        </button>
      </div>
      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {isLoading ? (
          <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !data?.length ? (
          <p className="p-4 text-sm text-text/50">No backups recorded yet.</p>
        ) : (
          data.map((b) => (
            <div key={b.id} className="p-3 flex items-center justify-between text-sm">
              <span className="text-text capitalize">{b.backup_type}</span>
              <span className="text-xs text-text/50">{b.status} · {new Date(b.created_at).toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SystemLogsTab() {
  const [logType, setLogType] = useState("");
  const [severity, setSeverity] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["system-logs", logType, severity],
    queryFn: async () => (await apiClient.get("/settings/logs", { params: { log_type: logType || undefined, severity: severity || undefined, page_size: 50 } })).data.data as {
      id: string; log_type: string; severity: string; message: string; created_at: string;
    }[],
  });

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select value={logType} onChange={(e) => setLogType(e.target.value)} className="rounded border border-border bg-card px-3 py-2 text-sm text-text">
          <option value="">All types</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded border border-border bg-card px-3 py-2 text-sm text-text">
          <option value="">All severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>
      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {isLoading ? (
          <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !data?.length ? (
          <p className="p-4 text-sm text-text/50">No system logs recorded yet.</p>
        ) : (
          data.map((l) => (
            <div key={l.id} className="p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-text capitalize">{l.log_type}</span>
                <span className="text-xs text-text/40">{new Date(l.created_at).toLocaleString()}</span>
              </div>
              <p className="text-text/70 text-xs mt-1">{l.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Branding");

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">System Settings</h2>
      <p className="text-text/60 text-sm mb-6">Platform-wide configuration. Most of this is super admin only.</p>

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

      {activeTab === "Branding" && <BrandingTab />}
      {activeTab === "Password Policy" && <PasswordPolicyTab />}
      {activeTab === "Maintenance Mode" && <MaintenanceModeTab />}
      {activeTab === "Feature Flags" && <FeatureFlagsTab />}
      {activeTab === "Backups" && <BackupsTab />}
      {activeTab === "System Logs" && <SystemLogsTab />}
      {activeTab === "System Health" && <SystemHealthTab />}
    </div>
  );
}
