import { describe, it, expect } from "vitest";
import { binarySearch, descent, join, customers, orders } from "./engines";
describe("deterministic simulations", () => {
  it("finds every element and terminates for absent targets", () => {
    for (const target of [2, 5, 8, 12, 16])
      expect(binarySearch([2, 5, 8, 12, 16], target).at(-1)?.found).toBe(true);
    expect(binarySearch([2, 5, 8], 7).at(-1)?.mid).toBe(-1);
  });
  it("rejects unsorted and invalid arrays", () => {
    expect(() => binarySearch([3, 1], 1)).toThrow();
    expect(() => binarySearch([], 1)).toThrow();
  });
  it("preserves duplicates and unmatched left rows", () => {
    expect(join(customers, orders, "INNER")).toHaveLength(3);
    expect(join(customers, orders, "LEFT")).toContainEqual({
      id: 2,
      name: "Ben",
      item: null,
    });
    expect(join(customers, orders, "LEFT")).toHaveLength(4);
  });
  it("converges, oscillates and diverges at correct rates", () => {
    expect(descent(0.1).at(-1)!.loss).toBeLessThan(0.001);
    expect(descent(1).at(-1)!.loss).toBe(16);
    expect(descent(1.1).at(-1)!.loss).toBeGreaterThan(16);
  });
});
