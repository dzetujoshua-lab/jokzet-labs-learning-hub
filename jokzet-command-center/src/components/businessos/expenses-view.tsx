"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { deleteExpenseAction, saveExpenseAction } from "@/app/(app)/actions";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtGhs, toCedisInput } from "@/lib/businessos/money";
import { EXPENSE_CATEGORIES, STOCK_PURCHASE } from "@/lib/businessos/constants";
import type { ExpenseView } from "@/lib/businessos/service";
import { FormError, NONE, PAY_LABEL, Tile, fmtDay, useSubmit } from "./bos-ui";

type Supplier = { id: string; name: string };

function ExpenseForm({ expense, suppliers, today, onDone }: { expense: ExpenseView | null; suppliers: Supplier[]; today: string; onDone: () => void }) {
  const { pending, error, submit } = useSubmit();
  const [category, setCategory] = useState(expense?.category ?? "Rent");
  const [payment, setPayment] = useState(expense?.payment ?? "CASH");
  const [supplier, setSupplier] = useState(expense?.supplierId || NONE);
  const categories = [...new Set<string>([...EXPENSE_CATEGORIES, ...(expense ? [expense.category] : [])])];
  return (
    <form
      action={(fd) =>
        submit(
          () => saveExpenseAction(expense?.id ?? null, {
            category, description: String(fd.get("description") ?? ""), date: String(fd.get("date") ?? ""), amount: String(fd.get("amount") ?? ""),
            payment: payment as "CASH", supplierId: supplier === NONE ? "" : supplier,
          }),
          { success: expense ? "Expense saved" : "Expense added", onDone },
        )
      }
      className="space-y-4"
    >
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Category">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Amount (GH₵)"><Input name="amount" inputMode="decimal" required autoFocus defaultValue={expense ? toCedisInput(expense.amount) : ""} placeholder="150.00" /></FormField>
      </div>
      <FormField label="What was it for"><Input name="description" maxLength={200} defaultValue={expense?.description} placeholder="Shop rent for November" /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date"><Input name="date" type="date" defaultValue={expense?.date ?? today} required /></FormField>
        <FormField label="Paid by">
          <Select value={payment} onValueChange={setPayment}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["CASH", "MOMO", "BANK"].map((k) => <SelectItem key={k} value={k}>{PAY_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Supplier (optional)">
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FormField>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : expense ? "Save changes" : "Add expense"}</Button>
    </form>
  );
}

export function ExpensesView({ expenses, suppliers, today }: { expenses: ExpenseView[]; suppliers: Supplier[]; today: string }) {
  const [editing, setEditing] = useState<ExpenseView | "new" | null>(null);
  const { pending, submit } = useSubmit();
  const operating = expenses.filter((e) => e.category !== STOCK_PURCHASE).reduce((s, e) => s + e.amount, 0);
  const stock = expenses.filter((e) => e.category === STOCK_PURCHASE).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="BusinessOS Ghana" title="Expenses" description="What it costs to run the business. Stock you buy is added automatically when you restock.">
        <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New expense</Button>
      </PageHeader>

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Running costs" value={fmtGhs(operating)} />
        <Tile label="Stock purchases" value={fmtGhs(stock)} />
        <Tile label="Total spent" value={fmtGhs(operating + stock)} />
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={Wallet} title="No expenses yet" hint="Record rent, transport, airtime and anything else the business pays for." />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-normal">Date</th>
                <th scope="col" className="px-3 py-3 font-normal">Category</th>
                <th scope="col" className="px-3 py-3 font-normal">Details</th>
                <th scope="col" className="px-3 py-3 text-right font-normal">Amount</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3 text-muted-foreground">{fmtDay(e.date)}</td>
                  <td className="px-3 py-3 text-foreground">{e.category}</td>
                  <td className="px-3 py-3 text-muted-foreground">{[e.description, e.supplierName].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtGhs(e.amount)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" aria-label={`Edit ${e.category} expense`} onClick={() => setEditing(e)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button
                        type="button" aria-label={`Delete ${e.category} expense`} disabled={pending}
                        onClick={() => { if (window.confirm("Delete this expense?")) submit(() => deleteExpenseAction(e.id), { success: "Expense deleted" }); }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                      ><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }} title={editing === "new" || editing === null ? "New expense" : "Edit expense"}>
        {editing !== null ? <ExpenseForm expense={editing === "new" ? null : editing} suppliers={suppliers} today={today} onDone={() => setEditing(null)} /> : null}
      </Modal>
    </div>
  );
}
