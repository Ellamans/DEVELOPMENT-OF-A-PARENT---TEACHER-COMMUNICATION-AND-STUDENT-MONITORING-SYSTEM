"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, X, LogOut } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface Visitor {
  id: string;
  full_name: string;
  phone_number: string;
  organization: string | null;
  purpose_of_visit: string;
  person_to_visit: string | null;
  badge_number: string | null;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
}

function RegisterVisitorModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    email: "",
    organization: "",
    purpose_of_visit: "",
    person_to_visit: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone_number.trim() || !form.purpose_of_visit.trim()) {
      toast.error("Name, phone, and purpose of visit are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data } = await apiClient.post("/visitors", {
        ...form,
        email: form.email || null,
        organization: form.organization || null,
        person_to_visit: form.person_to_visit || null,
      });
      toast.success(`Visitor registered — badge ${data?.data?.badge_number ?? ""}`);
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't register this visitor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Register Visitor</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Full name *</label>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Phone number *</label>
            <input
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Organization</label>
            <input
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Purpose of visit *</label>
            <input
              value={form.purpose_of_visit}
              onChange={(e) => setForm({ ...form, purpose_of_visit: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Person to visit</label>
            <input
              value={form.person_to_visit}
              onChange={(e) => setForm({ ...form, person_to_visit: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60 mt-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Register &amp; Check In
          </button>
        </form>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
        status === "checked_in" ? "bg-green-500/10 text-green-600" : "bg-border text-text/60"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function VisitorsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["visitors", statusFilter],
    queryFn: async () => {
      const { data } = await apiClient.get("/visitors", {
        params: { status: statusFilter || undefined, page_size: 50 },
      });
      return data as { data: Visitor[]; pagination: { total: number } };
    },
  });

  async function checkout(id: string) {
    try {
      await apiClient.patch(`/visitors/${id}/checkout`);
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      toast.success("Visitor checked out.");
    } catch {
      toast.error("Couldn't check out this visitor.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-text">Visitors</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Register Visitor
        </button>
      </div>

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-border bg-card px-3 py-2 text-sm text-text"
        >
          <option value="">All visitors</option>
          <option value="checked_in">On campus</option>
          <option value="checked_out">Checked out</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !data?.data?.length ? (
          <div className="py-16 text-center text-text/50 text-sm">No visitors found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-border/20 text-text/70 text-left">
              <tr>
                <th className="px-4 py-3">Badge</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Visiting</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((v) => (
                <tr key={v.id} className="border-t border-border hover:bg-border/10">
                  <td className="px-4 py-3 font-mono text-xs">{v.badge_number || "—"}</td>
                  <td className="px-4 py-3">{v.full_name}</td>
                  <td className="px-4 py-3">{v.purpose_of_visit}</td>
                  <td className="px-4 py-3">{v.person_to_visit || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                  <td className="px-4 py-3">
                    {v.status === "checked_in" && (
                      <button
                        onClick={() => checkout(v.id)}
                        className="flex items-center gap-1 text-xs text-red-500 hover:underline"
                      >
                        <LogOut className="h-3 w-3" /> Check out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && <RegisterVisitorModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
