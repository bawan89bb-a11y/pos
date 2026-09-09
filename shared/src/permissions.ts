export const PAGES = [
  "dashboard",
  "register",
  "sales",
  "catalog",
  "customers",
  "expenses",
  "reports",
  "settings",
] as const;
export type PageId = (typeof PAGES)[number];

export const ACTIONS = ["view", "create", "edit", "delete", "renew", "export", "print"] as const;
export type ActionId = (typeof ACTIONS)[number];

export type Perms = Record<PageId, Record<ActionId, boolean>>;

export type Role = "Owner" | "Manager" | "Cashier" | "Custom";

function allFalse(): Perms {
  const perms = {} as Perms;
  for (const p of PAGES) {
    perms[p] = {} as Record<ActionId, boolean>;
    for (const a of ACTIONS) perms[p][a] = false;
  }
  return perms;
}

function allTrue(): Perms {
  const perms = {} as Perms;
  for (const p of PAGES) {
    perms[p] = {} as Record<ActionId, boolean>;
    for (const a of ACTIONS) perms[p][a] = true;
  }
  return perms;
}

export function presetForRole(role: Role): Perms {
  if (role === "Owner") return allTrue();

  if (role === "Manager") {
    const perms = allTrue();
    perms.settings = { view: true, create: false, edit: false, delete: false, renew: false, export: true, print: true };
    return perms;
  }

  if (role === "Cashier") {
    const perms = allFalse();
    perms.dashboard.view = true;
    perms.register.view = true;
    perms.register.create = true;
    perms.register.edit = true;
    perms.register.print = true;
    perms.sales.view = true;
    perms.sales.create = true;
    perms.sales.renew = true;
    perms.sales.print = true;
    perms.catalog.view = true;
    perms.customers.view = true;
    perms.customers.create = true;
    perms.customers.edit = true;
    perms.expenses.view = true;
    perms.expenses.create = true;
    return perms;
  }

  return allFalse();
}

export function can(perms: Perms | undefined | null, page: PageId, action: ActionId): boolean {
  return Boolean(perms?.[page]?.[action]);
}

/** Fills in defaults (false) for any page/action missing from a stored perms object, e.g. after adding a new page. */
export function migratePerms(stored: Partial<Perms> | undefined | null): Perms {
  const perms = allFalse();
  if (!stored) return perms;
  for (const p of PAGES) {
    const storedPage = (stored as Record<string, Partial<Record<ActionId, boolean>>>)[p];
    if (!storedPage) continue;
    for (const a of ACTIONS) {
      if (typeof storedPage[a] === "boolean") perms[p][a] = storedPage[a] as boolean;
    }
  }
  return perms;
}
