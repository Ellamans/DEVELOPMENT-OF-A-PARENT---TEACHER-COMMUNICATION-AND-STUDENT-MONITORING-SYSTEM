"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Search, Loader2 } from "lucide-react";

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  roles: string[];
}

export default function UsersPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", search],
    queryFn: async () => {
      const { data } = await apiClient.get("/users", { params: { search, page: 1, page_size: 50 } });
      return data as { data: UserRow[]; pagination: { total: number } };
    },
  });

  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-4">Users</h2>

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
              </tr>
            </thead>
            <tbody>
              {data.data.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-border/10">
                  <td className="px-4 py-3">{u.first_name} {u.last_name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3 capitalize">{u.roles.join(", ").replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 capitalize">{u.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
