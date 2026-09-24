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
  const safeHeight = Math.max(1, itemHeight);
  const totalHeight = itemCount * safeHeight;

  if (itemCount === 0 || viewportHeight <= 0) {
    return { start: 0, end: 0, offset: 0, totalHeight };
  }

  const rawStart = Math.floor(Math.max(0, scrollTop) / safeHeight);
  const visibleCount = Math.ceil(viewportHeight / safeHeight) + 1;
  const start = Math.max(0, rawStart - overscan);
  const end = Math.min(itemCount, rawStart + visibleCount + overscan);
  const offset = start * safeHeight;

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
