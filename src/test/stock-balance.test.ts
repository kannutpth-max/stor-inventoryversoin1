import { describe, expect, it } from "vitest";
import { calculateStockBalance, parseQuantity } from "@/lib/utils";

describe("inventory balance used by requisitions", () => {
  it("parses comma-grouped stock values without truncating thousands", () => {
    expect(parseQuantity("1,490")).toBe(1490);
  });

  it("uses received stock minus dispensed transactions, excluding pending requisitions", () => {
    const stockIns = [{ product_id: "P144", quantity: "1,490" }];
    const stockOuts = [
      { product_id: "P144", quantity: "1", status: "dispensed" },
      { product_id: "P144", quantity: "20", status: "" },
    ];
    expect(calculateStockBalance("P144", stockIns, stockOuts)).toBe(1489);
  });

  it("returns zero for a product with no stock-in history", () => {
    expect(calculateStockBalance("missing", [], [])).toBe(0);
  });
});