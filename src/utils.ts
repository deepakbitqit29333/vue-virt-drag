import type { VirtualRange } from "./types";

/**
 * Compute the visible window for a fixed-height vertical list.
 */
export function computeVirtualRange(
  scrollTop: number,
  viewportHeight: number,
  itemCount: number,
  itemHeight: number,
  overscan = 5
): VirtualRange {
  return computeGridVirtualRange(
    scrollTop,
    viewportHeight,
    itemCount,
    itemHeight,
    1,
    0,
    overscan
  );
}

/**
 * Window a flat list laid out as a fixed-size CSS grid (row-major).
 * Returns absolute item indices [start, end) covering whole visible rows (+ overscan).
 */
export function computeGridVirtualRange(
  scrollTop: number,
  viewportHeight: number,
  itemCount: number,
  itemHeight: number,
  columns: number,
  gap = 0,
  overscanRows = 5
): VirtualRange {
  const cols = Math.max(1, Math.floor(columns) || 1);
  const safeHeight = Math.max(1, itemHeight);
  const safeGap = Math.max(0, gap);
  const rowStride = safeHeight + safeGap;
  const rowCount = itemCount === 0 ? 0 : Math.ceil(itemCount / cols);
  const totalHeight =
    rowCount === 0
      ? 0
      : rowCount * safeHeight + Math.max(0, rowCount - 1) * safeGap;

  if (itemCount === 0 || viewportHeight <= 0) {
    return { start: 0, end: 0, offset: 0, totalHeight };
  }

  const rawStartRow = Math.floor(Math.max(0, scrollTop) / rowStride);
  const visibleRows = Math.ceil(viewportHeight / rowStride) + 1;
  const startRow = Math.max(0, rawStartRow - overscanRows);
  const endRow = Math.min(rowCount, rawStartRow + visibleRows + overscanRows);
  const start = startRow * cols;
  const end = Math.min(itemCount, endRow * cols);
  const offset = startRow * rowStride;

  return { start, end, offset, totalHeight };
}

/**
 * Resolve a stable key for a list item.
 * Required here because virtualization owns the v-for (unlike plain vuedraggable).
 */
export function resolveItemKey(
  item: unknown,
  index: number,
  itemKey: string | ((item: unknown, index: number) => string | number)
): string | number {
  if (typeof itemKey === "function") {
    return itemKey(item, index);
  }
  if (item && typeof item === "object" && itemKey in (item as Record<string, unknown>)) {
    const value = (item as Record<string, unknown>)[itemKey];
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
  }
  return index;
}

/**
 * Reorder a list immutably by moving oldIndex -> newIndex.
 */
export function reorderList<T>(list: T[], oldIndex: number, newIndex: number): T[] {
  if (
    oldIndex === newIndex ||
    oldIndex < 0 ||
    newIndex < 0 ||
    oldIndex >= list.length ||
    newIndex >= list.length
  ) {
    return list.slice();
  }
  const next = list.slice();
  const [moved] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, moved);
  return next;
}
