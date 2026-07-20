// Helper for MCP tools to read data from the google-sheets edge function.
// Import-safe: no env reads or I/O at module load; only inside readSheet().

export async function readSheet(sheet: string): Promise<Record<string, unknown>[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase env not configured");
  }
  const res = await fetch(`${supabaseUrl}/functions/v1/google-sheets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ action: "read", sheet }),
  });
  if (!res.ok) {
    throw new Error(`Failed to read ${sheet}: ${res.status}`);
  }
  const json = await res.json();
  if (!json?.success) {
    throw new Error(json?.error || `Failed to read ${sheet}`);
  }
  return (json.data as Record<string, unknown>[]) ?? [];
}

export function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}
