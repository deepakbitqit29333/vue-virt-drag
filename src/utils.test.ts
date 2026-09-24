import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeGridVirtualRange,
  computeVirtualRange,
  reorderList,
  resolveItemKey,
} from "./utils.ts";

describe("computeVirtualRange", () => {
  it("windows a long list", () => {
    const range = computeVirtualRange(520, 400, 5000, 52, 5);
    assert.equal(range.start, Math.max(0, Math.floor(520 / 52) - 5));
    assert.ok(range.end > range.start);
    assert.equal(range.totalHeight, 5000 * 52);
    assert.equal(range.offset, range.start * 52);
  });

  it("handles empty list", () => {
    const range = computeVirtualRange(0, 400, 0, 52);
    assert.deepEqual(range, { start: 0, end: 0, offset: 0, totalHeight: 0 });
  });
});

describe("computeGridVirtualRange", () => {
  it("windows by rows across columns", () => {
    // 4 columns, 100px tall cells, 8px gap → stride 108
    const range = computeGridVirtualRange(216, 400, 5000, 100, 4, 8, 2);
    // rawStartRow = floor(216/108)=2; startRow = max(0, 2-2)=0
    assert.equal(range.start, 0);
    assert.ok(range.end % 4 === 0 || range.end === 5000);
    assert.equal(range.offset, 0);
    const rows = Math.ceil(5000 / 4);
    assert.equal(range.totalHeight, rows * 100 + (rows - 1) * 8);
  });

  it("maps mid-scroll to absolute item indices", () => {
    const range = computeGridVirtualRange(1080, 400, 2000, 100, 4, 0, 1);
    // stride 100; rawStartRow=10; startRow=9 → start index 36
    assert.equal(range.start, 9 * 4);
    assert.equal(range.offset, 9 * 100);
    assert.ok(range.end > range.start);
  });
});

describe("resolveItemKey", () => {
  it("reads a field", () => {
    assert.equal(resolveItemKey({ id: 9 }, 0, "id"), 9);
  });

  it("uses a function", () => {
    assert.equal(
      resolveItemKey({ id: 1 }, 3, (item, i) => `${(item as { id: number }).id}-${i}`),
      "1-3"
    );
  });
});

describe("reorderList", () => {
  it("moves an item", () => {
    assert.deepEqual(reorderList(["a", "b", "c", "d"], 1, 3), [
      "a",
      "c",
      "d",
      "b",
    ]);
  });

  it("no-ops on same index", () => {
    assert.deepEqual(reorderList([1, 2, 3], 1, 1), [1, 2, 3]);
  });
});
