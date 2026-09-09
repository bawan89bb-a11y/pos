import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { productsRouter, brandsRouter, suppliersRouter } from "./routers/catalog";
import { customersRouter } from "./routers/customers";
import { salesRouter } from "./routers/sales";
import { expensesRouter, expenseTypesRouter } from "./routers/expenses";
import { settingsRouter } from "./routers/settings";
import { usersRouter } from "./routers/users";
import { quickKeysRouter } from "./routers/quickkeys";
import { reportsRouter } from "./routers/reports";
import { dashboardRouter, alertsRouter } from "./routers/dashboard";

export const appRouter = router({
  auth: authRouter,
  products: productsRouter,
  brands: brandsRouter,
  suppliers: suppliersRouter,
  customers: customersRouter,
  sales: salesRouter,
  expenses: expensesRouter,
  expenseTypes: expenseTypesRouter,
  settings: settingsRouter,
  users: usersRouter,
  quickKeys: quickKeysRouter,
  reports: reportsRouter,
  dashboard: dashboardRouter,
  alerts: alertsRouter,
});

export type AppRouter = typeof appRouter;
