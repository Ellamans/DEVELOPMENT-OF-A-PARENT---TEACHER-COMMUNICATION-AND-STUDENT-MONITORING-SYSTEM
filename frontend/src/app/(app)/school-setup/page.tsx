"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SchoolProfile {
  name: string;
  motto: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
}

const EMPTY: SchoolProfile = { name: "", motto: "", email: "", phone: "", address: "", city: "", state: "", country: "Nigeria" };

export default function SchoolSetupPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SchoolProfile>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["school-profile"],
    queryFn: async () => {
      const { data } = await apiClient.get("/school-setup/school-profile");
      return data as { data: SchoolProfile | null };
    },
  });

  useEffect(() => {
    if (data?.data) setForm({ ...EMPTY, ...data.data });
  }, [data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.put("/school-setup/school-profile", form);
      toast.success("School profile saved.");
      queryClient.invalidateQueries({ queryKey: ["school-profile"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Only admins can edit the school profile.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const field = (key: keyof SchoolProfile, label: string, required = false) => (
    <div>
      <label className="block text-sm font-medium text-text mb-1">{label}</label>
      <input
        value={form[key] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        required={required}
        className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-text mb-1">School Setup</h2>
      <p className="text-text/60 text-sm mb-6">Basic information shown across the system and on report cards.</p>

      <form onSubmit={handleSave} className="bg-card border border-border rounded-lg p-6 space-y-4">
        {field("name", "School Name", true)}
        {field("motto", "School Motto")}
        <div className="grid grid-cols-2 gap-4">
          {field("email", "School Email")}
          {field("phone", "School Phone")}
        </div>
        {field("address", "Address")}
        <div className="grid grid-cols-2 gap-4">
          {field("city", "City")}
          {field("state", "State")}
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Changes
        </button>
      </form>
    </div>
  );
}
