"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { deleteContactAction, saveContactAction } from "@/app/(app)/actions";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ContactView } from "@/lib/businessos/service";
import { fmtGhs } from "@/lib/businessos/money";
import { FormError, useSubmit } from "./bos-ui";

type Kind = "customer" | "supplier";

function ContactForm({ kind, record, onDone }: { kind: Kind; record: ContactView | null; onDone: () => void }) {
  const { pending, error, submit } = useSubmit();
  const [name, setName] = useState(record?.name ?? "");
  return (
    <form
      action={(fd) =>
        submit(
          () => saveContactAction(kind, record?.id ?? null, {
            name, phone: String(fd.get("phone") ?? ""), email: String(fd.get("email") ?? ""), location: String(fd.get("location") ?? ""), notes: String(fd.get("notes") ?? ""),
          }),
          { success: record ? "Saved" : `${kind === "customer" ? "Customer" : "Supplier"} added`, onDone },
        )
      }
      className="space-y-4"
    >
      <FormError message={error} />
      <FormField label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Phone"><Input name="phone" type="tel" defaultValue={record?.phone} maxLength={30} placeholder="024 000 0000" /></FormField>
        <FormField label="Email"><Input name="email" type="email" defaultValue={record?.email} maxLength={160} /></FormField>
      </div>
      <FormField label="Location"><Input name="location" defaultValue={record?.location} maxLength={120} placeholder="Kumasi" /></FormField>
      <FormField label="Notes"><Textarea name="notes" rows={3} defaultValue={record?.notes} maxLength={500} /></FormField>
      <Button type="submit" disabled={pending || !name.trim()} className="w-full">{pending ? "Saving…" : record ? "Save changes" : "Add"}</Button>
    </form>
  );
}

export function ContactsView({ kind, rows }: { kind: Kind; rows: ContactView[] }) {
  const [editing, setEditing] = useState<ContactView | "new" | null>(null);
  const { pending, submit } = useSubmit();
  const isCustomer = kind === "customer";
  const noun = isCustomer ? "customer" : "supplier";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="BusinessOS Ghana" title={isCustomer ? "Customers" : "Suppliers"} description={isCustomer ? "Who you sell to, and who still owes you." : "Who you buy stock from, and what you have spent with them."}>
        <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New {noun}</Button>
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title={`No ${noun}s yet`} hint={isCustomer ? "Add the people you sell to. Credit sales need a customer." : "Add the people you buy stock from."} />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-normal">Name</th>
                <th scope="col" className="px-3 py-3 font-normal">Contact</th>
                <th scope="col" className="px-3 py-3 text-right font-normal">{isCustomer ? "Sales" : "Purchases"}</th>
                <th scope="col" className="px-3 py-3 text-right font-normal">{isCustomer ? "Owes you" : "Spent"}</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="px-5 py-3 font-normal text-foreground">
                    {r.name}
                    {r.location ? <span className="block text-[11px] text-muted-foreground">{r.location}</span> : null}
                  </th>
                  <td className="px-3 py-3 text-muted-foreground">{[r.phone, r.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.count}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${isCustomer && r.amount > 0 ? "text-destructive" : ""}`}>{fmtGhs(r.amount)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button
                        type="button" aria-label={`Delete ${r.name}`} disabled={pending}
                        onClick={() => { if (window.confirm(`Delete ${r.name}? Past sales and expenses stay, without this name.`)) submit(() => deleteContactAction(kind, r.id), { success: "Deleted" }); }}
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

      <Modal open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }} title={editing === "new" || editing === null ? `New ${noun}` : `Edit ${noun}`}>
        {editing !== null ? <ContactForm kind={kind} record={editing === "new" ? null : editing} onDone={() => setEditing(null)} /> : null}
      </Modal>
    </div>
  );
}
