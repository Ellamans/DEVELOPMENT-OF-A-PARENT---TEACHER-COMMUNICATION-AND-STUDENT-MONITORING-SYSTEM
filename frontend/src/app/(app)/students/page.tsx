"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Search, Loader2, Plus } from "lucide-react";

interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  status: string;
}

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["students", search, page],
    queryFn: async () => {
      const { data } = await apiClient.get("/students", { params: { search, page, page_size: 20 } });
      return data as { data: Student[]; pagination: { total: number; page: number; page_size: number } };
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Students</h2>
        <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Add Student
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
          placeholder="Search by name or admission number..."
          className="w-full pl-9 pr-3 py-2 rounded border border-border bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !data?.data?.length ? (
          <div className="py-16 text-center text-text/50 text-sm">No students found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-border/20 text-text/70 text-left">
              <tr>
                <th className="px-4 py-3">Admission No.</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-border/10">
                  <td className="px-4 py-3">{s.admission_number}</td>
                  <td className="px-4 py-3">{s.first_name} {s.last_name}</td>
                  <td className="px-4 py-3 capitalize">{s.status}</td>
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
    </div>
  );
}
