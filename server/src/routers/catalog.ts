import { z } from "zod";
import { router, permProcedure, protectedProcedure } from "../trpc";
import * as catalog from "../db/catalog";
import { parkedQtyByProduct } from "../db/sales";
import { availableToSell } from "@thoth/shared";

const productInput = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().default(""),
  brandId: z.string().nullable().default(null),
  supplierId: z.string().nullable().default(null),
  cost: z.number().int().min(0),
  price: z.number().int().min(0),
  stock: z.number().int(),
  lowAt: z.number().int().min(0),
  taxable: z.boolean(),
  color: z.string(),
  active: z.boolean(),
  tags: z.array(z.string()).default([]),
  poRef: z.string().default(""),
  expiry: z.string().nullable().default(null),
  expiryWarnMonths: z.number().int().nullable().default(null),
});

export const productsRouter = router({
  list: permProcedure("catalog", "view")
    .input(
      z
        .object({
          search: z.string().optional(),
          supplierId: z.string().optional(),
          brandId: z.string().optional(),
          status: z.enum(["active", "inactive", "all"]).optional(),
          expiry: z.enum(["any", "expiringSoon", "expired", "noDate"]).optional(),
          warnMonths: z.number().optional(),
          urgentMonths: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const products = await catalog.listProducts(input ?? {});
      const parked = await parkedQtyByProduct();
      return products.map((p) => ({
        ...p,
        availableToSell: availableToSell(p.stock, parked.get(p.id) ?? 0),
        specialOrderDemand: parked.get(p.id) ?? 0,
      }));
    }),

  get: permProcedure("catalog", "view").input(z.string()).query(({ input }) => catalog.getProduct(input)),

  create: permProcedure("catalog", "create")
    .input(productInput)
    .mutation(({ input }) => catalog.createProduct(input)),

  update: permProcedure("catalog", "edit")
    .input(z.object({ id: z.string(), patch: productInput.partial() }))
    .mutation(({ input }) => catalog.updateProduct(input.id, input.patch)),

  bulkSetActive: permProcedure("catalog", "edit")
    .input(z.object({ ids: z.array(z.string()), active: z.boolean() }))
    .mutation(({ input }) => catalog.bulkSetProductsActive(input.ids, input.active)),

  bulkDelete: permProcedure("catalog", "delete")
    .input(z.array(z.string()))
    .mutation(({ input }) => catalog.bulkDeleteProducts(input)),

  import: permProcedure("catalog", "create")
    .input(
      z.array(
        z.object({
          name: z.string(),
          sku: z.string(),
          category: z.string().default(""),
          brand: z.string().default(""),
          supplier: z.string().default(""),
          cost: z.number().default(0),
          retail: z.number().default(0),
          stock: z.number().default(0),
          tags: z.array(z.string()).default([]),
          expiry: z.string().nullable().default(null),
        })
      )
    )
    .mutation(async ({ input }) => {
      let created = 0;
      let skipped = 0;
      for (const row of input) {
        if (!row.name.trim() || !row.sku.trim()) {
          skipped++;
          continue;
        }
        const brandId = row.brand ? await catalog.findOrCreateBrand(row.brand) : null;
        const supplierId = row.supplier ? await catalog.findOrCreateSupplier(row.supplier) : null;
        try {
          await catalog.createProduct({
            name: row.name,
            sku: row.sku,
            category: row.category,
            brandId,
            supplierId,
            cost: row.cost,
            price: row.retail,
            stock: row.stock,
            lowAt: 0,
            taxable: true,
            color: "#5433eb",
            active: true,
            tags: row.tags,
            poRef: "",
            expiry: row.expiry,
            expiryWarnMonths: null,
          });
          created++;
        } catch {
          skipped++;
        }
      }
      return { created, skipped };
    }),
});

export const brandsRouter = router({
  list: permProcedure("catalog", "view").query(() => catalog.listBrands()),
  create: permProcedure("catalog", "create")
    .input(z.object({ name: z.string().min(1), note: z.string().optional() }))
    .mutation(({ input }) => catalog.createBrand(input)),
  update: permProcedure("catalog", "edit")
    .input(z.object({ id: z.string(), patch: z.object({ name: z.string().optional(), note: z.string().optional(), active: z.boolean().optional() }) }))
    .mutation(({ input }) => catalog.updateBrand(input.id, input.patch)),
  delete: permProcedure("catalog", "delete").input(z.string()).mutation(({ input }) => catalog.deleteBrand(input)),
});

export const suppliersRouter = router({
  list: permProcedure("catalog", "view").query(() => catalog.listSuppliers()),
  create: permProcedure("catalog", "create")
    .input(
      z.object({
        name: z.string().min(1),
        contact: z.string().default(""),
        phone: z.string().default(""),
        email: z.string().default(""),
        note: z.string().default(""),
      })
    )
    .mutation(({ input }) => catalog.createSupplier(input)),
  update: permProcedure("catalog", "edit")
    .input(
      z.object({
        id: z.string(),
        patch: z.object({
          name: z.string().optional(),
          contact: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          note: z.string().optional(),
          active: z.boolean().optional(),
        }),
      })
    )
    .mutation(({ input }) => catalog.updateSupplier(input.id, input.patch)),
  delete: permProcedure("catalog", "delete").input(z.string()).mutation(({ input }) => catalog.deleteSupplier(input)),
});
