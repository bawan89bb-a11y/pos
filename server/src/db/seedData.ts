import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "./client";
import { newId, newCustomerCode } from "./ids";
import { hashPassword } from "./auth";
import { presetForRole } from "@thoth/shared";
import { computeCartTotals } from "@thoth/shared";

const DAY = 86400000;

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}
function dateStr(msFromNow: number): string {
  const d = new Date(Date.now() + msFromNow);
  return d.toISOString().slice(0, 10);
}

async function clearAll() {
  const tables = [
    schema.refunds,
    schema.salePayments,
    schema.saleLines,
    schema.sales,
    schema.carts,
    schema.accountPayments,
    schema.expenses,
    schema.expenseTypes,
    schema.quickKeyLayouts,
    schema.customers,
    schema.products,
    schema.brands,
    schema.suppliers,
    schema.sessions,
    schema.users,
    schema.settings,
  ];
  for (const t of tables) {
    await db.delete(t as any);
  }
}

export async function seedDemoData() {
  console.log("Clearing existing data...");
  await clearAll();

  console.log("Seeding settings...");
  await db.insert(schema.settings).values({
    id: 1,
    store: "Thoth Corner Store",
    addr: "14 Al-Rasheed Street, Baghdad",
    phone: "+964 770 123 4567",
    email: "hello@thothcorner.example",
    logo: "",
    currency: "$",
    taxRate: "0.0800",
    receiptFooter: "Thank you for shopping with us!",
    invoiceTitle: "INVOICE",
    showLogoOnInvoice: true,
    docFormat: "receipt",
    quickKeys: true,
    activeLayoutId: "",
    expiryWarnMonths: 6,
    expiryUrgentMonths: 3,
  });

  console.log("Seeding users...");
  const ownerPass = await hashPassword("owner123");
  const managerPass = await hashPassword("manager123");
  const cashierPass = await hashPassword("cashier123");

  const ownerId = newId("usr");
  const managerId = newId("usr");
  const cashierId = newId("usr");

  await db.insert(schema.users).values([
    {
      id: ownerId,
      name: "Amira Hassan",
      username: "owner",
      passHash: ownerPass.hash,
      passSalt: ownerPass.salt,
      email: "amira@thothcorner.example",
      role: "Owner",
      active: true,
      perms: presetForRole("Owner"),
      createdAt: Date.now() - 200 * DAY,
    },
    {
      id: managerId,
      name: "Karim Saleh",
      username: "manager",
      passHash: managerPass.hash,
      passSalt: managerPass.salt,
      email: "karim@thothcorner.example",
      role: "Manager",
      active: true,
      perms: presetForRole("Manager"),
      createdAt: Date.now() - 150 * DAY,
    },
    {
      id: cashierId,
      name: "Lina Youssef",
      username: "cashier",
      passHash: cashierPass.hash,
      passSalt: cashierPass.salt,
      email: "lina@thothcorner.example",
      role: "Cashier",
      active: true,
      perms: presetForRole("Cashier"),
      createdAt: Date.now() - 90 * DAY,
    },
  ]);
  const cashiers = [ownerId, managerId, cashierId];

  console.log("Seeding brands & suppliers...");
  const brandNames = ["Freshly Baked", "PureSip", "GreenValley", "HomeClean", "SnackTime"];
  const brandIds: Record<string, string> = {};
  for (const name of brandNames) {
    const id = newId("brd");
    brandIds[name] = id;
    await db.insert(schema.brands).values({ id, name, note: "", active: true });
  }

  const supplierNames = [
    "Baghdad Wholesale Co.",
    "Tigris Distributors",
    "Nile Foods Trading",
    "Euphrates Supply",
  ];
  const supplierIds: Record<string, string> = {};
  for (const name of supplierNames) {
    const id = newId("sup");
    supplierIds[name] = id;
    await db.insert(schema.suppliers).values({
      id,
      name,
      contact: "Sales desk",
      phone: `+964 77${rand(0, 9)} ${rand(100, 999)} ${rand(1000, 9999)}`,
      email: `sales@${name.toLowerCase().replace(/[^a-z]/g, "")}.example`,
      note: pick(["Net 30", "Net 15", "Due on receipt", "Net 45"]),
      active: true,
    });
  }

  console.log("Seeding products...");
  interface SeedProduct {
    name: string;
    sku: string;
    category: string;
    brand: string;
    supplier: string;
    cost: number;
    price: number;
    stock: number;
    lowAt: number;
    color: string;
    expiryDays: number | null; // null = untracked
  }

  const productDefs: SeedProduct[] = [
    // Bakery — shelf life in days
    { name: "Sourdough Loaf", sku: "BAK-001", category: "Bakery", brand: "Freshly Baked", supplier: "Baghdad Wholesale Co.", cost: 180, price: 450, stock: 14, lowAt: 5, color: "#eda100", expiryDays: 3 },
    { name: "Butter Croissant", sku: "BAK-002", category: "Bakery", brand: "Freshly Baked", supplier: "Baghdad Wholesale Co.", cost: 90, price: 250, stock: 3, lowAt: 8, color: "#eda100", expiryDays: 2 },
    { name: "Baguette", sku: "BAK-003", category: "Bakery", brand: "Freshly Baked", supplier: "Baghdad Wholesale Co.", cost: 110, price: 300, stock: 20, lowAt: 6, color: "#eda100", expiryDays: 2 },
    { name: "Cinnamon Roll", sku: "BAK-004", category: "Bakery", brand: "Freshly Baked", supplier: "Baghdad Wholesale Co.", cost: 120, price: 350, stock: 0, lowAt: 5, color: "#eda100", expiryDays: 4 },
    // Drinks — shelf life in months
    { name: "Orange Juice 1L", sku: "DRK-001", category: "Drinks", brand: "PureSip", supplier: "Tigris Distributors", cost: 220, price: 480, stock: 40, lowAt: 10, color: "#2a78d6", expiryDays: 60 },
    { name: "Sparkling Water 500ml", sku: "DRK-002", category: "Drinks", brand: "PureSip", supplier: "Tigris Distributors", cost: 60, price: 150, stock: 90, lowAt: 20, color: "#2a78d6", expiryDays: 270 },
    { name: "Cola 330ml", sku: "DRK-003", category: "Drinks", brand: "PureSip", supplier: "Tigris Distributors", cost: 45, price: 125, stock: 8, lowAt: 15, color: "#2a78d6", expiryDays: 120 },
    { name: "Iced Tea 500ml", sku: "DRK-004", category: "Drinks", brand: "PureSip", supplier: "Tigris Distributors", cost: 70, price: 175, stock: 55, lowAt: 12, color: "#2a78d6", expiryDays: 90 },
    // Grocery — shelf life in months (long)
    { name: "Basmati Rice 5kg", sku: "GRO-001", category: "Grocery", brand: "GreenValley", supplier: "Nile Foods Trading", cost: 950, price: 1650, stock: 25, lowAt: 6, color: "#1baf7a", expiryDays: 540 },
    { name: "Olive Oil 1L", sku: "GRO-002", category: "Grocery", brand: "GreenValley", supplier: "Nile Foods Trading", cost: 480, price: 890, stock: 18, lowAt: 6, color: "#1baf7a", expiryDays: 450 },
    { name: "Pasta 500g", sku: "GRO-003", category: "Grocery", brand: "GreenValley", supplier: "Nile Foods Trading", cost: 90, price: 220, stock: 60, lowAt: 15, color: "#1baf7a", expiryDays: 600 },
    { name: "Canned Tomatoes 400g", sku: "GRO-004", category: "Grocery", brand: "GreenValley", supplier: "Nile Foods Trading", cost: 65, price: 165, stock: 4, lowAt: 12, color: "#1baf7a", expiryDays: 400 },
    // Household — untracked expiry
    { name: "Dish Soap 750ml", sku: "HOU-001", category: "Household", brand: "HomeClean", supplier: "Euphrates Supply", cost: 140, price: 320, stock: 30, lowAt: 8, color: "#4a3aa7", expiryDays: null },
    { name: "Paper Towels 6-pack", sku: "HOU-002", category: "Household", brand: "HomeClean", supplier: "Euphrates Supply", cost: 260, price: 550, stock: 22, lowAt: 6, color: "#4a3aa7", expiryDays: null },
    { name: "Laundry Detergent 2L", sku: "HOU-003", category: "Household", brand: "HomeClean", supplier: "Euphrates Supply", cost: 390, price: 790, stock: 16, lowAt: 5, color: "#4a3aa7", expiryDays: null },
    // Snacks — shelf life in months
    { name: "Potato Chips 150g", sku: "SNK-001", category: "Snacks", brand: "SnackTime", supplier: "Nile Foods Trading", cost: 55, price: 175, stock: 45, lowAt: 10, color: "#e34948", expiryDays: 150 },
    { name: "Chocolate Bar 100g", sku: "SNK-002", category: "Snacks", brand: "SnackTime", supplier: "Nile Foods Trading", cost: 65, price: 190, stock: 50, lowAt: 12, color: "#e34948", expiryDays: 270 },
    { name: "Mixed Nuts 200g", sku: "SNK-003", category: "Snacks", brand: "SnackTime", supplier: "Nile Foods Trading", cost: 180, price: 420, stock: 9, lowAt: 10, color: "#e34948", expiryDays: 200 },
  ];

  const productIds: string[] = [];
  const productRows: (typeof schema.products.$inferSelect)[] = [];
  for (const p of productDefs) {
    const id = newId("prd");
    productIds.push(id);
    const row = {
      id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      brandId: brandIds[p.brand],
      supplierId: supplierIds[p.supplier],
      cost: p.cost,
      price: p.price,
      stock: p.stock,
      lowAt: p.lowAt,
      taxable: true,
      color: p.color,
      active: true,
      tags: [p.category.toLowerCase()],
      poRef: `PO-${rand(1000, 9999)}`,
      expiry: p.expiryDays === null ? null : dateStr(p.expiryDays * DAY),
      expiryWarnMonths: null,
      createdAt: Date.now() - rand(30, 400) * DAY,
    };
    await db.insert(schema.products).values(row);
    productRows.push(row as any);
  }

  console.log("Seeding customers...");
  const customerDefs = [
    { firstName: "Bawan", lastName: "Ismail", phone: "009647701470374", email: "bawan@example.com", group: "VIP" as const, balance: -17960 },
    { firstName: "Sara", lastName: "Ahmed", phone: "+964 750 222 3344", email: "sara.ahmed@example.com", group: "Wholesale" as const, balance: 0 },
    { firstName: "Omar", lastName: "Faisal", phone: "+964 771 555 8899", email: "omar.f@example.com", group: "All customers" as const, balance: 0 },
    { firstName: "Noor", lastName: "Kareem", phone: "+964 772 900 1122", email: "noor.k@example.com", group: "Staff" as const, balance: 5000 },
    { firstName: "Yusuf", lastName: "Aziz", phone: "+964 780 334 5566", email: "yusuf.aziz@example.com", group: "All customers" as const, balance: 0 },
  ];
  const customerIds: string[] = [];
  for (const c of customerDefs) {
    const id = newId("cus");
    customerIds.push(id);
    await db.insert(schema.customers).values({
      id,
      firstName: c.firstName,
      lastName: c.lastName,
      name: `${c.firstName} ${c.lastName}`,
      code: newCustomerCode(c.firstName),
      phone: c.phone,
      email: c.email,
      group: c.group,
      shipping: "",
      billing: "",
      notes: "",
      balance: c.balance,
      createdAt: Date.now() - rand(60, 300) * DAY,
    });
  }

  console.log("Seeding ~60 days of sales...");
  let seqCounter = 0;
  const taxRate = 0.08;
  for (let daysAgo = 60; daysAgo >= 0; daysAgo--) {
    const salesToday = rand(3, 9);
    for (let s = 0; s < salesToday; s++) {
      const hour = rand(8, 21);
      const minute = rand(0, 59);
      const ts = Date.now() - daysAgo * DAY - (24 - hour) * 3600000 - minute * 60000;

      const lineCount = rand(1, 4);
      const chosenProducts = new Set<number>();
      while (chosenProducts.size < lineCount) chosenProducts.add(rand(0, productRows.length - 1));

      const lines = [...chosenProducts].map((idx) => {
        const p = productRows[idx];
        const qty = rand(1, 3);
        const discountPct = Math.random() < 0.15 ? pick([5, 10, 15]) : 0;
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          unitPrice: p.price,
          qty,
          discountPct,
          taxable: p.taxable,
        };
      });

      const cartDiscountPct = Math.random() < 0.1 ? pick([5, 10]) : 0;
      const totals = computeCartTotals(lines, cartDiscountPct, taxRate);

      const hasCustomer = Math.random() < 0.35;
      const customerId = hasCustomer ? pick(customerIds) : null;

      const method = pick<"cash" | "card" | "gift">(["cash", "cash", "card", "card", "gift"]);
      const payAmount = totals.total;

      const saleId = newId("sal");
      seqCounter++;
      await db.insert(schema.sales).values({
        id: saleId,
        no: `#${1000 + seqCounter}`,
        ts,
        userId: pick(cashiers),
        customerId,
        discountPct: cartDiscountPct,
        subtotal: totals.subtotal,
        discount: totals.cartDiscount,
        tax: totals.tax,
        total: totals.total,
        change: 0,
        onAccount: 0,
        status: "completed",
        note: "",
        voidReason: "",
        voidedAt: null,
      });

      await db.insert(schema.saleLines).values(
        lines.map((l, i) => ({
          id: newId("sln"),
          saleId,
          lineIndex: i,
          productId: l.productId,
          name: l.name,
          sku: l.sku,
          unitPrice: l.unitPrice,
          qty: l.qty,
          discountPct: l.discountPct,
          taxable: l.taxable,
        }))
      );

      await db.insert(schema.salePayments).values({
        id: newId("pay"),
        saleId,
        method,
        amount: payAmount,
        ref: method === "card" ? `**** ${rand(1000, 9999)}` : "",
      });
    }
  }

  console.log("Seeding expense types & expenses...");
  const expenseTypeDefs = [
    { name: "Rent", color: "#2a78d6" },
    { name: "Utilities", color: "#eb6834" },
    { name: "Wages", color: "#1baf7a" },
    { name: "Restocking", color: "#eda100" },
    { name: "Marketing", color: "#e87ba4" },
    { name: "Maintenance", color: "#4a3aa7" },
  ];
  const expenseTypeIds: Record<string, string> = {};
  for (const t of expenseTypeDefs) {
    const id = newId("ety");
    expenseTypeIds[t.name] = id;
    await db.insert(schema.expenseTypes).values({ id, name: t.name, note: "", color: t.color });
  }

  for (let daysAgo = 60; daysAgo >= 0; daysAgo--) {
    const ts = Date.now() - daysAgo * DAY - rand(1, 20) * 3600000;
    if (daysAgo % 30 === 1) {
      await db.insert(schema.expenses).values({
        id: newId("exp"),
        ts,
        typeId: expenseTypeIds["Rent"],
        amount: 120000,
        vendor: "Al-Rasheed Properties",
        method: "Bank transfer",
        note: "Monthly rent",
      });
    }
    if (daysAgo % 15 === 3) {
      await db.insert(schema.expenses).values({
        id: newId("exp"),
        ts,
        typeId: expenseTypeIds["Utilities"],
        amount: rand(8000, 15000),
        vendor: "City Power & Water",
        method: "Direct debit",
        note: "",
      });
    }
    if (daysAgo % 7 === 0) {
      await db.insert(schema.expenses).values({
        id: newId("exp"),
        ts,
        typeId: expenseTypeIds["Wages"],
        amount: rand(15000, 25000),
        vendor: "Payroll",
        method: "Bank transfer",
        note: "Weekly wages",
      });
    }
    if (Math.random() < 0.15) {
      await db.insert(schema.expenses).values({
        id: newId("exp"),
        ts,
        typeId: expenseTypeIds["Restocking"],
        amount: rand(8000, 20000),
        vendor: pick(supplierNames),
        method: pick(["Cash", "Card", "Bank transfer"] as const),
        note: "",
      });
    }
    if (Math.random() < 0.08) {
      await db.insert(schema.expenses).values({
        id: newId("exp"),
        ts,
        typeId: expenseTypeIds["Marketing"],
        amount: rand(3000, 12000),
        vendor: "Local Print Shop",
        method: "Card",
        note: "",
      });
    }
    if (Math.random() < 0.05) {
      await db.insert(schema.expenses).values({
        id: newId("exp"),
        ts,
        typeId: expenseTypeIds["Maintenance"],
        amount: rand(5000, 20000),
        vendor: "City Fixit Services",
        method: "Cash",
        note: "",
      });
    }
  }

  console.log("Seeding quick-key layout...");
  const layoutId = newId("qkl");
  const folderId = newId("qkl");
  const eightProducts = productRows.slice(0, 8);
  const keys = eightProducts.map((p) => ({
    id: newId("qkk"),
    type: "product" as const,
    label: p.name,
    color: p.color,
    productId: p.id,
  }));
  const snackFolderKeys = productRows.slice(15, 18).map((p) => ({
    id: newId("qkk"),
    type: "product" as const,
    label: p.name,
    color: p.color,
    productId: p.id,
  }));
  const folder = {
    id: newId("qkk"),
    type: "folder" as const,
    label: "Snacks",
    color: "#e34948",
    keys: [...snackFolderKeys, ...Array(20 - snackFolderKeys.length).fill(null)],
  };
  const pageKeys: (typeof keys[number] | typeof folder | null)[] = [...keys, folder, ...Array(20 - keys.length - 1).fill(null)];

  await db.insert(schema.quickKeyLayouts).values({
    id: layoutId,
    name: "Front counter",
    createdAt: Date.now() - 100 * DAY,
    pages: [{ id: newId("qkp"), name: "Page 1", keys: pageKeys }],
  });
  await db.update(schema.settings).set({ activeLayoutId: layoutId }).where(eq(schema.settings.id, 1));

  console.log("Seed complete.");
  console.log("Dev logins: owner/owner123, manager/manager123, cashier/cashier123");
}

