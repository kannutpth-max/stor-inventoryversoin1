import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { readSheet, toNumber } from "../sheets";

export default defineTool({
  name: "get_stock_balance",
  title: "Get stock balance",
  description: "Compute current stock balance for each material by aggregating all stock-in and stock-out transactions. Optionally filter by material id.",
  inputSchema: {
    material_id: z.string().optional().describe("Optional material id (e.g. B1) to return balance for a single material."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ material_id }) => {
    const [products, ins, outs] = await Promise.all([
      readSheet("products"),
      readSheet("stock_in"),
      readSheet("stock_out"),
    ]);
    const balances = new Map<string, number>();
    for (const r of ins) {
      const pid = String(r.product_id ?? "");
      if (!pid) continue;
      balances.set(pid, (balances.get(pid) ?? 0) + toNumber(r.quantity));
    }
    for (const r of outs) {
      const pid = String(r.product_id ?? "");
      if (!pid) continue;
      balances.set(pid, (balances.get(pid) ?? 0) - toNumber(r.quantity));
    }
    const items = products
      .map((p) => ({
        id: String(p.id ?? ""),
        name: String(p.name ?? ""),
        unit: String(p.unit ?? ""),
        balance: balances.get(String(p.id ?? "")) ?? 0,
      }))
      .filter((p) => (material_id ? p.id === material_id : true));
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { count: items.length, items },
    };
  },
});
