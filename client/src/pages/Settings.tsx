import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/Shell";
import BusinessSection from "./settings/BusinessSection";
import StockExpirySection from "./settings/StockExpirySection";
import QuickKeysSection from "./settings/QuickKeysSection";
import UsersSection from "./settings/UsersSection";
import ExpenseTypesSection from "./settings/ExpenseTypesSection";
import DataBackupSection from "./settings/DataBackupSection";

const SECTIONS = [
  { to: "business", label: "Business & invoice" },
  { to: "expiry", label: "Stock & expiry" },
  { to: "quickkeys", label: "Quick keys" },
  { to: "users", label: "Users & permissions" },
  { to: "types", label: "Expense types" },
  { to: "data", label: "Data & backup" },
];

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <div className="flex h-full">
        <nav className="w-[220px] shrink-0 p-4 flex flex-col gap-0.5 border-r" style={{ borderColor: "var(--line)" }}>
          {SECTIONS.map((s) => (
            <NavLink
              key={s.to}
              to={`/settings/${s.to}`}
              className="px-3 py-2 rounded-lg text-[13px] font-medium"
              style={({ isActive }) => ({
                background: isActive ? "var(--brand-soft)" : "transparent",
                color: isActive ? "var(--brand)" : "var(--ink-2)",
              })}
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<Navigate to="business" replace />} />
            <Route path="business" element={<BusinessSection />} />
            <Route path="expiry" element={<StockExpirySection />} />
            <Route path="quickkeys" element={<QuickKeysSection />} />
            <Route path="users" element={<UsersSection />} />
            <Route path="types" element={<ExpenseTypesSection />} />
            <Route path="data" element={<DataBackupSection />} />
          </Routes>
        </div>
      </div>
    </AppShell>
  );
}
