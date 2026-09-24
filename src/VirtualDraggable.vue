<template>
  <div class="vdv-root">
    <slot name="header" />
    <div
      ref="viewport"
      class="vdv-viewport"
      :class="viewportClass"
      :style="viewportStyle"
      @scroll.passive="onScroll"
    >
      <div class="vdv-spacer" :style="{ height: totalHeight + 'px' }">
        <component
          :is="tag"
          ref="listEl"
          class="vdv-list"
          :style="{ transform: 'translateY(' + offsetY + 'px)' }"
          v-bind="tagAttrs"
        >
          <div
            v-for="(element, localIndex) in visibleItems"
            :key="itemKeys[localIndex]"
            class="vdv-item"
            :data-id="String(itemKeys[localIndex])"
            :data-index="startIndex + localIndex"
            :style="itemStyle"
          >
            <slot
              name="item"
              :element="element"
              :index="startIndex + localIndex"
            />
          </div>
        </component>
      </div>
    </div>
    <slot name="footer" />
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from "vue";
import Sortable, {
  GroupOptions,
  SortableEvent,
  MoveEvent as SortableMoveEvent,
} from "sortablejs";
import {
  computeVirtualRange,
  reorderList,
  resolveItemKey,
} from "./utils";
import type { ChangeEvent, MoveEventContext } from "./types";

type ListItem = unknown;

/** Sortable option prop names we forward (mirrors vuedraggable transparent options). */
const SORTABLE_PROP_KEYS = [
  "group",
  "sort",
  "delay",
  "delayOnTouchOnly",
  "touchStartThreshold",
  "disabled",
  "animation",
  "easing",
  "handle",
  "filter",
  "preventOnFilter",
  "draggable",
  "dataIdAttr",
  "ghostClass",
  "chosenClass",
  "dragClass",
  "swapThreshold",
  "invertSwap",
  "invertedSwapThreshold",
  "direction",
  "forceFallback",
  "fallbackClass",
  "fallbackOnBody",
  "fallbackTolerance",
  "dragoverBubble",
  "removeCloneOnHide",
  "emptyInsertThreshold",
  "scroll",
  "scrollSensitivity",
  "scrollSpeed",
  "bubbleScroll",
] as const;

type SortablePropKey = (typeof SORTABLE_PROP_KEYS)[number];

export default Vue.extend({
  name: "draggable",
  model: {
    prop: "value",
    event: "input",
  },
  props: {
    // --- vuedraggable core ---
    value: {
      type: Array as PropType<ListItem[] | null>,
      default: null,
    },
    list: {
      type: Array as PropType<ListItem[] | null>,
      default: null,
    },
    clone: {
      type: Function as PropType<(original: ListItem) => ListItem>,
      default: (original: ListItem) => original,
    },
    move: {
      type: Function as PropType<
        (ctx: MoveEventContext, evt: SortableMoveEvent) => boolean | void
      >,
      default: null,
    },
    tag: {
      type: String,
      default: "div",
    },
    componentData: {
      type: Object as PropType<{
        props?: Record<string, unknown>;
        attrs?: Record<string, unknown>;
        on?: Record<string, Function>;
      }>,
      default: null,
    },

    // --- virtualization (required extras vs plain vuedraggable) ---
    /**
     * Stable key field or resolver. Required because this component owns the
     * v-for (plain vuedraggable keys live on your slot children instead).
     */
    itemKey: {
      type: [String, Function] as PropType<
        string | ((item: ListItem, index: number) => string | number)
      >,
      required: true,
    },
    /** Fixed row height in px — required for windowing. */
    itemHeight: {
      type: Number,
      required: true,
      validator: (v: number) => v > 0,
    },
    /** Scroll viewport height in px. */
    height: {
      type: Number,
      required: true,
      validator: (v: number) => v > 0,
    },
    /** Extra rows rendered above/below the viewport. */
    overscan: {
      type: Number,
      default: 5,
    },
    /** Optional class on the scroll viewport. */
    viewportClass: {
      type: [String, Object, Array] as PropType<string | Record<string, boolean> | unknown[]>,
      default: undefined,
    },

    // --- Sortable options as props (vuedraggable ≥2.19 style) ---
    group: {
      type: [String, Object] as PropType<string | GroupOptions>,
      default: undefined,
    },
    sort: { type: Boolean, default: true },
    delay: { type: Number, default: 0 },
    delayOnTouchOnly: { type: Boolean, default: false },
    touchStartThreshold: { type: Number, default: 0 },
    disabled: { type: Boolean, default: false },
    animation: { type: Number, default: 150 },
    easing: { type: String, default: undefined },
    handle: { type: String, default: undefined },
    filter: { type: String, default: undefined },
    preventOnFilter: { type: Boolean, default: true },
    draggable: { type: String, default: ".vdv-item" },
    dataIdAttr: { type: String, default: "data-id" },
    ghostClass: { type: String, default: "sortable-ghost" },
    chosenClass: { type: String, default: "sortable-chosen" },
    dragClass: { type: String, default: "sortable-drag" },
    swapThreshold: { type: Number, default: 1 },
    invertSwap: { type: Boolean, default: false },
    invertedSwapThreshold: { type: Number, default: undefined },
    direction: { type: String, default: "vertical" },
    forceFallback: { type: Boolean, default: false },
    fallbackClass: { type: String, default: "sortable-fallback" },
    fallbackOnBody: { type: Boolean, default: false },
    fallbackTolerance: { type: Number, default: 0 },
    dragoverBubble: { type: Boolean, default: false },
    removeCloneOnHide: { type: Boolean, default: true },
    emptyInsertThreshold: { type: Number, default: 5 },
    scroll: { type: Boolean, default: true },
    scrollSensitivity: { type: Number, default: 30 },
    scrollSpeed: { type: Number, default: 10 },
    bubbleScroll: { type: Boolean, default: true },

    /** Escape hatch: merged last into Sortable options. */
    options: {
      type: Object as PropType<Record<string, unknown>>,
      default: null,
    },
  },
  data() {
    return {
      scrollTop: 0,
      sortable: null as Sortable | null,
      dragging: false,
    };
  },
  computed: {
    realList(): ListItem[] {
      // Prefer list when provided (vuedraggable: do not use both).
      if (this.list != null) return this.list as ListItem[];
      return (this.value as ListItem[]) || [];
    },
    range(): ReturnType<typeof computeVirtualRange> {
      return computeVirtualRange(
        this.scrollTop,
        this.height,
        this.realList.length,
        this.itemHeight,
        this.overscan
      );
    },
    startIndex(): number {
      return this.range.start;
    },
    endIndex(): number {
      return this.range.end;
    },
    offsetY(): number {
      return this.range.offset;
    },
    totalHeight(): number {
      return this.range.totalHeight;
    },
    visibleItems(): ListItem[] {
      return this.realList.slice(this.startIndex, this.endIndex);
    },
    itemKeys(): Array<string | number> {
      return this.visibleItems.map((el, i) =>
        resolveItemKey(el, this.startIndex + i, this.itemKey)
      );
    },
    viewportStyle(): Record<string, string> {
      return {
        height: `${this.height}px`,
        overflowY: "auto",
        position: "relative",
      };
    },
    itemStyle(): Record<string, string> {
      return {
        height: `${this.itemHeight}px`,
        boxSizing: "border-box",
      };
    },
    tagAttrs(): Record<string, unknown> {
      if (!this.componentData) return {};
      return {
        ...(this.componentData.attrs || {}),
        ...(this.componentData.props || {}),
      };
    },
  },
  watch: {
    disabled(val: boolean) {
      this.sortable?.option("disabled", val);
    },
    handle(val: string | undefined) {
      this.sortable?.option("handle", val);
    },
    group(val: string | GroupOptions | undefined) {
      this.sortable?.option("group", val as never);
    },
    realList() {
      this.$nextTick(() => {
        // Windowed DOM set changed; Sortable stays bound to listEl.
      });
    },
  },
  mounted() {
    this.bindComponentDataListeners();
    this.ensureSortable();
  },
  beforeDestroy() {
    this.destroySortable();
  },
  methods: {
    onScroll(event: Event) {
      const target = event.target as HTMLElement;
      this.scrollTop = target.scrollTop;
    },
    bindComponentDataListeners() {
      const on = this.componentData?.on;
      if (!on) return;
      Object.keys(on).forEach((evt) => {
        this.$on(evt, on[evt]);
      });
    },
    buildSortableOptions(): Record<string, unknown> {
      const opts: Record<string, unknown> = {};
      for (const key of SORTABLE_PROP_KEYS) {
        const val = (this as unknown as Record<SortablePropKey, unknown>)[key];
        if (val !== undefined) {
          opts[key] = val;
        }
      }
      // Virtualization owns which nodes exist; never let Sortable pull from other lists
      // in this first slice without an explicit group (still same-list by default).
      opts.onStart = (evt: SortableEvent) => this.onDragStart(evt);
      opts.onAdd = (evt: SortableEvent) => this.onDragAdd(evt);
      opts.onRemove = (evt: SortableEvent) => this.onDragRemove(evt);
      opts.onUpdate = (evt: SortableEvent) => this.onDragUpdate(evt);
      opts.onEnd = (evt: SortableEvent) => this.onDragEnd(evt);
      opts.onChoose = (evt: SortableEvent) => this.$emit("choose", evt);
      opts.onUnchoose = (evt: SortableEvent) => this.$emit("unchoose", evt);
      opts.onSort = (evt: SortableEvent) => this.$emit("sort", evt);
      opts.onFilter = (evt: SortableEvent) => this.$emit("filter", evt);
      opts.onClone = (evt: SortableEvent) => this.$emit("clone", evt);
      opts.onMove = (evt: SortableMoveEvent, originalEvent: Event) =>
        this.onDragMove(evt, originalEvent);

      if (this.options) {
        Object.assign(opts, this.options);
      }
      return opts;
    },
    ensureSortable() {
      const el = this.getListElement();
      if (!el || this.sortable) return;

      this.sortable = Sortable.create(el, this.buildSortableOptions() as never);
    },
    destroySortable() {
      if (this.sortable) {
        this.sortable.destroy();
        this.sortable = null;
      }
    },
    getListElement(): HTMLElement | null {
      const ref = this.$refs.listEl as HTMLElement | Vue | undefined;
      if (!ref) return null;
      if (ref instanceof HTMLElement) return ref;
      return (ref.$el as HTMLElement) || null;
    },
    toAbsoluteIndex(localIndex: number | undefined | null): number {
      if (localIndex == null || localIndex < 0) return -1;
      return this.startIndex + localIndex;
    },
    domIndexOf(node: HTMLElement): number {
      const el = this.getListElement();
      if (!el) return -1;
      return Array.prototype.indexOf.call(el.children, node);
    },
    contextForMove(
      evt: SortableMoveEvent
    ): MoveEventContext {
      const dragged = evt.dragged;
      const related = evt.related;
      const oldLocal = dragged ? this.domIndexOf(dragged) : -1;
      const relatedLocal = related ? this.domIndexOf(related) : -1;
      const index = this.toAbsoluteIndex(oldLocal);
      let futureIndex = this.toAbsoluteIndex(relatedLocal);
      if (evt.willInsertAfter && futureIndex >= 0) {
        futureIndex += 1;
      }
      // When moving down, Sortable's insert-after index needs adjustment like vuedraggable.
      if (index < futureIndex) {
        futureIndex -= 1;
      }

      return {
        draggedContext: {
          index,
          element: this.realList[index],
          futureIndex,
        },
        relatedContext: {
          index: this.toAbsoluteIndex(relatedLocal),
          element:
            relatedLocal >= 0
              ? this.realList[this.toAbsoluteIndex(relatedLocal)]
              : undefined,
          list: this.realList,
          component: this,
        },
      };
    },
    onDragMove(evt: SortableMoveEvent, originalEvent: Event): boolean | void {
      if (!this.move) return true;
      const ctx = this.contextForMove(evt);
      return this.move(ctx, evt);
    },
    onDragStart(evt: SortableEvent) {
      this.dragging = true;
      this.emitSortableEvent("start", evt);
    },
    onDragUpdate(evt: SortableEvent) {
      this.emitSortableEvent("update", evt);
      // Same-list reorder is finalized in onEnd after DOM revert.
    },
    onDragAdd(evt: SortableEvent) {
      // Cross-list add: not fully supported in first slice (virtualization + shared groups).
      this.emitSortableEvent("add", evt);
      this.revertSortableDom(evt);
    },
    onDragRemove(evt: SortableEvent) {
      this.emitSortableEvent("remove", evt);
      this.revertSortableDom(evt);
    },
    onDragEnd(evt: SortableEvent) {
      this.dragging = false;

      const oldAbs = this.toAbsoluteIndex(evt.oldIndex);
      const newAbs = this.toAbsoluteIndex(evt.newIndex);

      // Undo Sortable DOM mutation — Vue owns the virtual window.
      this.revertSortableDom(evt);

      if (
        evt.from === evt.to &&
        oldAbs !== newAbs &&
        oldAbs >= 0 &&
        newAbs >= 0 &&
        oldAbs < this.realList.length &&
        newAbs < this.realList.length
      ) {
        this.spliceList(oldAbs, newAbs);
      }

      this.emitSortableEvent("end", evt, { oldIndex: oldAbs, newIndex: newAbs });
    },
    spliceList(oldIndex: number, newIndex: number) {
      const list = this.realList;
      const element = list[oldIndex];
      const next = reorderList(list, oldIndex, newIndex);

      if (this.list != null) {
        // vuedraggable list mode: mutate via splice.
        this.list.splice(0, this.list.length, ...next);
        const change: ChangeEvent = {
          moved: { element, oldIndex, newIndex },
        };
        this.$emit("change", change);
      } else {
        // v-model mode: emit new array (immutable).
        this.$emit("input", next);
      }
    },
    emitSortableEvent(
      name: string,
      evt: SortableEvent,
      indexOverride?: { oldIndex: number; newIndex: number }
    ) {
      // Emit a shallow clone with absolute indices so listeners match list indices.
      const payload = Object.assign({}, evt, {
        oldIndex: indexOverride?.oldIndex ?? this.toAbsoluteIndex(evt.oldIndex),
        newIndex: indexOverride?.newIndex ?? this.toAbsoluteIndex(evt.newIndex),
      });
      this.$emit(name, payload);
    },
    revertSortableDom(evt: SortableEvent) {
      const parent = evt.from;
      if (!parent || evt.oldIndex == null) return;
      const children = Array.from(parent.children) as HTMLElement[];
      const currentLocal = children.indexOf(evt.item);
      if (currentLocal === evt.oldIndex) return;
      const ref =
        evt.oldIndex >= children.length ? null : children[evt.oldIndex];
      if (ref && ref !== evt.item) {
        parent.insertBefore(evt.item, ref);
      } else {
        parent.appendChild(evt.item);
      }
    },
    /** Scroll so an absolute index is visible. */
    scrollToIndex(index: number) {
      const viewport = this.$refs.viewport as HTMLElement | undefined;
      if (!viewport) return;
      const top = Math.max(0, index * this.itemHeight);
      viewport.scrollTop = top;
      this.scrollTop = top;
    },
  },
});
</script>

<style>
.vdv-root {
  display: block;
}

.vdv-viewport {
  -webkit-overflow-scrolling: touch;
}

.vdv-spacer {
  position: relative;
  width: 100%;
}

.vdv-list {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.vdv-item {
  width: 100%;
}
</style>
