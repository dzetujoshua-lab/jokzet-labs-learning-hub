/** Money is stored as whole pesewas (GHS x 100) so there is never floating-point drift. Pure helpers, safe on server and client. */

export const MAX_PESEWAS = 100_000_000_00; // GHS 100,000,000

/** "12", "12.5", "12.50", "1,200.00" -> pesewas. Returns null for anything else (negative, 3 decimals, text). */
export function parseCedis(input: string | number): number | null {
  const text = String(input).trim().replace(/,/g, "").replace(/^GH[S₵]\s*/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  const pesewas = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(pesewas) && pesewas <= MAX_PESEWAS ? pesewas : null;
}

export function fmtGhs(pesewas: number): string {
  const sign = pesewas < 0 ? "-" : "";
  const abs = Math.abs(pesewas);
  const whole = Math.floor(abs / 100).toLocaleString("en-GH");
  return `${sign}GH₵${whole}.${String(abs % 100).padStart(2, "0")}`;
}

/** Pesewas as an editable "12.50" string for form fields. */
export const toCedisInput = (pesewas: number) => (pesewas / 100).toFixed(2);
