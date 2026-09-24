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
          :class="listClass"
          :style="listStyle"
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
  computeGridVirtualRange,
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
    /** Fixed row/cell height in px — required for windowing. */
    itemHeight: {
      type: Number,
      required: true,
      validator: (v: number) => v > 0,
    },
    /**
     * Cell width in px for `layout="grid"`. Defaults to `itemHeight` (square cells).
     * Ignored for list layout.
     */
    itemWidth: {
      type: Number,
      default: undefined,
      validator: (v: number | undefined) => v == null || v > 0,
    },
    /**
     * Layout mode. `list` = single column (default). `grid` = CSS grid with
     * `columns` cells per row; virtualization windows by row.
     */
    layout: {
      type: String as PropType<"list" | "grid">,
      default: "list",
      validator: (v: string) => v === "list" || v === "grid",
    },
    /** Column count when `layout="grid"` (default 4). Ignored for list. */
    columns: {
      type: Number,
      default: 4,
      validator: (v: number) => v >= 1,
    },
    /** Gap between grid cells in px (also used as row stride for windowing). */
    gap: {
      type: Number,
      default: 0,
      validator: (v: number) => v >= 0,
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
    direction: { type: String, default: undefined },
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
    isGrid(): boolean {
      return this.layout === "grid";
    },
    resolvedColumns(): number {
      return this.isGrid ? Math.max(1, Math.floor(this.columns) || 1) : 1;
    },
    resolvedItemWidth(): number {
      return this.itemWidth != null && this.itemWidth > 0
        ? this.itemWidth
        : this.itemHeight;
    },
    resolvedGap(): number {
      return this.isGrid ? Math.max(0, this.gap) : 0;
    },
    range(): ReturnType<typeof computeGridVirtualRange> {
      return computeGridVirtualRange(
        this.scrollTop,
        this.height,
        this.realList.length,
        this.itemHeight,
        this.resolvedColumns,
        this.resolvedGap,
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
    listClass(): Record<string, boolean> {
      return {
        "vdv-list--grid": this.isGrid,
        "vdv-list--list": !this.isGrid,
      };
    },
    listStyle(): Record<string, string> {
      const style: Record<string, string> = {
        transform: `translateY(${this.offsetY}px)`,
      };
      if (this.isGrid) {
        style.display = "grid";
        style.gridTemplateColumns = `repeat(${this.resolvedColumns}, ${this.resolvedItemWidth}px)`;
        style.gap = `${this.resolvedGap}px`;
        style.width = "100%";
        style.justifyContent = "start";
      }
      return style;
    },
    itemStyle(): Record<string, string> {
      if (this.isGrid) {
        return {
          width: `${this.resolvedItemWidth}px`,
          height: `${this.itemHeight}px`,
          boxSizing: "border-box",
        };
      }
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
    layout() {
      this.$nextTick(() => this.ensureSortable());
    },
    columns() {
      if (this.isGrid) {
        this.$nextTick(() => this.ensureSortable());
      }
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
      // List defaults to vertical; grid leaves direction unset so Sortable
      // can detect 2D movement across cells.
      if (opts.direction === undefined) {
        if (!this.isGrid) {
          opts.direction = "vertical";
        } else {
          delete opts.direction;
        }
      }
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
      if (!el) return;
      if (this.sortable) {
        this.destroySortable();
      }
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
      const cols = this.resolvedColumns;
      const row = Math.floor(Math.max(0, index) / cols);
      const stride = this.itemHeight + this.resolvedGap;
      const top = Math.max(0, row * stride);
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

.vdv-list--grid {
  right: auto;
}

.vdv-item {
  width: 100%;
}
</style>
