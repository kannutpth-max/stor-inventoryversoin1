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

