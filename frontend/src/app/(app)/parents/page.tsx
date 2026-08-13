"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Search, Loader2, Plus, X, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ParentRow {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  occupation: string | null;
  preferred_contact_method: string;
}

interface Child {
  id: string;
  full_name: string;
  admission_number: string;
}

interface StudentSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
}

function AddParentModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    occupation: "",
    residential_address: "",
    preferred_contact_method: "phone",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Full name is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/parents", {
        ...form,
        email: form.email || null,
        phone_number: form.phone_number || null,
        occupation: form.occupation || null,
        residential_address: form.residential_address || null,
      });
      toast.success("Parent added.");
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't add this parent.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Add Parent</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Full name</label>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
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
            <label className="block text-sm font-medium text-text mb-1">Phone number</label>
            <input
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Occupation</label>
            <input
              value={form.occupation}
              onChange={(e) => setForm({ ...form, occupation: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Preferred contact method</label>
            <select
              value={form.preferred_contact_method}
              onChange={(e) => setForm({ ...form, preferred_contact_method: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60 mt-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add Parent
          </button>
        </form>
      </div>
    </div>
  );
}

function ManageChildrenModal({ parent, onClose }: { parent: ParentRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [studentSearch, setStudentSearch] = useState("");
  const [relationshipType, setRelationshipType] = useState("father");
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const { data: parentDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["parent-detail", parent.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/parents/${parent.id}`);
      return data.data as { children: Child[] };
    },
  });

  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["student-search-for-link", studentSearch],
    queryFn: async () => {
      const { data } = await apiClient.get("/students", { params: { search: studentSearch, page: 1, page_size: 10 } });
      return data.data as StudentSearchResult[];
    },
    enabled: studentSearch.length > 1,
  });

  const linkedIds = new Set((parentDetail?.children || []).map((c) => c.id));

  async function handleLink(studentId: string) {
    setLinkingId(studentId);
    try {
      await apiClient.post(`/students/${studentId}/parents`, {
        parent_id: parent.id,
        relationship_type: relationshipType,
      });
      toast.success("Child linked.");
      queryClient.invalidateQueries({ queryKey: ["parent-detail", parent.id] });
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Couldn't link this child.");
    } finally {
      setLinkingId(null);
    }
  }

  async function handleUnlink(studentId: string) {
    setUnlinkingId(studentId);
    try {
      await apiClient.delete(`/students/${studentId}/parents/${parent.id}`);
      toast.success("Child unlinked.");
      queryClient.invalidateQueries({ queryKey: ["parent-detail", parent.id] });
    } catch {
      toast.error("Couldn't unlink this child.");
    } finally {
      setUnlinkingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-lg p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Children linked to {parent.full_name}</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5">
          {loadingDetail ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : !parentDetail?.children?.length ? (
            <p className="text-sm text-text/50">No children linked yet.</p>
          ) : (
            <ul className="space-y-2">
              {parentDetail.children.map((c) => (
                <li key={c.id} className="flex items-center justify-between bg-background border border-border rounded px-3 py-2 text-sm">
                  <span>{c.full_name} <span className="text-text/40">({c.admission_number})</span></span>
                  <button
                    onClick={() => handleUnlink(c.id)}
                    disabled={unlinkingId === c.id}
                    className="text-red-500 text-xs hover:underline disabled:opacity-50"
                  >
                    {unlinkingId === c.id ? "Unlinking..." : "Unlink"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-medium text-text mb-2">Link another child</h4>

          <div className="flex gap-2 mb-3">
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value)}
              className="rounded border border-border bg-background px-2 py-2 text-sm text-text"
            >
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Guardian</option>
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text/40" />
              <input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search student by name or admission no..."
                className="w-full pl-9 pr-3 py-2 rounded border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {searching && <Loader2 className="h-4 w-4 animate-spin text-primary" />}

          {searchResults && searchResults.length > 0 && (
            <ul className="space-y-1">
              {searchResults.map((s) => {
                const alreadyLinked = linkedIds.has(s.id);
                return (
                  <li key={s.id} className="flex items-center justify-between text-sm px-2 py-1.5 hover:bg-border/20 rounded">
                    <span>{s.first_name} {s.last_name} <span className="text-text/40">({s.admission_number})</span></span>
                    <button
                      onClick={() => handleLink(s.id)}
                      disabled={alreadyLinked || linkingId === s.id}
                      className="flex items-center gap-1 text-primary text-xs hover:underline disabled:opacity-40 disabled:no-underline"
                    >
                      <Link2 className="h-3 w-3" />
                      {alreadyLinked ? "Already linked" : linkingId === s.id ? "Linking..." : "Link"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {studentSearch.length > 1 && searchResults?.length === 0 && !searching && (
            <p className="text-sm text-text/50">No students found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ParentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [managingParent, setManagingParent] = useState<ParentRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["parents", search, page],
    queryFn: async () => {
      const { data } = await apiClient.get("/parents", { params: { search, page, page_size: 20 } });
      return data as { data: ParentRow[]; pagination: { total: number; page: number; page_size: number } };
    },
  });

  async function handleDelete(parent: ParentRow) {
    if (!confirm(`Delete ${parent.full_name}? This can't be undone.`)) return;
    setDeletingId(parent.id);
    try {
      await apiClient.delete(`/parents/${parent.id}`);
      toast.success("Parent deleted.");
      queryClient.invalidateQueries({ queryKey: ["parents"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't delete parent.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Parents</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Parent
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
          placeholder="Search by name, email, or phone..."
          className="w-full pl-9 pr-3 py-2 rounded border border-border bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !data?.data?.length ? (
          <div className="py-16 text-center text-text/50 text-sm">No parents found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-border/20 text-text/70 text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Contact via</th>
                <th className="px-4 py-3">Children</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-border/10">
                  <td className="px-4 py-3">{p.full_name}</td>
                  <td className="px-4 py-3">{p.phone_number || "—"}</td>
                  <td className="px-4 py-3">{p.email || "—"}</td>
                  <td className="px-4 py-3 capitalize">{p.preferred_contact_method}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setManagingParent(p)}
                      className="text-primary text-sm hover:underline flex items-center gap-1"
                    >
                      <Link2 className="h-3 w-3" /> Manage
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={deletingId === p.id}
                      className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      {deletingId === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Delete
                    </button>
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

      {showAddModal && <AddParentModal onClose={() => setShowAddModal(false)} />}
      {managingParent && <ManageChildrenModal parent={managingParent} onClose={() => setManagingParent(null)} />}
    </div>
  );
}
