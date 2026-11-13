import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  adjustStock, createSale, deleteProduct, getOverview, listCustomers, listProducts, listSales, listSuppliers, monthKeys, recordPayment, restock,
  saveContact, saveExpense, saveProduct, voidSale,
} from "@/lib/businessos/service";
import { fmtGhs, parseCedis } from "@/lib/businessos/money";

let a = "";
let b = "";
const email = (n: string) => `bos-test-${n}@example.test`;
const TODAY = "2026-11-20";

async function product(userId: string, name: string, cost: string, price: string, stock = 10, extra: object = {}) {
  const r = await saveProduct(userId, null, { name, cost, price, openingStock: stock, ...extra });
  if (!r.ok) throw new Error(r.error);
  return (await listProducts(userId)).find((p) => p.name === name)!;
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "bos-test" } } });
  a = (await db.user.create({ data: { email: email("a"), passwordHash: "x" } })).id;
  b = (await db.user.create({ data: { email: email("b"), passwordHash: "x" } })).id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "bos-test" } } });
  await db.$disconnect();
});

describe("money", () => {
  it("parses cedis exactly and rejects anything ambiguous", () => {
    expect(parseCedis("12")).toBe(1200);
    expect(parseCedis("12.5")).toBe(1250);
    expect(parseCedis("1,200.05")).toBe(120005);
    expect(parseCedis("GH₵ 3.20")).toBe(320);
    expect(parseCedis("0.07")).toBe(7);
    for (const bad of ["", "-5", "1.234", "abc", "1e3", "12.", ".5", "999999999999"]) expect(parseCedis(bad), bad).toBeNull();
  });
  it("formats pesewas without rounding drift", () => {
    expect(fmtGhs(0)).toBe("GH₵0.00");
    expect(fmtGhs(1250)).toBe("GH₵12.50");
    expect(fmtGhs(-5)).toBe("-GH₵0.05");
    expect(fmtGhs(123456789)).toBe("GH₵1,234,567.89");
  });
});

describe("contacts, products and ownership", () => {
  it("keeps every record private to its owner", async () => {
    expect(await saveContact(a, "customer", null, { name: "Ama Mensah", phone: "0240000000", email: "ama@example.com" })).toEqual({ ok: true });
    expect(await saveContact(a, "customer", null, { name: "x", email: "not-an-email" })).toMatchObject({ ok: false });
    expect(await saveContact(a, "customer", null, { name: "  " })).toMatchObject({ ok: false });
    const [ama] = await listCustomers(a);
    expect(await listCustomers(b)).toHaveLength(0);
    expect(await saveContact(b, "customer", ama.id, { name: "Hijack" })).toMatchObject({ ok: false });

    const p = await product(a, "Shea butter", "10", "18.50", 20);
    expect(p).toMatchObject({ cost: 1000, price: 1850, stock: 20 });
    expect(await saveProduct(b, p.id, { name: "Hijack", cost: "1", price: "2" })).toMatchObject({ ok: false });
    expect(await deleteProduct(b, p.id)).toBe(false);
    expect((await saveProduct(a, null, { name: "Dup", sku: "S1", cost: "1", price: "2" })).ok).toBe(true);
    expect(await saveProduct(a, null, { name: "Dup2", sku: "S1", cost: "1", price: "2" })).toMatchObject({ ok: false, error: expect.stringMatching(/SKU/) });
    expect(await saveProduct(a, null, { name: "Bad", cost: "abc", price: "2" })).toMatchObject({ ok: false });
    const sup = await saveContact(a, "supplier", null, { name: "Tamale Traders" });
    expect(sup.ok).toBe(true);
    const [supplier] = await listSuppliers(a);
    expect(await saveProduct(b, null, { name: "Cross", cost: "1", price: "2", supplierId: supplier.id })).toMatchObject({ ok: false, error: expect.stringMatching(/own suppliers/) });
    expect(await saveContact(a, "supplier", null, { name: "Leaky", notes: "password = hunter2hunter2" })).toMatchObject({ ok: false });
  });
});

describe("sales", () => {
  it("takes stock out, snapshots price and cost, and never oversells", async () => {
    const p = await product(a, "Kente cloth", "40", "75", 3);
    const sale = await createSale(a, { date: TODAY, payment: "CASH", items: [{ productId: p.id, qty: 2 }] });
    expect(sale.ok).toBe(true);
    expect((await listProducts(a)).find((x) => x.id === p.id)!.stock).toBe(1);

    // Too many: nothing changes (all or nothing).
    const q = await product(a, "Beads", "2", "5", 50);
    expect(await createSale(a, { date: TODAY, payment: "CASH", items: [{ productId: q.id, qty: 10 }, { productId: p.id, qty: 2 }] })).toMatchObject({ ok: false, error: expect.stringMatching(/Not enough stock for Kente cloth/) });
    expect((await listProducts(a)).find((x) => x.id === q.id)!.stock).toBe(50);

    // Repeated lines for the same product are summed before the stock check.
    expect(await createSale(a, { date: TODAY, payment: "CASH", items: [{ productId: p.id, qty: 1 }, { productId: p.id, qty: 1 }] })).toMatchObject({ ok: false });

    // Changing the price later does not rewrite history.
    await saveProduct(a, p.id, { name: "Kente cloth", cost: "99", price: "200" });
    const history = (await listSales(a)).find((s) => s.id === (sale as { id: string }).id)!;
    expect(history).toMatchObject({ total: 15000, paid: 15000, customerName: "Walk-in" });
    expect(history.items[0]).toMatchObject({ qty: 2, unitPrice: 7500 });
  });

  it("cannot sell another user's product or to another user's customer", async () => {
    const mine = await product(a, "Soap", "3", "6", 10);
    const theirs = await product(b, "Their soap", "3", "6", 10);
    expect(await createSale(a, { date: TODAY, payment: "CASH", items: [{ productId: theirs.id, qty: 1 }] })).toMatchObject({ ok: false });
    await saveContact(b, "customer", null, { name: "B customer" });
    const [bc] = await listCustomers(b);
    expect(await createSale(a, { date: TODAY, payment: "CASH", customerId: bc.id, items: [{ productId: mine.id, qty: 1 }] })).toMatchObject({ ok: false, error: expect.stringMatching(/own customers/) });
    expect((await listProducts(b))[0].stock).toBe(10);
  });

  it("handles credit sales, part-payments and voids", async () => {
    await saveContact(a, "customer", null, { name: "Kofi Debtor" });
    const kofi = (await listCustomers(a)).find((c) => c.name === "Kofi Debtor")!;
    const p = await product(a, "Rice bag", "100", "130", 5);
    expect(await createSale(a, { date: TODAY, payment: "CREDIT", items: [{ productId: p.id, qty: 1 }] })).toMatchObject({ ok: false, error: expect.stringMatching(/needs a customer/) });
    expect(await createSale(a, { date: TODAY, payment: "CREDIT", customerId: kofi.id, paid: "500", items: [{ productId: p.id, qty: 1 }] })).toMatchObject({ ok: false, error: expect.stringMatching(/more than the sale total/) });

    const sale = await createSale(a, { date: TODAY, payment: "CREDIT", customerId: kofi.id, paid: "30", items: [{ productId: p.id, qty: 2 }] });
    if (!sale.ok) throw new Error(sale.error);
    expect((await listCustomers(a)).find((c) => c.id === kofi.id)!.amount).toBe(26000 - 3000);

    expect(await recordPayment(a, sale.id, "500")).toMatchObject({ ok: false });
    expect(await recordPayment(b, sale.id, "10")).toMatchObject({ ok: false, error: "Sale not found." });
    expect(await recordPayment(a, sale.id, "0")).toMatchObject({ ok: false });
    expect(await recordPayment(a, sale.id, "100")).toEqual({ ok: true });
    expect((await listCustomers(a)).find((c) => c.id === kofi.id)!.amount).toBe(13000);

    expect(await voidSale(b, sale.id)).toBe(false);
    expect(await voidSale(a, sale.id)).toBe(true);
    expect((await listProducts(a)).find((x) => x.id === p.id)!.stock).toBe(5); // stock restored
    expect((await listCustomers(a)).find((c) => c.id === kofi.id)!.amount).toBe(0);
  });
});

describe("atomicity", () => {
  it("rolls back every stock change when any line (or the payment) fails, whatever the line order", async () => {
    const plenty = await product(a, "Plenty", "1", "2", 100);
    const scarce = await product(a, "Scarce", "1", "2", 1);
    for (const items of [
      [{ productId: plenty.id, qty: 5 }, { productId: scarce.id, qty: 2 }],
      [{ productId: scarce.id, qty: 2 }, { productId: plenty.id, qty: 5 }],
    ]) {
      expect(await createSale(a, { date: TODAY, payment: "CASH", items })).toMatchObject({ ok: false });
    }
    await saveContact(a, "customer", null, { name: "Atomic Buyer" });
    const buyer = (await listCustomers(a)).find((c) => c.name === "Atomic Buyer")!;
    expect(await createSale(a, { date: TODAY, payment: "CREDIT", customerId: buyer.id, paid: "9999", items: [{ productId: plenty.id, qty: 5 }] })).toMatchObject({ ok: false });
    const now = await listProducts(a);
    expect(now.find((p) => p.id === plenty.id)!.stock).toBe(100);
    expect(now.find((p) => p.id === scarce.id)!.stock).toBe(1);
    expect(await db.bosStockMovement.count({ where: { productId: plenty.id, reason: "SALE" } })).toBe(0);
  });
});

describe("stock", () => {
  it("restocks from a supplier, records the purchase, and guards adjustments", async () => {
    await saveContact(a, "supplier", null, { name: "Accra Wholesale" });
    const supplier = (await listSuppliers(a)).find((s) => s.name === "Accra Wholesale")!;
    const p = await product(a, "Flour", "20", "30", 2);
    expect(await restock(a, p.id, { qty: 10, unitCost: "22", supplierId: supplier.id, date: TODAY })).toEqual({ ok: true });
    const after = (await listProducts(a)).find((x) => x.id === p.id)!;
    expect(after).toMatchObject({ stock: 12, cost: 2200 });
    expect((await listSuppliers(a)).find((s) => s.id === supplier.id)!.amount).toBe(22000);
    expect(await restock(b, p.id, { qty: 1, unitCost: "1", date: TODAY })).toMatchObject({ ok: false });

    expect(await adjustStock(a, p.id, -13, "")).toMatchObject({ ok: false }); // would go below zero
    expect(await adjustStock(a, p.id, -2, "damaged")).toEqual({ ok: true });
    expect(await adjustStock(a, p.id, 0, "")).toMatchObject({ ok: false });
    expect(await adjustStock(b, p.id, 1, "")).toMatchObject({ ok: false });
    expect((await listProducts(a)).find((x) => x.id === p.id)!.stock).toBe(10);
  });
});

describe("finance overview", () => {
  it("derives profit, cash and receivables correctly and never mixes users", async () => {
    const f = (await db.user.create({ data: { email: email("fin"), passwordHash: "x" } })).id;
    await saveContact(f, "customer", null, { name: "Yaa" });
    const yaa = (await listCustomers(f))[0];
    const p = await product(f, "Widget", "10", "25", 10);

    // Sale 1: 4 x 25 = 100.00 cash, cost 40.00.  Sale 2: 2 x 25 = 50.00 on credit, 20.00 paid, cost 20.00.
    await createSale(f, { date: TODAY, payment: "CASH", items: [{ productId: p.id, qty: 4 }] });
    await createSale(f, { date: TODAY, payment: "CREDIT", customerId: yaa.id, paid: "20", items: [{ productId: p.id, qty: 2 }] });
    await restock(f, p.id, { qty: 5, unitCost: "10", date: TODAY }); // 50.00 stock purchase
    await saveExpense(f, null, { category: "Rent", date: TODAY, amount: "15", payment: "CASH" });
    expect(await saveExpense(f, null, { category: "Rent", date: TODAY, amount: "0", payment: "CASH" })).toMatchObject({ ok: false });
    expect(await saveExpense(f, null, { category: "Rent", date: "nope", amount: "5", payment: "CASH" })).toMatchObject({ ok: false });

    const o = await getOverview(f, new Date("2026-11-20T12:00:00Z"));
    expect(o).toMatchObject({
      revenue: 15000, cogs: 6000, grossProfit: 9000, operatingExpenses: 1500, netProfit: 7500,
      collected: 12000, receivables: 3000, cashOut: 6500, cashPosition: 5500, saleCount: 2,
    });
    expect(o.stockValue).toBe((10 - 6 + 5) * 1000); // 9 units at the latest cost
    expect(o.debtors).toEqual([expect.objectContaining({ name: "Yaa", owed: 3000 })]);
    expect(o.topProducts[0]).toMatchObject({ name: "Widget", revenue: 15000, qty: 6 });
    expect(o.months.at(-1)).toMatchObject({ key: "2026-11", revenue: 15000, expenses: 1500, profit: 7500 });
    expect(o.expenseByCategory).toEqual([{ category: "Rent", amount: 1500 }]); // stock purchase is not an operating cost

    const other = await getOverview(b, new Date("2026-11-20T12:00:00Z"));
    expect(other.revenue).not.toBe(15000);
    const empty = await getOverview(a, new Date("2026-11-20T12:00:00Z"));
    expect(empty.months).toHaveLength(6);
  });

  it("builds contiguous month keys across a year boundary", () => {
    expect(monthKeys("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});
