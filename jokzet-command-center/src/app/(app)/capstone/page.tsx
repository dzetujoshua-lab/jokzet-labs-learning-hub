import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { BarList, MonthlyChart } from "@/components/businessos/overview-charts";
import { Tile } from "@/components/businessos/bos-ui";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/dal";
import { fmtGhs } from "@/lib/businessos/money";
import { getOverview } from "@/lib/businessos/service";
import { ensureLearnerSetup } from "@/lib/missions/service";

export const metadata: Metadata = { title: "BusinessOS Ghana" };

export default async function CapstoneOverviewPage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  const o = await getOverview(user.id);
  const empty = o.saleCount === 0 && o.cashOut === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Capstone"
        title="BusinessOS Ghana"
        description="A small business you run end to end: stock, sales, customers, suppliers, expenses and the profit they add up to. Amounts are in Ghana cedis (GH₵)."
      >
        <Link href="/portfolio" className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-primary">
          Capstone stages →
        </Link>
      </PageHeader>

      {empty ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-secondary text-muted-foreground">
            <Briefcase className="h-4 w-4" strokeWidth={1.7} />
          </span>
          <p className="mt-4 font-display text-sm font-medium text-foreground">Start by stocking the shop</p>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Add your <Link className="text-primary" href="/capstone/suppliers">suppliers</Link> and{" "}
            <Link className="text-primary" href="/capstone/inventory">products</Link>, then record a{" "}
            <Link className="text-primary" href="/capstone/sales">sale</Link>. The figures below fill in on their own.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Revenue" value={fmtGhs(o.revenue)} />
        <Tile label="Gross profit" value={fmtGhs(o.grossProfit)} />
        <Tile label="Net profit" value={fmtGhs(o.netProfit)} tone={o.netProfit < 0 ? "bad" : o.netProfit > 0 ? "good" : undefined} />
        <Tile label="Cash position" value={fmtGhs(o.cashPosition)} tone={o.cashPosition < 0 ? "bad" : undefined} />
        <Tile label="Owed to you" value={fmtGhs(o.receivables)} tone={o.receivables > 0 ? "bad" : undefined} />
        <Tile label="Running costs" value={fmtGhs(o.operatingExpenses)} />
        <Tile label="Stock value" value={fmtGhs(o.stockValue)} />
        <Tile label="Sales made" value={o.saleCount} />
      </div>

      <section className="panel p-5">
        <p className="mono-label">Revenue, costs and profit · last 6 months</p>
        <div className="mt-4">
          <MonthlyChart months={o.months} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <p className="mono-label">Best-selling products</p>
          <div className="mt-4">
            {o.topProducts.length ? (
              <BarList label="Revenue by product" rows={o.topProducts.map((p) => ({ name: p.name, value: p.revenue }))} />
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No sales yet.</p>
            )}
          </div>
        </section>
        <section className="panel p-5">
          <p className="mono-label">Where the running costs go</p>
          <div className="mt-4">
            {o.expenseByCategory.length ? (
              <BarList label="Running costs by category" rows={o.expenseByCategory.map((c) => ({ name: c.category, value: c.amount }))} />
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No running costs yet.</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-5">
          <p className="mono-label">Low stock</p>
          {o.lowStock.length ? (
            <ul className="mt-3 divide-y divide-border text-[13px]">
              {o.lowStock.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 py-2">
                  <span className="truncate text-foreground">{p.name}</span>
                  <span className="tabular-nums text-destructive">{p.stock} left</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Nothing is running low.</p>
          )}
        </section>
        <section className="panel p-5">
          <p className="mono-label">Who owes you</p>
          {o.debtors.length ? (
            <ul className="mt-3 divide-y divide-border text-[13px]">
              {o.debtors.map((d) => (
                <li key={d.id} className="flex justify-between gap-3 py-2">
                  <span className="truncate text-foreground">{d.name}</span>
                  <span className="tabular-nums text-destructive">{fmtGhs(d.owed)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No unpaid credit sales.</p>
          )}
        </section>
        <section className="panel p-5">
          <p className="mono-label">Best customers</p>
          {o.topCustomers.length ? (
            <ul className="mt-3 divide-y divide-border text-[13px]">
              {o.topCustomers.map((c) => (
                <li key={c.name} className="flex justify-between gap-3 py-2">
                  <span className="truncate text-foreground">{c.name}</span>
                  <span className="tabular-nums">{fmtGhs(c.revenue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Sales to named customers show here.</p>
          )}
        </section>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Net profit = sales − cost of the goods sold − running costs. Buying stock is not a running cost (it becomes a cost when the stock is sold), but it does reduce your cash position.
      </p>
    </div>
  );
}
