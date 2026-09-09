import { useMemo, useState } from "react";
import { trpc } from "../trpc";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { useSettings } from "../lib/settings";
import { formatMoney, computeCartTotals, normalizePhoneDigits, can } from "@thoth/shared";
import type { CartLine, Product, Customer } from "@thoth/shared";
import { Search, X, Minus, Plus as PlusIcon, ChevronDown } from "lucide-react";
import { PaymentDialog } from "../components/PaymentDialog";
import { CustomerCard } from "../components/CustomerCard";
import { DocumentDialog } from "../components/Document";

export default function Register() {
  const { user } = useAuth();
  const { show } = useToast();
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? "$";
  const fmt = (c: number) => formatMoney(c, currency);

  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [cartDiscountPct, setCartDiscountPct] = useState(0);
  const [note, setNote] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [customerCardOpen, setCustomerCardOpen] = useState(false);
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);
  const [parkedListOpen, setParkedListOpen] = useState(false);

  const productsQuery = trpc.products.list.useQuery({ status: "active" });
  const layoutsQuery = trpc.quickKeys.list.useQuery(undefined, { enabled: !!settings?.quickKeys });
  const activeLayout = layoutsQuery.data?.find((l) => l.id === settings?.activeLayoutId) ?? layoutsQuery.data?.[0];
  const [quickPageIdx, setQuickPageIdx] = useState(0);
  const [folderStack, setFolderStack] = useState<any[]>([]);

  const utils = trpc.useUtils();
  const createSale = trpc.sales.create.useMutation();
  const parkCart = trpc.sales.park.useMutation();
  const parkedQuery = trpc.sales.listParked.useQuery(undefined, { enabled: parkedListOpen });
  const retrieveParked = trpc.sales.retrieveParked.useMutation();

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    const s = search.toLowerCase();
    return (productsQuery.data ?? []).filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        p.category.toLowerCase().includes(s) ||
        p.tags.some((t) => t.toLowerCase().includes(s))
    );
  }, [search, productsQuery.data]);

  const customerResults = trpc.customers.list.useQuery(
    { search: customerSearch },
    { enabled: customerSearch.length >= 2 }
  );

  const calcLines = lines.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty, discountPct: l.discountPct, taxable: l.taxable }));
  const totals = computeCartTotals(calcLines, cartDiscountPct, settings?.taxRate ?? 0);

  function addProduct(p: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { productId: p.id, name: p.name, sku: p.sku, unitPrice: p.price, qty: 1, discountPct: 0, taxable: p.taxable }];
    });
    setSearch("");
  }

  function updateLine(productId: string, patch: Partial<CartLine>) {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  function clearSale() {
    setLines([]);
    setCustomer(null);
    setCartDiscountPct(0);
    setNote("");
  }

  async function handlePark() {
    if (!lines.length) return;
    await parkCart.mutateAsync({ lines, customerId: customer?.id ?? null, discountPct: cartDiscountPct, note });
    show("Sale parked");
    clearSale();
  }

  async function handleRetrieve(cartId: string) {
    const cart = await retrieveParked.mutateAsync(cartId);
    if (cart) {
      setLines(cart.lines);
      setCartDiscountPct(cart.discountPct);
      setNote(cart.note);
      if (cart.customerId) {
        const c = await utils.customers.get.fetch(cart.customerId);
        setCustomer(c);
      } else {
        setCustomer(null);
      }
    }
    setParkedListOpen(false);
  }

  async function handleSaleComplete(saleId: string) {
    setCompletedSaleId(saleId);
    setPayOpen(false);
    clearSale();
  }

  return (
    <div className="till flex h-screen w-screen overflow-hidden">
      <div className="flex-1 flex flex-col p-5 min-w-0 overflow-y-auto">
        <label className="mb-3">
          <span className="block font-bold text-[15px] mb-2">Search for products</span>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--till-muted)" }} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Start typing or scanning"
              className="w-full pl-9 pr-3 py-3 text-[14px] rounded-lg outline-none"
              style={{ background: "var(--till-input)", border: "1px solid var(--till-line)", color: "var(--till-ink)" }}
            />
          </div>
        </label>

        {search.trim() ? (
          <ProductGrid products={filteredProducts} onAdd={addProduct} fmt={fmt} />
        ) : (
          <>
            {settings?.quickKeys && activeLayout && (
              <QuickKeysBlock
                layout={activeLayout}
                pageIdx={quickPageIdx}
                setPageIdx={setQuickPageIdx}
                folderStack={folderStack}
                setFolderStack={setFolderStack}
                products={productsQuery.data ?? []}
                onAdd={addProduct}
              />
            )}
            <div className="h-px my-4" style={{ background: "var(--till-line)" }} />
            <ProductGrid products={productsQuery.data ?? []} onAdd={addProduct} fmt={fmt} />
          </>
        )}
      </div>

      <div
        className="w-[420px] shrink-0 flex flex-col"
        style={{ background: "var(--till-panel)", borderLeft: "1px solid var(--till-line)" }}
      >
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-b relative" style={{ borderColor: "var(--till-line)" }}>
          <button
            className="text-[13px] font-medium"
            style={{ color: "var(--till-link)" }}
            onClick={() => setParkedListOpen(true)}
          >
            Retrieve sale
          </button>
          <button
            className="text-[13px]"
            style={{ color: "var(--till-muted)" }}
            onClick={handlePark}
            disabled={!lines.length}
          >
            Park sale
          </button>
          <div className="relative">
            <button
              className="text-[13px] flex items-center gap-1"
              style={{ color: "var(--till-muted)" }}
              onClick={() => setMenuOpen((o) => !o)}
            >
              More actions <ChevronDown size={13} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-8 z-20 w-56 py-1 rounded-lg shadow-xl text-[13px]"
                style={{ background: "var(--till-input)", border: "1px solid var(--till-line)" }}
                onMouseLeave={() => setMenuOpen(false)}
              >
                <MenuItem
                  label="Add discount"
                  onClick={() => {
                    const pct = Number(prompt("Cart discount %", String(cartDiscountPct)) ?? cartDiscountPct);
                    if (!Number.isNaN(pct)) setCartDiscountPct(Math.max(0, Math.min(100, pct)));
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  label="Add note to sale"
                  onClick={() => {
                    const n = prompt("Sale note", note) ?? note;
                    setNote(n);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  label="Retrieve parked sale"
                  onClick={() => {
                    setParkedListOpen(true);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  label="Clear sale"
                  onClick={() => {
                    clearSale();
                    setMenuOpen(false);
                  }}
                />
                <div className="px-3 py-2 opacity-40 cursor-not-allowed">Promo code (not enabled)</div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-b" style={{ borderColor: "var(--till-line)" }}>
          {customer ? (
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
              >
                {customer.firstName[0]}
                {customer.lastName[0]}
              </div>
              <div className="min-w-0 flex-1">
                <button
                  className="text-[13px] font-medium underline block truncate"
                  onClick={() => setCustomerCardOpen(true)}
                >
                  {customer.name}
                </button>
                <div className="text-[11px]" style={{ color: "var(--till-muted)" }}>
                  {customer.code} · {customer.phone}
                </div>
              </div>
              <button
                onClick={() => {
                  const prev = customer;
                  setCustomer(null);
                  show("Customer removed", () => setCustomer(prev));
                }}
                style={{ color: "var(--till-muted)" }}
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customer by name, code, phone or email"
                className="w-full px-3 py-2.5 text-[13px] rounded-lg outline-none"
                style={{ background: "var(--till-input)", border: "1px solid var(--till-line)", color: "var(--till-ink)" }}
              />
              {customerSearch.length >= 2 && (
                <div
                  className="absolute left-0 right-0 top-11 z-20 rounded-lg shadow-xl overflow-hidden"
                  style={{ background: "var(--till-input)", border: "1px solid var(--till-line)" }}
                >
                  {customerResults.data?.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-white/5 flex items-center gap-2"
                      onClick={() => {
                        setCustomer(c);
                        setCustomerSearch("");
                      }}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span style={{ color: "var(--till-muted)" }}>
                        {c.code} · {c.phone}
                      </span>
                    </button>
                  ))}
                  <button
                    className="w-full text-left px-3 py-2 text-[13px]"
                    style={{ color: "var(--till-link)" }}
                    onClick={() => setCustomerCardOpen(true)}
                  >
                    + Add new customer "{customerSearch}"
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {lines.map((line) => (
            <div key={line.productId} className="py-3 border-b" style={{ borderColor: "var(--till-line)" }}>
              <div className="flex justify-between text-[13px] font-medium mb-1.5">
                <span className="truncate pr-2">{line.name}</span>
                <span className="tabular-nums shrink-0">
                  {fmt(Math.round(line.unitPrice * line.qty * (1 - line.discountPct / 100)))}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--till-muted)" }}>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => updateLine(line.productId, { qty: Math.max(1, line.qty - 1) })}>
                    <Minus size={13} />
                  </button>
                  <span className="tabular-nums w-5 text-center">{line.qty}</span>
                  <button onClick={() => updateLine(line.productId, { qty: line.qty + 1 })}>
                    <PlusIcon size={13} />
                  </button>
                </div>
                <span className="tabular-nums">@ {fmt(line.unitPrice)}</span>
                <button
                  style={{ color: "var(--till-link)" }}
                  onClick={() => {
                    const pct = Number(prompt("Line discount %", String(line.discountPct)) ?? line.discountPct);
                    if (!Number.isNaN(pct)) updateLine(line.productId, { discountPct: Math.max(0, Math.min(100, pct)) });
                  }}
                >
                  {line.discountPct > 0 ? `${line.discountPct}% off` : "Discount"}
                </button>
                <button className="ml-auto" onClick={() => removeLine(line.productId)}>
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
          {!lines.length && (
            <div className="py-10 text-center text-[13px]" style={{ color: "var(--till-muted)" }}>
              Search or tap a product to start this sale.
            </div>
          )}
        </div>

        <div className="px-4 py-3 text-[13px] font-bold tracking-[0.09em]" style={{ color: "var(--till-muted)" }}>
          ADD
          <span className="ml-4 font-normal tracking-normal text-[12px]" style={{ color: "var(--till-link)" }}>
            <button
              onClick={() => {
                const pct = Number(prompt("Cart discount %", String(cartDiscountPct)) ?? cartDiscountPct);
                if (!Number.isNaN(pct)) setCartDiscountPct(Math.max(0, Math.min(100, pct)));
              }}
            >
              Discount
            </button>
          </span>
          <span className="ml-4 font-normal tracking-normal text-[12px] opacity-40 cursor-not-allowed" onClick={() => show("Promo codes are not enabled")}>
            🔒 Promo code
          </span>
          <span className="ml-4 font-normal tracking-normal text-[12px]" style={{ color: "var(--till-link)" }}>
            <button
              onClick={() => {
                const n = prompt("Sale note", note) ?? note;
                setNote(n);
              }}
            >
              Note
            </button>
          </span>
        </div>

        <div className="px-4 pb-3 flex justify-between text-[14px] font-medium">
          <span style={{ color: "var(--till-muted)" }}>Subtotal</span>
          <span className="tabular-nums">{fmt(totals.subtotal)}</span>
        </div>

        <div className="p-4">
          <button
            disabled={!lines.length || !can(user?.perms, "register", "create")}
            onClick={() => setPayOpen(true)}
            className="w-full py-3.5 rounded-lg font-semibold text-[15px] tabular-nums disabled:opacity-40"
            style={{ background: lines.length ? "var(--brand)" : "var(--till-input)", color: "#fff" }}
          >
            Pay · {lines.reduce((s, l) => s + l.qty, 0)} items · {fmt(totals.total)}
          </button>
        </div>
      </div>

      {payOpen && (
        <PaymentDialog
          total={totals.total}
          customer={customer}
          onClose={() => setPayOpen(false)}
          onComplete={async (payments, putOnAccount) => {
            const sale = await createSale.mutateAsync({
              customerId: customer?.id ?? null,
              lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, discountPct: l.discountPct })),
              discountPct: cartDiscountPct,
              note,
              payments,
              putOnAccount,
            });
            handleSaleComplete(sale.id);
          }}
        />
      )}

      {completedSaleId && <DocumentDialog saleId={completedSaleId} onClose={() => setCompletedSaleId(null)} />}

      {customerCardOpen && (
        <CustomerCard
          customerId={customer?.id}
          prefillPhoneOrName={customerSearch}
          onClose={() => setCustomerCardOpen(false)}
          onSelect={(c) => {
            setCustomer(c);
            setCustomerCardOpen(false);
            setCustomerSearch("");
          }}
        />
      )}

      {parkedListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-[420px] rounded-xl p-4" style={{ background: "var(--till-panel)", color: "var(--till-ink)" }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-[14px]">Parked sales</h3>
              <button onClick={() => setParkedListOpen(false)}>
                <X size={16} />
              </button>
            </div>
            {!parkedQuery.data?.length && (
              <p className="text-[13px]" style={{ color: "var(--till-muted)" }}>
                No parked sales.
              </p>
            )}
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {parkedQuery.data?.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleRetrieve(c.id)}
                  className="text-left px-3 py-2 rounded-lg text-[13px]"
                  style={{ background: "var(--till-input)" }}
                >
                  {c.lines.length} items · {new Date(c.parkedAt ?? Date.now()).toLocaleTimeString()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="w-full text-left px-3 py-2 hover:bg-white/5" onClick={onClick}>
      {label}
    </button>
  );
}

function ProductGrid({ products, onAdd, fmt }: { products: Product[]; onAdd: (p: Product) => void; fmt: (c: number) => string }) {
  if (!products.length) {
    return (
      <div className="text-center py-10 text-[13px]" style={{ color: "var(--till-muted)" }}>
        No products found.
      </div>
    );
  }
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, 143px)" }}>
      {products.map((p) => {
        const outOfStock = (p as any).availableToSell !== undefined ? (p as any).availableToSell <= 0 : p.stock <= 0;
        return (
          <button
            key={p.id}
            disabled={outOfStock}
            onClick={() => onAdd(p)}
            className="text-left rounded-md overflow-hidden flex flex-col disabled:opacity-40"
            style={{ width: 143, height: 115, background: "var(--till-input)", border: "1px solid var(--till-line)" }}
          >
            <div style={{ height: 9, background: `linear-gradient(90deg, ${p.color}, ${p.color}aa)` }} />
            <div className="flex-1 flex items-center justify-center text-center px-2">
              <span className="text-[12.5px] font-medium leading-snug">{p.name}</span>
            </div>
            {outOfStock && (
              <div className="text-center text-[10px] pb-1.5" style={{ color: "var(--till-muted)" }}>
                Out of stock
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function QuickKeysBlock({
  layout,
  pageIdx,
  setPageIdx,
  folderStack,
  setFolderStack,
  products,
  onAdd,
}: {
  layout: any;
  pageIdx: number;
  setPageIdx: (i: number) => void;
  folderStack: any[];
  setFolderStack: (s: any[]) => void;
  products: Product[];
  onAdd: (p: Product) => void;
}) {
  const page = layout.pages[pageIdx] ?? layout.pages[0];
  const currentKeys: any[] = folderStack.length ? folderStack[folderStack.length - 1].keys : page?.keys ?? [];
  const byId = new Map(products.map((p) => [p.id, p]));

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        {folderStack.length > 0 ? (
          <button
            className="text-[12px]"
            style={{ color: "var(--till-link)" }}
            onClick={() => setFolderStack(folderStack.slice(0, -1))}
          >
            ← Back
          </button>
        ) : (
          layout.pages.map((p: any, i: number) => (
            <button
              key={p.id}
              className="text-[12px] font-medium"
              style={{ color: i === pageIdx ? "var(--till-ink)" : "var(--till-muted)" }}
              onClick={() => setPageIdx(i)}
            >
              {p.name}
            </button>
          ))
        )}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(5, 78px)" }}>
        {currentKeys.map((key, i) => {
          if (!key) return <div key={i} style={{ width: 78, height: 78 }} />;
          if (key.type === "folder") {
            return (
              <button
                key={key.id}
                onClick={() => setFolderStack([...folderStack, key])}
                className="rounded-md flex flex-col items-center justify-center text-[11px] font-medium text-center px-1"
                style={{ width: 78, height: 78, background: key.color + "33", border: `1px solid ${key.color}` }}
              >
                {key.label}
                <span className="text-[9px] opacity-70">{(key.keys ?? []).filter(Boolean).length} items</span>
              </button>
            );
          }
          const product = key.productId ? byId.get(key.productId) : null;
          return (
            <button
              key={key.id}
              onClick={() => product && onAdd(product)}
              disabled={!product}
              className="rounded-md flex items-center justify-center text-[11px] font-medium text-center px-1 disabled:opacity-30"
              style={{ width: 78, height: 78, background: key.color + "22", border: `1px solid ${key.color}` }}
            >
              {key.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
