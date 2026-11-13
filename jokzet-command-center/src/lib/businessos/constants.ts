/** Shared by server code and client forms, so it must not import anything server-only. */
export const STOCK_PURCHASE = "Stock purchase"; // restock expenses: cash out, but counted in cost of goods, not operating costs
export const EXPENSE_CATEGORIES = ["Rent", "Transport", "Utilities", "Salaries", "Marketing", "Airtime & data", "Repairs", "Taxes & fees", "Other"] as const;
export const PAYMENTS = ["CASH", "MOMO", "BANK", "CREDIT"] as const;
