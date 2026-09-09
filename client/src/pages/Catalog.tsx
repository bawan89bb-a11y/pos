import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/Shell";
import ProductsTab from "./catalog/ProductsTab";
import BrandsTab from "./catalog/BrandsTab";
import SuppliersTab from "./catalog/SuppliersTab";

export default function Catalog() {
  return (
    <AppShell title="Catalog">
      <div className="px-[18px] pt-[14px]">
        <div className="flex gap-5 border-b text-[13px]" style={{ borderColor: "var(--line)" }}>
          {[
            { to: "/catalog/products", label: "Products" },
            { to: "/catalog/brands", label: "Brands" },
            { to: "/catalog/suppliers", label: "Suppliers" },
          ].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className="pb-3 font-medium"
              style={({ isActive }) => ({
                color: isActive ? "var(--brand)" : "var(--ink-3)",
                borderBottom: isActive ? "2px solid var(--brand)" : "2px solid transparent",
              })}
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>
      <Routes>
        <Route index element={<Navigate to="products" replace />} />
        <Route path="products" element={<ProductsTab />} />
        <Route path="brands" element={<BrandsTab />} />
        <Route path="suppliers" element={<SuppliersTab />} />
      </Routes>
    </AppShell>
  );
}
