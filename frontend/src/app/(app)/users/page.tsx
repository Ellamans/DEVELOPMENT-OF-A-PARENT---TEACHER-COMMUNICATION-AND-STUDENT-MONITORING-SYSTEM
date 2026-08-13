"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Search, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  gender: string | null;
  date_of_birth: string | null;
  status: string;
  roles: string[];
  has_profile: boolean | null;
}

const PROFILE_ROLE_LABEL: Record<string, string> = {
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", search],
    queryFn: async () => {
      const { data } = await apiClient.get("/users", { params: { search, page: 1, page_size: 50 } });
      return data as { data: UserRow[]; pagination: { total: number } };
    },
  });

  async function createProfile(u: UserRow, role: "teacher" | "parent" | "student") {
    setCreatingFor(u.id);
    try {
      if (role === "teacher") {
        await apiClient.post("/teachers", { user_id: u.id });
      } else if (role === "parent") {
        await apiClient.post("/parents", {
          user_id: u.id, full_name: `${u.first_name} ${u.last_name}`,
          email: u.email, phone_number: u.phone_number,
        });
      } else {
        await apiClient.post("/students", {
          user_id: u.id, first_name: u.first_name, last_name: u.last_name,
          gender: u.gender || null, date_of_birth: u.date_of_birth || null,
        });
      }
      toast.success(`${PROFILE_ROLE_LABEL[role]} profile created.`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || `Couldn't create a ${role} profile for this account.`);
    } finally {
      setCreatingFor(null);
    }
  }

  function profileRole(u: UserRow): "teacher" | "parent" | "student" | null {
    if (u.roles.includes("teacher")) return "teacher";
    if (u.roles.includes("parent")) return "parent";
    if (u.roles.includes("student")) return "student";
    return null;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-1">Users</h2>
      <p className="text-sm text-text/60 mb-4">
        Login accounts. For teacher, parent, and student roles, a separate school-record profile is what actually
        shows them on the Teachers/Parents/Students pages — accounts missing one show a "Create Profile" action below.
      </p>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-text/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
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
            Couldn't load users. You may not have permission to view this page.
          </div>
        ) : !data?.data?.length ? (
          <div className="py-16 text-center text-text/50 text-sm">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-border/20 text-text/70 text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role(s)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Profile</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((u) => {
                const role = profileRole(u);
                return (
                  <tr key={u.id} className="border-t border-border hover:bg-border/10">
                    <td className="px-4 py-3">{u.first_name} {u.last_name}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3 capitalize">{u.roles.join(", ").replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", u.status === "active" ? "bg-green-500/10 text-green-600" : "bg-border text-text/60")}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {role === null ? (
                        <span className="text-text/30 text-xs">—</span>
                      ) : u.has_profile ? (
                        <span className="text-xs text-green-600">{PROFILE_ROLE_LABEL[role]} profile exists</span>
                      ) : (
                        <button
                          onClick={() => createProfile(u, role)}
                          disabled={creatingFor === u.id}
                          className="flex items-center gap-1 text-xs bg-primary text-white px-2.5 py-1.5 rounded font-medium hover:opacity-90 disabled:opacity-60"
                        >
                          {creatingFor === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                          Create {PROFILE_ROLE_LABEL[role]} Profile
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
