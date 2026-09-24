import type { DefineComponent } from "vue";
import type { GroupOptions, SortableEvent } from "sortablejs";

export type ItemKey = string | ((item: unknown, index: number) => string | number);

export interface DraggedContext<T = unknown> {
  index: number;
  element: T;
  futureIndex: number;
}

export interface RelatedContext<T = unknown> {
  index: number;
  element: T | undefined;
  list: T[];
  component: unknown;
}

export interface MoveEventContext<T = unknown> {
  draggedContext: DraggedContext<T>;
  relatedContext: RelatedContext<T>;
}

export interface ChangeEvent<T = unknown> {
  added?: { element: T; newIndex: number };
  removed?: { element: T; oldIndex: number };
  moved?: { element: T; oldIndex: number; newIndex: number };
}

export interface VirtualRange {
  start: number;
  end: number;
  offset: number;
  totalHeight: number;
}

export declare function computeVirtualRange(
  scrollTop: number,
  viewportHeight: number,
  itemCount: number,
  itemHeight: number,
  overscan?: number
): VirtualRange;

export declare function computeGridVirtualRange(
  scrollTop: number,
  viewportHeight: number,
  itemCount: number,
  itemHeight: number,
  columns: number,
  gap?: number,
  overscanRows?: number
): VirtualRange;

export declare function resolveItemKey(
  item: unknown,
  index: number,
  itemKey: ItemKey
): string | number;

export declare function reorderList<T>(list: T[], oldIndex: number, newIndex: number): T[];

export declare const draggable: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
export declare const VirtualDraggable: typeof draggable;
export default draggable;

export declare function install(Vue: {
  component: (name: string, component: unknown) => void;
}): void;

export type { GroupOptions, SortableEvent };
