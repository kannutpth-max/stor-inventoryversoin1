import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a date value that may come from Google Sheets as either
 * an ISO string ("yyyy-MM-dd"), a locale string, or an Excel serial number
 * (days since 1899-12-30). Returns a JS Date.
 */
export function parseSheetDate(v: string | number | Date | null | undefined): Date {
  if (v instanceof Date) return v;
  if (v === null || v === undefined || v === "") return new Date(NaN);
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    // Excel/Sheets epoch: 1899-12-30
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }
  return new Date(s);
}

export function formatThaiBuddhistDate(
  v: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
): string {
  const date = parseSheetDate(v);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist-nu-latn", options).format(date);
}

/** Round a price to at most 2 decimal places. */
export function roundPrice(n: number | string | null | undefined): number {
  const v = typeof n === "number" ? n : parseFloat(String(n ?? ""));
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

/** Limit a price input string to at most 2 decimal places while typing. */
export function clampPriceInput(v: string): string {
  const cleaned = v.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 3);
}

/** Format a money amount with at most 2 decimal places. */
export function formatMoney(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

