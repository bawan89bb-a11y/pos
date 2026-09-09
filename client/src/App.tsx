import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./lib/toast";
import { can, type PageId } from "@thoth/shared";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Register from "./pages/Register";
import Sales from "./pages/Sales";
import Catalog from "./pages/Catalog";
import Customers from "./pages/Customers";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";

function Guard({ page, children }: { page: PageId; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!can(user?.perms, page, "view")) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function Shell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen" style={{ background: "var(--plane)" }} />
    );
  }

  if (!user) return <Login />;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Guard page="dashboard">
            <Dashboard />
          </Guard>
        }
      />
      <Route
        path="/sell"
        element={
          <Guard page="register">
            <Register />
          </Guard>
        }
      />
      <Route
        path="/sales"
        element={
          <Guard page="sales">
            <Sales />
          </Guard>
        }
      />
      <Route
        path="/catalog/*"
        element={
          <Guard page="catalog">
            <Catalog />
          </Guard>
        }
      />
      <Route
        path="/customers"
        element={
          <Guard page="customers">
            <Customers />
          </Guard>
        }
      />
      <Route
        path="/expenses"
        element={
          <Guard page="expenses">
            <Expenses />
          </Guard>
        }
      />
      <Route
        path="/reports"
        element={
          <Guard page="reports">
            <Reports />
          </Guard>
        }
      />
      <Route
        path="/settings/*"
        element={
          <Guard page="settings">
            <SettingsPage />
          </Guard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
