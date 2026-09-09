import type { Perms, Role } from "./permissions";

export interface Settings {
  store: string;
  addr: string;
  phone: string;
  email: string;
  logo: string;
  currency: string;
  taxRate: number;
  receiptFooter: string;
  invoiceTitle: string;
  showLogoOnInvoice: boolean;
  docFormat: "receipt" | "a4";
  quickKeys: boolean;
  activeLayoutId: string;
  expiryWarnMonths: number;
  expiryUrgentMonths: number;
}

export interface UserRecord {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  active: boolean;
  perms: Perms;
  createdAt: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brandId: string | null;
  supplierId: string | null;
  cost: number;
  price: number;
  stock: number;
  lowAt: number;
  taxable: boolean;
  color: string;
  active: boolean;
  tags: string[];
  poRef: string;
  expiry: string | null;
  expiryWarnMonths: number | null;
  createdAt: number;
}

export interface Brand {
  id: string;
  name: string;
  note: string;
  active: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  note: string;
  active: boolean;
}

export type CustomerGroup = "All customers" | "Wholesale" | "Staff" | "VIP";

export interface AccountPayment {
  ts: number;
  amount: number;
  method: string;
  userId: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  code: string;
  phone: string;
  email: string;
  group: CustomerGroup;
  shipping: string;
  billing: string;
  notes: string;
  balance: number;
  accountPayments: AccountPayment[];
  createdAt: number;
}

export interface CartLine {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  qty: number;
  discountPct: number;
  taxable: boolean;
}

export interface Cart {
  id: string;
  lines: CartLine[];
  customerId: string | null;
  discountPct: number;
  note: string;
  parkedAt: number | null;
}

export interface Payment {
  method: "cash" | "card" | "gift";
  amount: number;
  ref: string;
}

export interface Refund {
  ts: number;
  amount: number;
  reason: string;
  restock: boolean;
}

export type SaleStatus = "completed" | "partial" | "refunded" | "void";

export interface Sale {
  id: string;
  no: string;
  ts: number;
  userId: string;
  customerId: string | null;
  lines: CartLine[];
  discountPct: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payments: Payment[];
  change: number;
  onAccount: number;
  status: SaleStatus;
  refunds: Refund[];
  note: string;
  voidReason: string;
  voidedAt: number | null;
}

export interface ExpenseType {
  id: string;
  name: string;
  note: string;
  color: string;
}

export interface Expense {
  id: string;
  ts: number;
  typeId: string;
  amount: number;
  vendor: string;
  method: "Cash" | "Card" | "Bank transfer" | "Direct debit";
  note: string;
}

export interface QuickKey {
  id: string;
  type: "product" | "folder";
  label: string;
  color: string;
  productId?: string;
  keys?: (QuickKey | null)[];
}

export interface QuickKeyPage {
  id: string;
  name: string;
  keys: (QuickKey | null)[];
}

export interface QuickKeyLayout {
  id: string;
  name: string;
  createdAt: number;
  pages: QuickKeyPage[];
}
