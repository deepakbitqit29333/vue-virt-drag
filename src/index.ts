import draggable from "./VirtualDraggable.vue";
import {
  computeGridVirtualRange,
  computeVirtualRange,
  reorderList,
  resolveItemKey,
} from "./utils";

/** Near drop-in for `vuedraggable` (Vue 2) with virtualized list/grid rendering. */
export { draggable };
/** Explicit alias — same component. */
export { draggable as VirtualDraggable };

export {
  computeGridVirtualRange,
  computeVirtualRange,
  reorderList,
  resolveItemKey,
};
export type {
  ChangeEvent,
  DraggedContext,
  ItemKey,
  MoveEventContext,
  RelatedContext,
  VirtualRange,
} from "./types";

export default draggable;

/** Vue.use(VueDragVirtualization) — registers as `draggable` like vuedraggable. */
export function install(Vue: {
  component: (name: string, component: unknown) => void;
}): void {
  Vue.component("draggable", draggable);
  Vue.component("VirtualDraggable", draggable);
}
