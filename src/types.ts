import type { GroupOptions, SortableEvent, MoveEvent as SortableMoveEvent } from "sortablejs";

export type ItemKey = string | ((item: unknown, index: number) => string | number);

/** Mirrors vuedraggable's move callback context. */
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

export type { GroupOptions, SortableEvent, SortableMoveEvent };
