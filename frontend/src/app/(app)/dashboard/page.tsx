"use client";

import { useAuth } from "@/context/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div>
      <h2 className="text-xl font-semibold text-text mb-2">
        Welcome, {user?.first_name}
      </h2>
      <p className="text-text/60 text-sm">
        Role-specific dashboard widgets are implemented in PPS-007.
      </p>
    </div>
  );
}
