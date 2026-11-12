"use client";

import { useState } from "react";
import { Banknote, Plus, Receipt, Trash2, X } from "lucide-react";
import { createSaleAction, recordPaymentAction, voidSaleAction } from "@/app/(app)/actions";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtGhs } from "@/lib/businessos/money";
import type { ProductView, SaleView } from "@/lib/businessos/service";
import { FormError, NONE, PAY_LABEL, Tile, fmtDay, useSubmit } from "./bos-ui";

type Customer = { id: string; name: string };
type Line = { productId: string; qty: string };

function SaleForm({ products, customers, today, onDone }: { products: ProductView[]; customers: Customer[]; today: string; onDone: () => void }) {
  const { pending, error, setError, submit } = useSubmit();
  const [lines, setLines] = useState<Line[]>([{ productId: "", qty: "1" }]);
  const [customer, setCustomer] = useState(NONE);
  const [payment, setPayment] = useState("CASH");
  const priced = lines.map((l) => ({ l, p: products.find((x) => x.id === l.productId), qty: Number.parseInt(l.qty, 10) || 0 }));
  const total = priced.reduce((s, x) => s + (x.p ? x.p.price * x.qty : 0), 0);
  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <form
      action={(fd) => {
        const items = lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, qty: Number.parseInt(l.qty, 10) || 0 }));
        if (!items.length) return setError("Add at least one item.");
        submit(
          () => createSaleAction({ customerId: customer === NONE ? "" : customer, date: String(fd.get("date") ?? ""), payment: payment as "CASH", paid: String(fd.get("paid") ?? ""), note: String(fd.get("note") ?? ""), items }),
          { success: "Sale recorded", onDone },
        );
      }}
      className="space-y-4"
    >
      <FormError message={error} />
      <div className="space-y-2">
        <p className="mono-label">Items</p>
        {priced.map(({ l, p, qty }, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select value={l.productId} onValueChange={(v) => update(i, { productId: v })}>
                <SelectTrigger aria-label={`Product ${i + 1}`}><SelectValue placeholder="Pick a product" /></SelectTrigger>
                <SelectContent>
                  {products.map((x) => <SelectItem key={x.id} value={x.id} disabled={x.stock === 0}>{x.name} · {fmtGhs(x.price)} · {x.stock} left</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input aria-label={`Quantity ${i + 1}`} className="w-20" type="number" min={1} value={l.qty} onChange={(e) => update(i, { qty: e.target.value })} />
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{p ? fmtGhs(p.price * qty) : "—"}</span>
            {lines.length > 1 ? (
              <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
            ) : <span className="w-[26px]" />}
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { productId: "", qty: "1" }])}><Plus className="h-3.5 w-3.5" /> Add item</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Customer">
          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Walk-in</SelectItem>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Paid by">
          <Select value={payment} onValueChange={setPayment}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PAY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date"><Input name="date" type="date" defaultValue={today} required /></FormField>
        {payment === "CREDIT" ? <FormField label="Paid so far (GH₵)"><Input name="paid" inputMode="decimal" placeholder="0.00" /></FormField> : <div />}
      </div>
      {payment === "CREDIT" && customer === NONE ? <p className="text-xs text-destructive">A sale on credit needs a customer.</p> : null}
      <FormField label="Note"><Input name="note" maxLength={200} /></FormField>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="mono-label">Total</span>
        <span className="font-display text-xl tabular-nums text-foreground">{fmtGhs(total)}</span>
      </div>
      <Button type="submit" disabled={pending || total === 0} className="w-full">{pending ? "Saving…" : "Record sale"}</Button>
    </form>
  );
}

function PaymentForm({ sale, onDone }: { sale: SaleView; onDone: () => void }) {
  const { pending, error, submit } = useSubmit();
  return (
    <form action={(fd) => submit(() => recordPaymentAction(sale.id, String(fd.get("amount") ?? "")), { success: "Payment recorded", onDone })} className="space-y-4">
      <FormError message={error} />
      <p className="text-xs text-muted-foreground">{sale.customerName} still owes {fmtGhs(sale.total - sale.paid)} on this sale.</p>
      <FormField label="Amount received (GH₵)"><Input name="amount" inputMode="decimal" required autoFocus defaultValue={((sale.total - sale.paid) / 100).toFixed(2)} /></FormField>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Record payment"}</Button>
    </form>
  );
}

export function SalesView({ sales, products, customers, today }: { sales: SaleView[]; products: ProductView[]; customers: Customer[]; today: string }) {
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<SaleView | null>(null);
  const { pending, submit } = useSubmit();
  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const owed = sales.reduce((s, x) => s + (x.total - x.paid), 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="BusinessOS Ghana" title="Sales" description="Every sale takes stock out and counts towards your revenue and profit.">
        <Button onClick={() => setCreating(true)} disabled={products.length === 0}><Plus className="h-4 w-4" /> New sale</Button>
      </PageHeader>

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Sales" value={sales.length} />
        <Tile label="Revenue" value={fmtGhs(revenue)} />
        <Tile label="Still owed" value={fmtGhs(owed)} tone={owed > 0 ? "bad" : undefined} />
      </div>

      {sales.length === 0 ? (
        <EmptyState icon={Receipt} title="No sales yet" hint={products.length === 0 ? "Add a product in Inventory first, then record your first sale." : "Record your first sale."} />
      ) : (
        <div className="space-y-3">
          {sales.map((s) => {
            const left = s.total - s.paid;
            return (
              <article key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{s.customerName} <span className="text-muted-foreground">· {fmtDay(s.date)}</span></p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{s.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}</p>
                    {s.note ? <p className="mt-1 text-[11px] text-muted-foreground">{s.note}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg tabular-nums text-foreground">{fmtGhs(s.total)}</p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{PAY_LABEL[s.payment]}</p>
                    {left > 0 ? <p className="mt-1 text-[11px] text-destructive">{fmtGhs(left)} owed</p> : null}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  {left > 0 ? <Button variant="outline" size="sm" onClick={() => setPaying(s)}><Banknote className="h-3.5 w-3.5" /> Record payment</Button> : null}
                  <button
                    type="button" aria-label={`Void sale to ${s.customerName} on ${fmtDay(s.date)}`} disabled={pending}
                    onClick={() => { if (window.confirm("Void this sale? The stock is put back and the sale is removed.")) submit(() => voidSaleAction(s.id), { success: "Sale voided" }); }}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                  ><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={creating} onOpenChange={setCreating} title="New sale" description="Pick what was sold. Prices come from your inventory.">
        {creating ? <SaleForm products={products} customers={customers} today={today} onDone={() => setCreating(false)} /> : null}
      </Modal>
      <Modal open={paying !== null} onOpenChange={(o) => { if (!o) setPaying(null); }} title="Record payment">
        {paying ? <PaymentForm sale={paying} onDone={() => setPaying(null)} /> : null}
      </Modal>
    </div>
  );
}
