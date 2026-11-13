"use client";

import { useState } from "react";
import { PackagePlus, Pencil, Plus, SlidersHorizontal, Trash2, Package } from "lucide-react";
import { adjustStockAction, deleteProductAction, restockAction, saveProductAction } from "@/app/(app)/actions";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtGhs, toCedisInput } from "@/lib/businessos/money";
import type { ProductView } from "@/lib/businessos/service";
import { FormError, NONE, Tile, useSubmit } from "./bos-ui";

type Supplier = { id: string; name: string };
type Mode = { type: "edit"; product: ProductView | null } | { type: "restock"; product: ProductView } | { type: "adjust"; product: ProductView } | null;

function SupplierSelect({ value, onChange, suppliers }: { value: string; onChange: (v: string) => void; suppliers: Supplier[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>None</SelectItem>
        {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ProductForm({ product, suppliers, onDone }: { product: ProductView | null; suppliers: Supplier[]; onDone: () => void }) {
  const { pending, error, submit } = useSubmit();
  const [name, setName] = useState(product?.name ?? "");
  const [supplier, setSupplier] = useState(product?.supplierId || NONE);
  return (
    <form
      action={(fd) =>
        submit(
          () => saveProductAction(product?.id ?? null, {
            name, sku: String(fd.get("sku") ?? ""), unit: String(fd.get("unit") ?? ""), cost: String(fd.get("cost") ?? ""), price: String(fd.get("price") ?? ""),
            reorderLevel: Number(fd.get("reorderLevel") ?? 5), openingStock: Number(fd.get("openingStock") ?? 0), supplierId: supplier === NONE ? "" : supplier,
          }),
          { success: product ? "Product saved" : "Product added", onDone },
        )
      }
      className="space-y-4"
    >
      <FormError message={error} />
      <FormField label="Product"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} placeholder="Shea butter 250g" /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="SKU (optional)"><Input name="sku" defaultValue={product?.sku} maxLength={40} /></FormField>
        <FormField label="Unit"><Input name="unit" defaultValue={product?.unit ?? "pc"} maxLength={20} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Cost per unit (GH₵)"><Input name="cost" inputMode="decimal" required defaultValue={product ? toCedisInput(product.cost) : ""} placeholder="10.00" /></FormField>
        <FormField label="Selling price (GH₵)"><Input name="price" inputMode="decimal" required defaultValue={product ? toCedisInput(product.price) : ""} placeholder="18.50" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Reorder when stock is at"><Input name="reorderLevel" type="number" min={0} defaultValue={product?.reorderLevel ?? 5} /></FormField>
        {product ? null : <FormField label="Opening stock"><Input name="openingStock" type="number" min={0} defaultValue={0} /></FormField>}
      </div>
      <FormField label="Usual supplier"><SupplierSelect value={supplier} onChange={setSupplier} suppliers={suppliers} /></FormField>
      <Button type="submit" disabled={pending || !name.trim()} className="w-full">{pending ? "Saving…" : product ? "Save changes" : "Add product"}</Button>
    </form>
  );
}

function RestockForm({ product, suppliers, today, onDone }: { product: ProductView; suppliers: Supplier[]; today: string; onDone: () => void }) {
  const { pending, error, submit } = useSubmit();
  const [supplier, setSupplier] = useState(product.supplierId || NONE);
  return (
    <form
      action={(fd) =>
        submit(
          () => restockAction(product.id, { qty: Number(fd.get("qty") ?? 0), unitCost: String(fd.get("unitCost") ?? ""), supplierId: supplier === NONE ? "" : supplier, date: String(fd.get("date") ?? "") }),
          { success: "Stock added and purchase recorded", onDone },
        )
      }
      className="space-y-4"
    >
      <FormError message={error} />
      <p className="text-xs text-muted-foreground">Adds stock, sets the new unit cost, and records the purchase as an expense.</p>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Units received"><Input name="qty" type="number" min={1} required autoFocus /></FormField>
        <FormField label="Cost per unit (GH₵)"><Input name="unitCost" inputMode="decimal" required defaultValue={toCedisInput(product.cost)} /></FormField>
      </div>
      <FormField label="Supplier"><SupplierSelect value={supplier} onChange={setSupplier} suppliers={suppliers} /></FormField>
      <FormField label="Date"><Input name="date" type="date" defaultValue={today} required /></FormField>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Add stock"}</Button>
    </form>
  );
}

function AdjustForm({ product, onDone }: { product: ProductView; onDone: () => void }) {
  const { pending, error, submit } = useSubmit();
  return (
    <form action={(fd) => submit(() => adjustStockAction(product.id, Number(fd.get("delta") ?? 0), String(fd.get("note") ?? "")), { success: "Stock adjusted", onDone })} className="space-y-4">
      <FormError message={error} />
      <p className="text-xs text-muted-foreground">Use this for damage, loss or a stock-take. Now: {product.stock} {product.unit}. Use a negative number to remove stock.</p>
      <FormField label="Change (+ or −)"><Input name="delta" type="number" step={1} required autoFocus placeholder="-2" /></FormField>
      <FormField label="Reason"><Input name="note" maxLength={200} placeholder="Damaged in transit" /></FormField>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Adjust stock"}</Button>
    </form>
  );
}

export function InventoryView({ products, suppliers, today }: { products: ProductView[]; suppliers: Supplier[]; today: string }) {
  const [mode, setMode] = useState<Mode>(null);
  const { pending, submit } = useSubmit();
  const low = products.filter((p) => p.low).length;
  const value = products.reduce((s, p) => s + p.stock * p.cost, 0);
  const title = mode?.type === "restock" ? `Restock ${mode.product.name}` : mode?.type === "adjust" ? `Adjust ${mode.product.name}` : mode?.product ? "Edit product" : "New product";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="BusinessOS Ghana" title="Inventory" description="What you stock, what it costs, and what is running low.">
        <Button onClick={() => setMode({ type: "edit", product: null })}><Plus className="h-4 w-4" /> New product</Button>
      </PageHeader>

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Products" value={products.length} />
        <Tile label="Low stock" value={low} tone={low ? "bad" : undefined} />
        <Tile label="Stock value (at cost)" value={fmtGhs(value)} />
      </div>

      {products.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" hint="Add what you sell, with its cost and price, to start recording sales." />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-normal">Product</th>
                <th scope="col" className="px-3 py-3 text-right font-normal">Cost</th>
                <th scope="col" className="px-3 py-3 text-right font-normal">Price</th>
                <th scope="col" className="px-3 py-3 text-right font-normal">In stock</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="px-5 py-3 font-normal text-foreground">
                    {p.name}
                    <span className="block text-[11px] text-muted-foreground">{[p.sku, p.supplierName].filter(Boolean).join(" · ")}</span>
                  </th>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtGhs(p.cost)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtGhs(p.price)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${p.low ? "text-destructive" : ""}`}>
                    {p.stock} {p.unit}{p.low ? <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.1em]">low</span> : null}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" aria-label={`Restock ${p.name}`} onClick={() => setMode({ type: "restock", product: p })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"><PackagePlus className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label={`Adjust stock of ${p.name}`} onClick={() => setMode({ type: "adjust", product: p })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><SlidersHorizontal className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label={`Edit ${p.name}`} onClick={() => setMode({ type: "edit", product: p })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button
                        type="button" aria-label={`Delete ${p.name}`} disabled={pending}
                        onClick={() => { if (window.confirm(`Delete ${p.name}? Past sales keep their record of it.`)) submit(() => deleteProductAction(p.id), { success: "Product deleted" }); }}
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

      <Modal open={mode !== null} onOpenChange={(o) => { if (!o) setMode(null); }} title={title}>
        {mode?.type === "edit" ? <ProductForm product={mode.product} suppliers={suppliers} onDone={() => setMode(null)} /> : null}
        {mode?.type === "restock" ? <RestockForm product={mode.product} suppliers={suppliers} today={today} onDone={() => setMode(null)} /> : null}
        {mode?.type === "adjust" ? <AdjustForm product={mode.product} onDone={() => setMode(null)} /> : null}
      </Modal>
    </div>
  );
}
