import {
  mysqlTable,
  varchar,
  int,
  bigint,
  boolean,
  json,
  text,
  mysqlEnum,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import type { Perms } from "@thoth/shared";

// ---------- settings (singleton row, id = 1) ----------
export const settings = mysqlTable("settings", {
  id: int("id").primaryKey().autoincrement(),
  store: varchar("store", { length: 200 }).notNull().default(""),
  addr: varchar("addr", { length: 400 }).notNull().default(""),
  phone: varchar("phone", { length: 60 }).notNull().default(""),
  email: varchar("email", { length: 200 }).notNull().default(""),
  logo: text("logo").notNull().default(""), // data URL, max ~900KB
  currency: varchar("currency", { length: 8 }).notNull().default("$"),
  taxRate: decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000"),
  receiptFooter: varchar("receipt_footer", { length: 400 }).notNull().default(""),
  invoiceTitle: varchar("invoice_title", { length: 60 }).notNull().default("INVOICE"),
  showLogoOnInvoice: boolean("show_logo_on_invoice").notNull().default(true),
  docFormat: mysqlEnum("doc_format", ["receipt", "a4"]).notNull().default("receipt"),
  quickKeys: boolean("quick_keys").notNull().default(true),
  activeLayoutId: varchar("active_layout_id", { length: 40 }).notNull().default(""),
  expiryWarnMonths: int("expiry_warn_months").notNull().default(6),
  expiryUrgentMonths: int("expiry_urgent_months").notNull().default(3),
});

// ---------- users ----------
export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    username: varchar("username", { length: 60 }).notNull(),
    passHash: varchar("pass_hash", { length: 200 }).notNull(),
    passSalt: varchar("pass_salt", { length: 100 }).notNull(),
    email: varchar("email", { length: 200 }).notNull().default(""),
    role: mysqlEnum("role", ["Owner", "Manager", "Cashier", "Custom"]).notNull(),
    active: boolean("active").notNull().default(true),
    perms: json("perms").$type<Perms>().notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    usernameIdx: uniqueIndex("users_username_idx").on(t.username),
  })
);

export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 40 }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
});

// ---------- brands / suppliers ----------
export const brands = mysqlTable("brands", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  note: varchar("note", { length: 400 }).notNull().default(""),
  active: boolean("active").notNull().default(true),
});

export const suppliers = mysqlTable("suppliers", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  contact: varchar("contact", { length: 200 }).notNull().default(""),
  phone: varchar("phone", { length: 60 }).notNull().default(""),
  email: varchar("email", { length: 200 }).notNull().default(""),
  note: varchar("note", { length: 400 }).notNull().default(""),
  active: boolean("active").notNull().default(true),
});

// ---------- products ----------
export const products = mysqlTable(
  "products",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    sku: varchar("sku", { length: 80 }).notNull(),
    category: varchar("category", { length: 100 }).notNull().default(""),
    brandId: varchar("brand_id", { length: 40 }),
    supplierId: varchar("supplier_id", { length: 40 }),
    cost: int("cost").notNull().default(0),
    price: int("price").notNull().default(0),
    stock: int("stock").notNull().default(0),
    lowAt: int("low_at").notNull().default(0),
    taxable: boolean("taxable").notNull().default(true),
    color: varchar("color", { length: 20 }).notNull().default("#5433eb"),
    active: boolean("active").notNull().default(true),
    tags: json("tags").$type<string[]>().notNull().default([]),
    poRef: varchar("po_ref", { length: 100 }).notNull().default(""),
    expiry: varchar("expiry", { length: 10 }), // 'YYYY-MM-DD' or null = untracked
    expiryWarnMonths: int("expiry_warn_months"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    skuIdx: uniqueIndex("products_sku_idx").on(t.sku),
    brandIdx: index("products_brand_idx").on(t.brandId),
    supplierIdx: index("products_supplier_idx").on(t.supplierId),
    activeIdx: index("products_active_idx").on(t.active),
  })
);

// ---------- customers ----------
export const customers = mysqlTable(
  "customers",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    firstName: varchar("first_name", { length: 100 }).notNull().default(""),
    lastName: varchar("last_name", { length: 100 }).notNull().default(""),
    name: varchar("name", { length: 200 }).notNull().default(""),
    code: varchar("code", { length: 40 }).notNull(),
    phone: varchar("phone", { length: 60 }).notNull().default(""),
    email: varchar("email", { length: 200 }).notNull().default(""),
    group: mysqlEnum("group", ["All customers", "Wholesale", "Staff", "VIP"])
      .notNull()
      .default("All customers"),
    shipping: text("shipping").notNull().default(""),
    billing: text("billing").notNull().default(""),
    notes: text("notes").notNull().default(""),
    balance: int("balance").notNull().default(0),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => ({
    codeIdx: uniqueIndex("customers_code_idx").on(t.code),
    phoneIdx: index("customers_phone_idx").on(t.phone),
  })
);

export const accountPayments = mysqlTable(
  "account_payments",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    customerId: varchar("customer_id", { length: 40 }).notNull(),
    ts: bigint("ts", { mode: "number" }).notNull(),
    amount: int("amount").notNull(),
    method: varchar("method", { length: 40 }).notNull(),
    userId: varchar("user_id", { length: 40 }).notNull(),
  },
  (t) => ({
    customerIdx: index("account_payments_customer_idx").on(t.customerId),
  })
);

// ---------- sales ----------
export const sales = mysqlTable(
  "sales",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    seq: int("seq").autoincrement().notNull(),
    no: varchar("no", { length: 30 }).notNull(),
    ts: bigint("ts", { mode: "number" }).notNull(),
    userId: varchar("user_id", { length: 40 }).notNull(),
    customerId: varchar("customer_id", { length: 40 }),
    discountPct: int("discount_pct").notNull().default(0),
    subtotal: int("subtotal").notNull(),
    discount: int("discount").notNull(),
    tax: int("tax").notNull(),
    total: int("total").notNull(),
    change: int("change").notNull().default(0),
    onAccount: int("on_account").notNull().default(0),
    status: mysqlEnum("status", ["completed", "partial", "refunded", "void"])
      .notNull()
      .default("completed"),
    note: text("note").notNull().default(""),
    voidReason: varchar("void_reason", { length: 400 }).notNull().default(""),
    voidedAt: bigint("voided_at", { mode: "number" }),
  },
  (t) => ({
    noIdx: uniqueIndex("sales_no_idx").on(t.no),
    seqIdx: uniqueIndex("sales_seq_idx").on(t.seq),
    tsIdx: index("sales_ts_idx").on(t.ts),
    customerIdx: index("sales_customer_idx").on(t.customerId),
    userIdx: index("sales_user_idx").on(t.userId),
    statusIdx: index("sales_status_idx").on(t.status),
  })
);

export const saleLines = mysqlTable(
  "sale_lines",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    saleId: varchar("sale_id", { length: 40 }).notNull(),
    lineIndex: int("line_index").notNull().default(0),
    productId: varchar("product_id", { length: 40 }),
    name: varchar("name", { length: 200 }).notNull(),
    sku: varchar("sku", { length: 80 }).notNull(),
    unitPrice: int("unit_price").notNull(),
    qty: int("qty").notNull(),
    discountPct: int("discount_pct").notNull().default(0),
    taxable: boolean("taxable").notNull().default(true),
  },
  (t) => ({
    saleIdx: index("sale_lines_sale_idx").on(t.saleId),
  })
);

export const salePayments = mysqlTable(
  "sale_payments",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    saleId: varchar("sale_id", { length: 40 }).notNull(),
    method: mysqlEnum("method", ["cash", "card", "gift"]).notNull(),
    amount: int("amount").notNull(),
    ref: varchar("ref", { length: 100 }).notNull().default(""),
  },
  (t) => ({
    saleIdx: index("sale_payments_sale_idx").on(t.saleId),
  })
);

export const refunds = mysqlTable(
  "refunds",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    saleId: varchar("sale_id", { length: 40 }).notNull(),
    ts: bigint("ts", { mode: "number" }).notNull(),
    amount: int("amount").notNull(),
    reason: varchar("reason", { length: 400 }).notNull().default(""),
    restock: boolean("restock").notNull().default(false),
  },
  (t) => ({
    saleIdx: index("refunds_sale_idx").on(t.saleId),
  })
);

// ---------- expenses ----------
export const expenseTypes = mysqlTable("expense_types", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  note: varchar("note", { length: 400 }).notNull().default(""),
  color: varchar("color", { length: 20 }).notNull().default("#2a78d6"),
});

export const expenses = mysqlTable(
  "expenses",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    ts: bigint("ts", { mode: "number" }).notNull(),
    typeId: varchar("type_id", { length: 40 }).notNull(),
    amount: int("amount").notNull(),
    vendor: varchar("vendor", { length: 200 }).notNull().default(""),
    method: mysqlEnum("method", ["Cash", "Card", "Bank transfer", "Direct debit"])
      .notNull()
      .default("Cash"),
    note: text("note").notNull().default(""),
  },
  (t) => ({
    tsIdx: index("expenses_ts_idx").on(t.ts),
    typeIdx: index("expenses_type_idx").on(t.typeId),
  })
);

// ---------- quick keys ----------
export const quickKeyLayouts = mysqlTable("quick_key_layouts", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  pages: json("pages").notNull(), // (QuickKeyPage[])
});

// ---------- parked carts ----------
export const carts = mysqlTable("carts", {
  id: varchar("id", { length: 40 }).primaryKey(),
  lines: json("lines").notNull(), // CartLine[]
  customerId: varchar("customer_id", { length: 40 }),
  discountPct: int("discount_pct").notNull().default(0),
  note: text("note").notNull().default(""),
  parkedAt: bigint("parked_at", { mode: "number" }).notNull(),
  userId: varchar("user_id", { length: 40 }).notNull(),
});

export const salesRelations = relations(sales, ({ many }) => ({
  lines: many(saleLines),
  payments: many(salePayments),
  refunds: many(refunds),
}));

export const saleLinesRelations = relations(saleLines, ({ one }) => ({
  sale: one(sales, { fields: [saleLines.saleId], references: [sales.id] }),
}));
