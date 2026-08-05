"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, School, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: [] as string[] },
  { href: "/users", label: "Users", icon: Users, roles: ["super_admin", "school_administrator"] },
  { href: "/school-setup", label: "School Setup", icon: School, roles: ["super_admin", "school_administrator"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: [] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, hasRole, logout } = useAuth();

  return (
    <aside className="w-64 shrink-0 bg-sidebar border-r border-border h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b border-border">
        <h2 className="font-semibold text-text">School System</h2>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.filter((item) => item.roles.length === 0 || hasRole(...item.roles)).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary text-white" : "text-text/80 hover:bg-border/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="text-sm text-text/80 mb-2 truncate">{user?.email}</div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-red-500 hover:underline w-full"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </aside>
  );
}
