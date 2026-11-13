import { z } from "zod";
import type { BosPayment } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { detectSecrets, secretMessage } from "@/lib/evidence/secrets";
import { dateToISO, isoToDate, todayISO } from "@/lib/programme";
import { parseCedis } from "./money";

import { PAYMENTS, STOCK_PURCHASE } from "./constants";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Thrown inside a transaction to roll everything back; a plain `return fail(...)` would COMMIT the writes made so far. */
class Rollback extends Error {}
async function atomic<T extends { ok: boolean }>(run: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof Rollback) return fail(e.message);
    throw e;
  }
}

const text = (max: number) => z.string().trim().max(max).default("");
const money = z.string().transform((v, ctx) => {
  const p = parseCedis(v);
  if (p === null) ctx.addIssue({ code: "custom", message: "Enter an amount like 25 or 25.50" });
  return p ?? 0;
});
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").refine((v) => !Number.isNaN(Date.parse(v)), "Pick a valid date");
const id = z.string().min(1).max(64);
const optionalId = z.union([id, z.literal("")]).default("");

function noSecrets(...parts: string[]): string | null {
  const found = detectSecrets(parts.join("\n"));
  return found.length ? secretMessage(found) : null;
}
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form and try again.";

// ── Contacts (customers and suppliers share one shape) ──

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  phone: text(30),
  email: z.string().trim().max(160).default("").refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email"),
  location: text(120),
  notes: text(500),
});
export type ContactInput = z.input<typeof contactSchema>;
type Table = "customer" | "supplier";

const contactTable = (kind: Table) => (kind === "customer" ? db.bosCustomer : db.bosSupplier);

export async function saveContact(userId: string, kind: Table, recordId: string | null, input: ContactInput): Promise<Result> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const d = parsed.data;
  const secret = noSecrets(d.name, d.notes, d.location);
  if (secret) return fail(secret);
  const data = { name: d.name, phone: d.phone || null, email: d.email || null, location: d.location || null, notes: d.notes || null };
  const table = contactTable(kind) as typeof db.bosCustomer;
  if (recordId) {
    const { count } = await table.updateMany({ where: { id: recordId, userId }, data });
    return count ? { ok: true } : fail("Not found.");
  }
  await table.create({ data: { userId, ...data } });
  return { ok: true };
}

export async function deleteContact(userId: string, kind: Table, recordId: string): Promise<boolean> {
  const { count } = await (contactTable(kind) as typeof db.bosCustomer).deleteMany({ where: { id: recordId, userId } });
  return count > 0;
}

// ── Products and stock ──

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name").max(120),
  sku: text(40),
  unit: z.string().trim().max(20).default("pc").transform((v) => v || "pc"),
  cost: money,
  price: money,
  reorderLevel: z.coerce.number().int().min(0).max(100000).default(5),
  openingStock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  supplierId: optionalId,
});
export type ProductInput = z.input<typeof productSchema>;

async function ownedSupplier(userId: string, supplierId: string): Promise<string | null | "invalid"> {
  if (!supplierId) return null;
  const s = await db.bosSupplier.findFirst({ where: { id: supplierId, userId }, select: { id: true } });
  return s ? s.id : "invalid";
}

export async function saveProduct(userId: string, productId: string | null, input: ProductInput): Promise<Result> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const d = parsed.data;
  const secret = noSecrets(d.name, d.sku);
  if (secret) return fail(secret);
  const supplierId = await ownedSupplier(userId, d.supplierId);
  if (supplierId === "invalid") return fail("Pick one of your own suppliers.");
  if (d.sku && (await db.bosProduct.findFirst({ where: { userId, sku: d.sku, NOT: productId ? { id: productId } : undefined }, select: { id: true } }))) {
    return fail("Another product already uses that SKU.");
  }
  const data = { name: d.name, sku: d.sku || null, unit: d.unit, costPesewas: d.cost, pricePesewas: d.price, reorderLevel: d.reorderLevel, supplierId };
  if (productId) {
    const { count } = await db.bosProduct.updateMany({ where: { id: productId, userId }, data });
    return count ? { ok: true } : fail("Product not found.");
  }
  await db.bosProduct.create({
    data: {
      userId, ...data, stockQty: d.openingStock,
      movements: d.openingStock > 0 ? { create: { delta: d.openingStock, reason: "OPENING", supplierId } } : undefined,
    },
  });
  return { ok: true };
}

export async function deleteProduct(userId: string, productId: string): Promise<boolean> {
  const { count } = await db.bosProduct.deleteMany({ where: { id: productId, userId } });
  return count > 0;
}

export const restockSchema = z.object({
  qty: z.coerce.number().int().min(1, "Enter how many units arrived").max(1_000_000),
  unitCost: money,
  supplierId: optionalId,
  date: isoDate,
});
export type RestockInput = z.input<typeof restockSchema>;

/** Stock in from a supplier: raises stock, updates the unit cost, and records the purchase as a "Stock purchase" expense. */
export async function restock(userId: string, productId: string, input: RestockInput): Promise<Result> {
  const parsed = restockSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const d = parsed.data;
  const supplierId = await ownedSupplier(userId, d.supplierId);
  if (supplierId === "invalid") return fail("Pick one of your own suppliers.");
  const total = d.qty * d.unitCost;
  return db.$transaction(async (tx) => {
    const { count } = await tx.bosProduct.updateMany({
      where: { id: productId, userId },
      data: { stockQty: { increment: d.qty }, costPesewas: d.unitCost },
    });
    if (!count) return fail("Product not found.");
    await tx.bosStockMovement.create({ data: { productId, supplierId, delta: d.qty, reason: "RESTOCK" } });
    if (total > 0) {
      await tx.bosExpense.create({
        data: { userId, supplierId, category: STOCK_PURCHASE, description: `Restock x${d.qty}`, date: isoToDate(d.date), amountPesewas: total },
      });
    }
    return { ok: true } as const;
  });
}

/** Manual correction (damage, stock-take). Never takes stock below zero. */
export async function adjustStock(userId: string, productId: string, delta: number, note: string): Promise<Result> {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) return fail("Enter a whole number other than 0.");
  const clean = note.trim().slice(0, 200);
  const secret = noSecrets(clean);
  if (secret) return fail(secret);
  return db.$transaction(async (tx) => {
    const { count } = await tx.bosProduct.updateMany({
      where: { id: productId, userId, ...(delta < 0 ? { stockQty: { gte: -delta } } : {}) },
      data: { stockQty: { increment: delta } },
    });
    if (!count) return fail("Product not found, or not enough stock to remove that many.");
    await tx.bosStockMovement.create({ data: { productId, delta, reason: "ADJUSTMENT", note: clean || null } });
    return { ok: true } as const;
  });
}

// ── Sales ──

export const saleSchema = z.object({
  customerId: optionalId,
  date: isoDate,
  payment: z.enum(PAYMENTS),
  paid: z.string().default(""), // only used for CREDIT
  note: text(200),
  items: z.array(z.object({ productId: id, qty: z.coerce.number().int().min(1, "Quantity must be at least 1").max(100000) })).min(1, "Add at least one item").max(50),
});
export type SaleInput = z.input<typeof saleSchema>;

/** Records a sale atomically: checks stock, snapshots prices and costs, and takes stock out. Either everything happens or nothing does. */
export async function createSale(userId: string, input: SaleInput): Promise<Result<{ id: string }>> {
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const d = parsed.data;
  const secret = noSecrets(d.note);
  if (secret) return fail(secret);
  if (d.customerId && !(await db.bosCustomer.findFirst({ where: { id: d.customerId, userId }, select: { id: true } }))) return fail("Pick one of your own customers.");
  if (d.payment === "CREDIT" && !d.customerId) return fail("A sale on credit needs a customer, so you know who owes you.");

  // Merge repeated lines for the same product so the stock check is exact.
  const wanted = new Map<string, number>();
  for (const it of d.items) wanted.set(it.productId, (wanted.get(it.productId) ?? 0) + it.qty);

  return atomic(() => db.$transaction(async (tx) => {
    const products = await tx.bosProduct.findMany({ where: { userId, id: { in: [...wanted.keys()] } } });
    if (products.length !== wanted.size) throw new Rollback("One of the products was not found.");
    let total = 0;
    const lines = products.map((p) => {
      const qty = wanted.get(p.id)!;
      total += qty * p.pricePesewas;
      return { p, qty };
    });
    for (const { p, qty } of lines) {
      // Atomic guard: only decrements when enough stock remains, so two simultaneous sales cannot oversell.
      const { count } = await tx.bosProduct.updateMany({ where: { id: p.id, userId, stockQty: { gte: qty } }, data: { stockQty: { decrement: qty } } });
      if (!count) throw new Rollback(`Not enough stock for ${p.name} (${p.stockQty} left).`);
    }
    let paid = total;
    if (d.payment === "CREDIT") {
      const entered = d.paid.trim() === "" ? 0 : parseCedis(d.paid);
      if (entered === null) throw new Rollback("Enter the amount paid so far like 20 or 20.50, or leave it empty.");
      if (entered > total) throw new Rollback("The amount paid cannot be more than the sale total.");
      paid = entered;
    }
    const sale = await tx.bosSale.create({
      data: {
        userId, customerId: d.customerId || null, date: isoToDate(d.date), payment: d.payment as BosPayment, totalPesewas: total, paidPesewas: paid, note: d.note || null,
        items: { create: lines.map(({ p, qty }) => ({ productId: p.id, productName: p.name, qty, unitPricePesewas: p.pricePesewas, unitCostPesewas: p.costPesewas })) },
      },
    });
    await tx.bosStockMovement.createMany({ data: lines.map(({ p, qty }) => ({ productId: p.id, delta: -qty, reason: "SALE" as const, note: `Sale ${sale.id.slice(-6)}` })) });
    return { ok: true, id: sale.id } as const;
  }));
}

/** Collects money owed on a credit sale. Never more than what is still owed. */
export async function recordPayment(userId: string, saleId: string, amount: string): Promise<Result> {
  const pesewas = parseCedis(amount);
  if (pesewas === null || pesewas === 0) return fail("Enter an amount like 20 or 20.50.");
  return db.$transaction(async (tx) => {
    const sale = await tx.bosSale.findFirst({ where: { id: saleId, userId } });
    if (!sale) return fail("Sale not found.");
    if (pesewas > sale.totalPesewas - sale.paidPesewas) return fail("That is more than is still owed on this sale.");
    await tx.bosSale.update({ where: { id: saleId }, data: { paidPesewas: { increment: pesewas } } });
    return { ok: true } as const;
  });
}

/** Voids a sale: puts the stock back and removes the sale. */
export async function voidSale(userId: string, saleId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const sale = await tx.bosSale.findFirst({ where: { id: saleId, userId }, include: { items: true } });
    if (!sale) return false;
    for (const it of sale.items) {
      if (!it.productId) continue;
      const { count } = await tx.bosProduct.updateMany({ where: { id: it.productId, userId }, data: { stockQty: { increment: it.qty } } });
      if (count) await tx.bosStockMovement.create({ data: { productId: it.productId, delta: it.qty, reason: "ADJUSTMENT", note: `Void sale ${sale.id.slice(-6)}` } });
    }
    await tx.bosSale.delete({ where: { id: saleId } });
    return true;
  });
}

// ── Expenses ──

export const expenseSchema = z.object({
  category: z.string().trim().min(1, "Pick a category").max(60),
  description: text(200),
  date: isoDate,
  amount: money,
  payment: z.enum(["CASH", "MOMO", "BANK"]),
  supplierId: optionalId,
});
export type ExpenseInput = z.input<typeof expenseSchema>;

export async function saveExpense(userId: string, expenseId: string | null, input: ExpenseInput): Promise<Result> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const d = parsed.data;
  if (d.amount === 0) return fail("The amount must be more than zero.");
  const secret = noSecrets(d.description);
  if (secret) return fail(secret);
  const supplierId = await ownedSupplier(userId, d.supplierId);
  if (supplierId === "invalid") return fail("Pick one of your own suppliers.");
  const data = { category: d.category, description: d.description || null, date: isoToDate(d.date), amountPesewas: d.amount, payment: d.payment as BosPayment, supplierId };
  if (expenseId) {
    const { count } = await db.bosExpense.updateMany({ where: { id: expenseId, userId }, data });
    return count ? { ok: true } : fail("Expense not found.");
  }
  await db.bosExpense.create({ data: { userId, ...data } });
  return { ok: true };
}

export async function deleteExpense(userId: string, expenseId: string): Promise<boolean> {
  const { count } = await db.bosExpense.deleteMany({ where: { id: expenseId, userId } });
  return count > 0;
}

// ── Reads ──

export type ContactView = { id: string; name: string; phone: string; email: string; location: string; notes: string; count: number; amount: number };
export type ProductView = {
  id: string; name: string; sku: string; unit: string; cost: number; price: number; stock: number; reorderLevel: number; supplierId: string; supplierName: string; low: boolean;
};
export type SaleView = {
  id: string; date: string; customerName: string; payment: string; total: number; paid: number; note: string; items: { name: string; qty: number; unitPrice: number }[];
};
export type ExpenseView = { id: string; date: string; category: string; description: string; amount: number; payment: string; supplierId: string; supplierName: string };

export async function listCustomers(userId: string): Promise<ContactView[]> {
  const rows = await db.bosCustomer.findMany({ where: { userId }, orderBy: { name: "asc" }, include: { sales: { select: { totalPesewas: true, paidPesewas: true } } } });
  // amount = what the customer currently owes
  return rows.map((r) => ({
    id: r.id, name: r.name, phone: r.phone ?? "", email: r.email ?? "", location: r.location ?? "", notes: r.notes ?? "",
    count: r.sales.length, amount: r.sales.reduce((s, x) => s + (x.totalPesewas - x.paidPesewas), 0),
  }));
}

export async function listSuppliers(userId: string): Promise<ContactView[]> {
  const rows = await db.bosSupplier.findMany({ where: { userId }, orderBy: { name: "asc" }, include: { expenses: { select: { amountPesewas: true } } } });
  // amount = total spent with this supplier
  return rows.map((r) => ({
    id: r.id, name: r.name, phone: r.phone ?? "", email: r.email ?? "", location: r.location ?? "", notes: r.notes ?? "",
    count: r.expenses.length, amount: r.expenses.reduce((s, x) => s + x.amountPesewas, 0),
  }));
}

export async function listProducts(userId: string): Promise<ProductView[]> {
  const rows = await db.bosProduct.findMany({ where: { userId }, orderBy: { name: "asc" }, include: { supplier: { select: { name: true } } } });
  return rows.map((p) => ({
    id: p.id, name: p.name, sku: p.sku ?? "", unit: p.unit, cost: p.costPesewas, price: p.pricePesewas, stock: p.stockQty, reorderLevel: p.reorderLevel,
    supplierId: p.supplierId ?? "", supplierName: p.supplier?.name ?? "", low: p.stockQty <= p.reorderLevel,
  }));
}

export async function listSales(userId: string, limit = 100): Promise<SaleView[]> {
  const rows = await db.bosSale.findMany({ where: { userId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: limit, include: { customer: { select: { name: true } }, items: true } });
  return rows.map((s) => ({
    id: s.id, date: dateToISO(s.date), customerName: s.customer?.name ?? "Walk-in", payment: s.payment, total: s.totalPesewas, paid: s.paidPesewas, note: s.note ?? "",
    items: s.items.map((i) => ({ name: i.productName, qty: i.qty, unitPrice: i.unitPricePesewas })),
  }));
}

export async function listExpenses(userId: string, limit = 200): Promise<ExpenseView[]> {
  const rows = await db.bosExpense.findMany({ where: { userId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: limit, include: { supplier: { select: { name: true } } } });
  return rows.map((e) => ({
    id: e.id, date: dateToISO(e.date), category: e.category, description: e.description ?? "", amount: e.amountPesewas, payment: e.payment, supplierId: e.supplierId ?? "", supplierName: e.supplier?.name ?? "",
  }));
}

// ── Finance and analytics (all derived, nothing stored) ──

export type Overview = {
  revenue: number; cogs: number; grossProfit: number; operatingExpenses: number; netProfit: number;
  collected: number; receivables: number; cashOut: number; cashPosition: number; stockValue: number; saleCount: number;
  lowStock: { id: string; name: string; stock: number; reorderLevel: number }[];
  months: { key: string; label: string; revenue: number; expenses: number; profit: number }[];
  topProducts: { name: string; revenue: number; qty: number }[];
  topCustomers: { name: string; revenue: number }[];
  expenseByCategory: { category: string; amount: number }[];
  paymentMix: { payment: string; amount: number }[];
  debtors: { id: string; name: string; owed: number }[];
};

export function monthKeys(today: string, count: number): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const idx = y * 12 + (m - 1) - (count - 1 - i);
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
  });
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(2, 4)}`;

/**
 * Profit = sales revenue - cost of goods sold (snapshot cost at sale time) - operating expenses.
 * "Stock purchase" expenses are inventory buying, so they count towards cash out but not towards operating costs
 * (otherwise stock would be charged twice: once when bought and again when sold).
 */
export async function getOverview(userId: string, now: Date = new Date()): Promise<Overview> {
  const [sales, expenses, products] = await Promise.all([
    db.bosSale.findMany({ where: { userId }, include: { items: true, customer: { select: { id: true, name: true } } } }),
    db.bosExpense.findMany({ where: { userId } }),
    db.bosProduct.findMany({ where: { userId } }),
  ]);
  const keys = monthKeys(todayISO(now), 6);
  const monthly = new Map(keys.map((k) => [k, { revenue: 0, expenses: 0, cogs: 0 }]));

  let revenue = 0, cogs = 0, collected = 0;
  const byProduct = new Map<string, { revenue: number; qty: number }>();
  const byCustomer = new Map<string, number>();
  const mix = new Map<string, number>();
  const owed = new Map<string, { name: string; owed: number }>();
  for (const s of sales) {
    revenue += s.totalPesewas;
    collected += s.paidPesewas;
    const saleCogs = s.items.reduce((sum, i) => sum + i.qty * i.unitCostPesewas, 0);
    cogs += saleCogs;
    const m = monthly.get(dateToISO(s.date).slice(0, 7));
    if (m) { m.revenue += s.totalPesewas; m.cogs += saleCogs; }
    for (const i of s.items) {
      const cur = byProduct.get(i.productName) ?? { revenue: 0, qty: 0 };
      byProduct.set(i.productName, { revenue: cur.revenue + i.qty * i.unitPricePesewas, qty: cur.qty + i.qty });
    }
    if (s.customer) {
      byCustomer.set(s.customer.name, (byCustomer.get(s.customer.name) ?? 0) + s.totalPesewas);
      const left = s.totalPesewas - s.paidPesewas;
      if (left > 0) owed.set(s.customer.id, { name: s.customer.name, owed: (owed.get(s.customer.id)?.owed ?? 0) + left });
    }
    mix.set(s.payment, (mix.get(s.payment) ?? 0) + s.paidPesewas);
  }

  let operating = 0, cashOut = 0;
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    cashOut += e.amountPesewas;
    const isStock = e.category === STOCK_PURCHASE;
    if (!isStock) {
      operating += e.amountPesewas;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountPesewas);
    }
    const m = monthly.get(dateToISO(e.date).slice(0, 7));
    if (m && !isStock) m.expenses += e.amountPesewas;
  }

  const top = <T,>(entries: [string, T][], score: (v: T) => number) => entries.sort((a, b) => score(b[1]) - score(a[1])).slice(0, 5);
  return {
    revenue, cogs, grossProfit: revenue - cogs, operatingExpenses: operating, netProfit: revenue - cogs - operating,
    collected, receivables: revenue - collected, cashOut, cashPosition: collected - cashOut,
    stockValue: products.reduce((s, p) => s + p.stockQty * p.costPesewas, 0), saleCount: sales.length,
    lowStock: products.filter((p) => p.stockQty <= p.reorderLevel).sort((a, b) => a.stockQty - b.stockQty).slice(0, 8).map((p) => ({ id: p.id, name: p.name, stock: p.stockQty, reorderLevel: p.reorderLevel })),
    months: keys.map((k) => { const m = monthly.get(k)!; return { key: k, label: monthLabel(k), revenue: m.revenue, expenses: m.expenses, profit: m.revenue - m.cogs - m.expenses }; }),
    topProducts: top([...byProduct.entries()], (v) => v.revenue).map(([name, v]) => ({ name, ...v })),
    topCustomers: top([...byCustomer.entries()], (v) => v).map(([name, revenue]) => ({ name, revenue })),
    expenseByCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    paymentMix: [...mix.entries()].map(([payment, amount]) => ({ payment, amount })).filter((x) => x.amount > 0),
    debtors: [...owed.entries()].map(([cid, v]) => ({ id: cid, ...v })).sort((a, b) => b.owed - a.owed).slice(0, 8),
  };
}
