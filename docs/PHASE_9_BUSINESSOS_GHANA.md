# Phase 9 — BusinessOS Ghana capstone workspace

Status: built and verified locally. **Not yet applied to Neon, committed or pushed.**

## What it is
A small business the learner runs end to end, inside the app, so the capstone is real working software instead of a progress number. It covers the modules named in the brief: sales, inventory, customers, suppliers, expenses, financial tracking and business analytics. Amounts are Ghana cedis (GH₵).

Reached from the Portfolio capstone card ("workspace" pill) and at `/capstone`. Sections (a tab bar, not new sidebar items): Overview, Sales, Inventory, Customers, Suppliers, Expenses.

## Behaviour
- **Inventory:** products with cost, price, reorder level, optional supplier and opening stock. Restock (adds stock, sets the new unit cost, records the purchase as an expense) and manual adjustment (damage, stock-take). Stock can never go below zero.
- **Sales:** multi-line sales; prices and costs are copied onto the sale, so editing a product later never rewrites history. Payment by cash, mobile money, bank or **credit** (credit needs a customer, supports part-payment and later payments). Voiding a sale puts the stock back.
- **Customers / Suppliers:** contact details; customers show what they owe, suppliers show what has been spent with them.
- **Expenses:** categorised running costs; editable.
- **Overview (finance + analytics):** revenue, gross profit, net profit, cash position, money owed to you, running costs, stock value; 6-month revenue/costs/profit chart; best-selling products; where costs go; low stock; who owes you; best customers.

### Finance rules (stated on the page)
Net profit = sales − cost of goods sold − running costs. Buying stock is **not** a running cost (it becomes a cost when sold, otherwise it would be charged twice) but it does reduce cash position. Cash position = money actually collected − all money spent.

## Safety and correctness
- Money is stored as whole pesewas (integers); amounts are parsed strictly ("12", "12.5", "1,200.00"; rejects negatives, 3 decimals, text).
- Every row belongs to one user and every query and update is scoped by that user; customers, suppliers and products from another user are rejected.
- A sale is atomic: stock is checked and taken with a guarded decrement (two simultaneous sales cannot oversell) and a failure anywhere rolls back every stock change. A bug where an error *returned* inside a transaction would still commit earlier stock decrements was found by the tests and fixed (failures now throw to roll back; a regression test covers both line orders).
- Text fields are scanned for secrets like the rest of the app.

## Database
Migration `20261114090000_businessos_ghana`: tables `BosCustomer`, `BosSupplier`, `BosProduct`, `BosSale`, `BosSaleItem`, `BosStockMovement`, `BosExpense` and enums `BosPayment`, `BosStockReason`. Additive only. Applied to local dev and test databases.

## Verification (real results)
- `tsc`, `eslint`, `next build`: clean.
- Vitest: 10 files, **156 tests pass** (10 new in `tests/businessos.test.ts`: money parsing/formatting, ownership isolation, oversell and rollback, snapshot prices, credit/part-payment/void, restock and adjustments, profit/cash/receivables arithmetic).
- Browser (local, throwaway account, since deleted): created a supplier and a product through the forms, recorded a 3-unit sale, and the overview showed revenue GH₵55.50, gross profit GH₵25.50, stock value GH₵170.00, cash GH₵55.50, matching hand calculation. Narrow-width layout showed the tab bar scrolling.
- Not verified: full click-through of restock, credit payment and expense forms in the browser (covered by service tests only), side-by-side visual comparison (Base44 had no such pages).

## Needs your approval (design rules)
1. A whole new section (`/capstone` and five tabs); there was no BusinessOS UI in Base44.
2. No new sidebar item: it is reached from the Portfolio capstone card. Tell me if you want a "BusinessOS" sidebar entry.
3. The dashboard capstone strip still links to the Portfolio page, unchanged.

## Known limits
- Single currency (GH₵), no VAT/tax calculation, no multi-branch or staff users, no receipts/invoices export, no editing of an existing sale (void and re-enter).
- This is a practice workspace: the data is the learner's own and is not shared or audited.

## Deploying (not done)
Apply the migration to Neon with the unpooled URL, then push to GitHub (Netlify builds automatically).
