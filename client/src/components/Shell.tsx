import { type ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  ShoppingCart,
  Receipt,
  Package,
  Users,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { can, PAGES, type PageId } from "@thoth/shared";
import { AlertsBell } from "./AlertsBell";

const NAV: { id: PageId; label: string; icon: typeof LayoutGrid; path: string }[] = [
  { id: "dashboard", label: "Home", icon: LayoutGrid, path: "/" },
  { id: "register", label: "Sell", icon: ShoppingCart, path: "/sell" },
  { id: "sales", label: "Sales", icon: Receipt, path: "/sales" },
  { id: "catalog", label: "Catalog", icon: Package, path: "/catalog" },
  { id: "customers", label: "Customers", icon: Users, path: "/customers" },
  { id: "expenses", label: "Expenses", icon: Wallet, path: "/expenses" },
  { id: "reports", label: "Reports", icon: BarChart3, path: "/reports" },
  { id: "settings", label: "Settings", icon: SettingsIcon, path: "/settings" },
];

export function Rail() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const visible = NAV.filter((n) => can(user?.perms, n.id, "view"));

  return (
    <nav
      className="app-rail flex flex-col items-center w-[84px] shrink-0 py-4 gap-1"
      style={{ background: "#161718", color: "#e9eaec" }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-[15px] mb-4"
        style={{ background: "var(--brand)", color: "#fff" }}
      >
        T
      </div>
      {visible.map((n) => (
        <NavLink
          key={n.id}
          to={n.path}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 w-16 py-2.5 rounded-lg text-[10.5px] transition-opacity ${
              isActive ? "opacity-100" : "opacity-60 hover:opacity-90"
            }`
          }
          style={({ isActive }) => ({ background: isActive ? "rgba(255,255,255,0.08)" : "transparent" })}
        >
          <n.icon size={21} strokeWidth={1.8} />
          {n.label}
        </NavLink>
      ))}
      <div className="mt-auto flex flex-col items-center gap-3 pt-4">
        <button onClick={toggle} className="opacity-70 hover:opacity-100" aria-label="Toggle theme">
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <button onClick={() => logout()} className="opacity-70 hover:opacity-100" aria-label="Sign out">
          <LogOut size={19} />
        </button>
      </div>
    </nav>
  );
}

export function Topbar({ title, actions }: { title: string; actions?: ReactNode }) {
  const { user } = useAuth();
  const initials = (user?.name ?? "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      className="app-topbar flex items-center h-14 shrink-0 px-5 gap-4 border-b"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <div className="flex flex-col leading-tight">
        <span className="font-semibold text-[15px]" style={{ color: "var(--ink)" }}>
          {title}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        {actions}
        <AlertsBell />
        <div className="flex items-center gap-2 pl-3 border-l" style={{ borderColor: "var(--line)" }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold"
            style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
          >
            {initials}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
              {user?.name}
            </span>
            <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
              {user?.username} · {user?.role}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-shell flex h-screen w-screen overflow-hidden" style={{ background: "var(--plane)" }}>
      <Rail />
      <div className="app-main flex-1 flex flex-col min-w-0">
        <Topbar title={title} actions={actions} />
        <main className="app-view flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
