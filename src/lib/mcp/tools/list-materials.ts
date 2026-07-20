import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { readSheet } from "../sheets";

export default defineTool({
  name: "list_materials",
  title: "List materials",
  description: "List all materials (วัสดุ) in the hospital inventory, including id, name, category, and unit. Optionally filter by a substring match on id or name.",
  inputSchema: {
    search: z.string().optional().describe("Optional substring to match against material id or name."),
    limit: z.number().int().positive().optional().describe("Maximum number of rows to return (default 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }) => {
    const rows = await readSheet("products");
    const q = (search ?? "").toString().trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) =>
          String(r.id ?? "").toLowerCase().includes(q) ||
          String(r.name ?? "").toLowerCase().includes(q),
        )
      : rows;
    const capped = filtered.slice(0, limit ?? 200);
    return {
      content: [{ type: "text", text: JSON.stringify(capped, null, 2) }],
      structuredContent: { count: capped.length, items: capped },
    };
  },
});
