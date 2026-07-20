import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { readSheet } from "../sheets";

function inRange(dateStr: unknown, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const s = String(dateStr ?? "");
  if (from && s < from) return false;
  if (to && s > to) return false;
  return true;
}

export default defineTool({
  name: "list_transactions",
  title: "List stock transactions",
  description: "List stock-in (รับเข้า) or stock-out (เบิก) transactions. Optionally filter by material id and by ISO date range (YYYY-MM-DD).",
  inputSchema: {
    type: z.enum(["in", "out"]).describe("'in' for stock-in (รับเข้า), 'out' for stock-out (เบิก)."),
    material_id: z.string().optional().describe("Optional material id filter (e.g. B1)."),
    date_from: z.string().optional().describe("Optional start date YYYY-MM-DD (inclusive)."),
    date_to: z.string().optional().describe("Optional end date YYYY-MM-DD (inclusive)."),
    limit: z.number().int().positive().optional().describe("Max rows to return (default 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type, material_id, date_from, date_to, limit }) => {
    const sheet = type === "in" ? "stock_in" : "stock_out";
    const rows = await readSheet(sheet);
    const filtered = rows.filter((r) => {
      if (material_id && String(r.product_id ?? "") !== material_id) return false;
      if (!inRange(r.date, date_from, date_to)) return false;
      return true;
    });
    const capped = filtered.slice(0, limit ?? 200);
    return {
      content: [{ type: "text", text: JSON.stringify(capped, null, 2) }],
      structuredContent: { count: capped.length, items: capped },
    };
  },
});
