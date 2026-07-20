import { defineMcp } from "@lovable.dev/mcp-js";
import listMaterials from "./tools/list-materials";
import getStockBalance from "./tools/get-stock-balance";
import listTransactions from "./tools/list-transactions";

export default defineMcp({
  name: "prachathipat-inventory-mcp",
  title: "ระบบวัสดุคงคลัง โรงพยาบาลประชาธิปัตย์ (MCP)",
  version: "0.1.0",
  instructions:
    "Read-only tools for the Prachathipat Hospital material inventory system. Use list_materials to search the material catalog, get_stock_balance to compute current stock per material, and list_transactions to inspect stock-in (รับเข้า) or stock-out (เบิก) history.",
  tools: [listMaterials, getStockBalance, listTransactions],
});
