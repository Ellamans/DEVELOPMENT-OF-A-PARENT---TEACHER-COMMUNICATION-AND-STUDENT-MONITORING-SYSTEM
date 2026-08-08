"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, GraduationCap, School, Settings, LogOut, X,
  Contact, BookUser, Bell, UserCheck, ShieldAlert, CalendarCheck, ClipboardList,
  MessageSquare, FileText, CalendarClock, ScrollText, SlidersHorizontal,
  Sliders, PencilLine, Award, Users2, FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: [] as string[] },
  { href: "/students", label: "Students", icon: GraduationCap, roles: ["super_admin", "school_administrator", "teacher", "class_teacher"] },
  { href: "/parents", label: "Parents", icon: Contact, roles: ["super_admin", "school_administrator", "teacher", "class_teacher"] },
  { href: "/teachers", label: "Teachers", icon: BookUser, roles: ["super_admin", "school_administrator"] },
  { href: "/users", label: "Users", icon: Users, roles: ["super_admin", "school_administrator"] },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, roles: ["super_admin", "school_administrator", "teacher", "class_teacher"] },
  { href: "/results", label: "Results Entry", icon: PencilLine, roles: ["super_admin", "school_administrator", "teacher", "class_teacher"] },
  { href: "/report-cards", label: "Report Cards", icon: Award, roles: ["super_admin", "school_administrator", "teacher", "class_teacher", "principal", "vice_principal"] },
  { href: "/grading", label: "Grading Setup", icon: Sliders, roles: ["super_admin", "school_administrator"] },
  { href: "/behaviour", label: "Behaviour", icon: FileText, roles: ["super_admin", "school_administrator", "teacher", "class_teacher", "principal", "vice_principal"] },
  { href: "/assignments", label: "Assignments", icon: ClipboardList, roles: [] },
  { href: "/messaging", label: "Messages", icon: MessageSquare, roles: [] },
  { href: "/meetings", label: "Meetings", icon: CalendarClock, roles: [] },
  { href: "/pta", label: "PTA", icon: Users2, roles: ["super_admin", "school_administrator", "principal"] },
  { href: "/security/visitors", label: "Visitors", icon: UserCheck, roles: ["super_admin", "school_administrator", "security_officer"] },
  { href: "/security/incidents", label: "Incidents", icon: ShieldAlert, roles: ["super_admin", "school_administrator", "security_officer", "principal"] },
  { href: "/notifications", label: "Notifications", icon: Bell, roles: [] },
  { href: "/reports", label: "Reports & Exports", icon: FileSpreadsheet, roles: ["super_admin", "school_administrator", "principal"] },
  { href: "/audit-log", label: "Audit Log", icon: ScrollText, roles: ["super_admin", "school_administrator"] },
  { href: "/school-setup", label: "School Setup", icon: School, roles: ["super_admin", "school_administrator"] },
  { href: "/system-settings", label: "System Settings", icon: SlidersHorizontal, roles: ["super_admin", "school_administrator"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: [] },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, hasRole, logout } = useAuth();

  return (
    <>
      {/* Backdrop: only rendered on mobile while the drawer is open */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          "w-64 shrink-0 bg-sidebar border-r border-border h-screen flex flex-col",
          "fixed inset-y-0 left-0 z-30 transition-transform duration-200 ease-in-out",
          "md:sticky md:top-0 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text">School System</h2>
          <button
            onClick={onClose}
            className="md:hidden text-text/60 hover:text-text"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.filter((item) => item.roles.length === 0 || hasRole(...item.roles)).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
    </>
  );
}
