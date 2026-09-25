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
          :key="'vdv-win-' + listEpoch"
          class="vdv-list"
          :class="listClass"
          :style="listStyle"
          v-bind="tagAttrs"
        >
          <div
            v-for="entry in visibleEntries"
            :key="entry.key"
            class="vdv-item"
            :class="{ 'vdv-item--pin': entry.pinned }"
            :data-id="String(entry.key)"
            :data-index="entry.index"
            :style="entry.pinned ? pinItemStyle : itemStyle"
          >
            <slot
              name="item"
              :element="entry.element"
              :index="entry.index"
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
    fallbackClass: { type: String, default: "sortable-fallback" },
    fallbackTolerance: { type: Number, default: 0 },
    dragoverBubble: { type: Boolean, default: false },
    removeCloneOnHide: { type: Boolean, default: true },
    emptyInsertThreshold: { type: Number, default: 5 },
    scroll: { type: Boolean, default: true },
    /** Edge auto-scroll zone (px). Higher helps long virtual lists. */
    scrollSensitivity: { type: Number, default: 60 },
    /** Edge auto-scroll speed (px/tick). Higher helps 1→2000 moves. */
    scrollSpeed: { type: Number, default: 28 },
    bubbleScroll: { type: Boolean, default: true },
    /**
     * Prefer fallback drag for virtual lists so scrolling can remount
     * windowed nodes without losing the drag ghost.
     */
    forceFallback: { type: Boolean, default: true },
    fallbackOnBody: { type: Boolean, default: true },
    /** Wheel multiplier while dragging (smooth long-distance scroll). */
    dragWheelMultiplier: { type: Number, default: 1.35 },

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
      /** Bumped after each drag to remount the window without DOM desync. */
      listEpoch: 0,
      /** Absolute source index captured at drag start (stable across window shifts). */
      dragAbsIndex: -1,
      lastPointerX: 0,
      lastPointerY: 0,
      dropAbsIndex: -1,
      scrollRaf: 0 as number,
      autoScrollRaf: 0 as number,
      autoScrollDir: 0,
      boundPointerMove: null as ((e: PointerEvent | MouseEvent | TouchEvent) => void) | null,
      boundWheel: null as ((e: WheelEvent) => void) | null,
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
    rowStride(): number {
      return this.itemHeight + this.resolvedGap;
    },
    effectiveOverscan(): number {
      // Keep a wider window while dragging so remounts are less jarring.
      return this.dragging ? Math.max(this.overscan, 24) : this.overscan;
    },
    range(): ReturnType<typeof computeGridVirtualRange> {
      return computeGridVirtualRange(
        this.scrollTop,
        this.height,
        this.realList.length,
        this.itemHeight,
        this.resolvedColumns,
        this.resolvedGap,
        this.effectiveOverscan
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
    /**
     * Windowed rows plus an optional drag pin. When the source scrolls out of
     * the virtual window, keep the same keyed node mounted (pinned) so Sortable
     * never holds a detached elm — that is what triggers insertBefore NotFoundError.
     */
    visibleEntries(): Array<{
      element: ListItem;
      index: number;
      key: string | number;
      pinned: boolean;
    }> {
      const list = this.realList;
      const start = this.startIndex;
      const end = this.endIndex;
      const entries: Array<{
        element: ListItem;
        index: number;
        key: string | number;
        pinned: boolean;
      }> = [];
      for (let i = start; i < end; i++) {
        entries.push({
          element: list[i],
          index: i,
          key: resolveItemKey(list[i], i, this.itemKey),
          pinned: false,
        });
      }
      const pin = this.dragAbsIndex;
      if (
        this.dragging &&
        pin >= 0 &&
        pin < list.length &&
        (pin < start || pin >= end)
      ) {
        entries.push({
          element: list[pin],
          index: pin,
          key: resolveItemKey(list[pin], pin, this.itemKey),
          pinned: true,
        });
      }
      return entries;
    },
    pinItemStyle(): Record<string, string> {
      // Keep Sortable's dragEl in listEl without affecting grid/list flow.
      return {
        position: "absolute",
        left: "0",
        top: "0",
        width: "1px",
        height: "1px",
        overflow: "hidden",
        opacity: "0",
        pointerEvents: "none",
        margin: "0",
        padding: "0",
        border: "none",
      };
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
      // List↔grid switches must remount so Vue owns a clean tree (Sortable
      // direction/DOM assumptions differ between layouts).
      this.reconcileListDom();
    },
    columns() {
      if (this.isGrid) {
        this.$nextTick(() => this.ensureSortable());
      }
    },
    realList() {
      // Windowed DOM set changed; Sortable stays bound to listEl until reconcile.
    },
  },
  mounted() {
    this.bindComponentDataListeners();
    this.ensureSortable();
  },
  beforeDestroy() {
    this.teardownDragAssist();
    this.destroySortable();
  },
  methods: {
    onScroll(event: Event) {
      const target = event.target as HTMLElement;
      const next = target.scrollTop;
      if (!this.dragging) {
        this.scrollTop = next;
        return;
      }
      // Throttle virtual window updates while dragging to reduce remount churn.
      if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = requestAnimationFrame(() => {
        this.scrollTop = next;
        this.scrollRaf = 0;
        this.updateDropIndexFromPointer();
      });
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
    getViewport(): HTMLElement | null {
      return (this.$refs.viewport as HTMLElement | undefined) || null;
    },
    toAbsoluteIndex(localIndex: number | undefined | null): number {
      if (localIndex == null || localIndex < 0) return -1;
      return this.startIndex + localIndex;
    },
    absIndexFromItemEl(el: HTMLElement | undefined | null): number {
      if (!el) return -1;
      const raw = el.getAttribute("data-index");
      if (raw == null) return -1;
      const n = Number(raw);
      return Number.isFinite(n) ? n : -1;
    },
    domIndexOf(node: HTMLElement): number {
      const el = this.getListElement();
      if (!el) return -1;
      return Array.prototype.indexOf.call(el.children, node);
    },
    /**
     * Map pointer to absolute list index using scroll geometry.
     * Reliable after long scrolls that remount the virtual window.
     */
    indexFromPointer(clientX: number, clientY: number): number {
      const viewport = this.getViewport();
      const len = this.realList.length;
      if (!viewport || len === 0) return -1;
      const rect = viewport.getBoundingClientRect();
      const y = clientY - rect.top + viewport.scrollTop;
      const stride = this.rowStride;
      if (stride <= 0) return -1;

      if (this.isGrid) {
        const cols = this.resolvedColumns;
        const rowCount = Math.ceil(len / cols);
        let row = Math.floor(y / stride);
        if (row < 0) row = 0;
        if (row >= rowCount) row = rowCount - 1;
        const colStride = this.resolvedItemWidth + this.resolvedGap;
        let col = Math.floor((clientX - rect.left) / Math.max(1, colStride));
        if (col < 0) col = 0;
        if (col >= cols) col = cols - 1;
        const idx = row * cols + col;
        return Math.min(len - 1, Math.max(0, idx));
      }

      let idx = Math.floor(y / stride);
      if (idx < 0) idx = 0;
      if (idx >= len) idx = len - 1;
      return idx;
    },
    updateDropIndexFromPointer() {
      if (!this.dragging) return;
      const idx = this.indexFromPointer(this.lastPointerX, this.lastPointerY);
      if (idx >= 0) this.dropAbsIndex = idx;
    },
    extractClientXY(e: PointerEvent | MouseEvent | TouchEvent): { x: number; y: number } {
      if ("touches" in e && e.touches && e.touches.length) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      if ("changedTouches" in e && e.changedTouches && e.changedTouches.length) {
        return {
          x: e.changedTouches[0].clientX,
          y: e.changedTouches[0].clientY,
        };
      }
      const m = e as MouseEvent;
      return { x: m.clientX, y: m.clientY };
    },
    onDragPointerMove(e: PointerEvent | MouseEvent | TouchEvent) {
      const { x, y } = this.extractClientXY(e);
      this.lastPointerX = x;
      this.lastPointerY = y;
      this.updateDropIndexFromPointer();
      this.updateAutoScrollFromPointer(y);
    },
    onDragWheel(e: WheelEvent) {
      const viewport = this.getViewport();
      if (!viewport || !this.dragging) return;
      e.preventDefault();
      const delta = e.deltaY * this.dragWheelMultiplier;
      viewport.scrollTop += delta;
      this.scrollTop = viewport.scrollTop;
      this.updateDropIndexFromPointer();
    },
    updateAutoScrollFromPointer(clientY: number) {
      const viewport = this.getViewport();
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const sens = this.scrollSensitivity;
      let dir = 0;
      if (clientY < rect.top + sens) dir = -1;
      else if (clientY > rect.bottom - sens) dir = 1;
      this.autoScrollDir = dir;
      if (dir !== 0 && !this.autoScrollRaf) {
        this.tickAutoScroll();
      }
    },
    tickAutoScroll() {
      const viewport = this.getViewport();
      if (!viewport || !this.dragging || this.autoScrollDir === 0) {
        this.autoScrollRaf = 0;
        return;
      }
      viewport.scrollTop += this.autoScrollDir * this.scrollSpeed;
      this.scrollTop = viewport.scrollTop;
      this.updateDropIndexFromPointer();
      this.autoScrollRaf = requestAnimationFrame(() => this.tickAutoScroll());
    },
    setupDragAssist() {
      this.boundPointerMove = (e) => this.onDragPointerMove(e);
      this.boundWheel = (e) => this.onDragWheel(e);
      window.addEventListener("pointermove", this.boundPointerMove, {
        passive: true,
      });
      window.addEventListener("mousemove", this.boundPointerMove, {
        passive: true,
      });
      window.addEventListener("touchmove", this.boundPointerMove, {
        passive: true,
      });
      // Capture on window so wheel works even when the ghost covers the viewport.
      window.addEventListener("wheel", this.boundWheel, {
        passive: false,
        capture: true,
      });
    },
    teardownDragAssist() {
      if (this.boundPointerMove) {
        window.removeEventListener("pointermove", this.boundPointerMove);
        window.removeEventListener("mousemove", this.boundPointerMove);
        window.removeEventListener("touchmove", this.boundPointerMove);
        this.boundPointerMove = null;
      }
      if (this.boundWheel) {
        window.removeEventListener("wheel", this.boundWheel, true);
        this.boundWheel = null;
      }
      if (this.scrollRaf) {
        cancelAnimationFrame(this.scrollRaf);
        this.scrollRaf = 0;
      }
      this.autoScrollDir = 0;
      if (this.autoScrollRaf) {
        cancelAnimationFrame(this.autoScrollRaf);
        this.autoScrollRaf = 0;
      }
    },
    contextForMove(
      evt: SortableMoveEvent
    ): MoveEventContext {
      const dragged = evt.dragged;
      const related = evt.related;
      const fromAttr = this.absIndexFromItemEl(dragged);
      const index = fromAttr >= 0 ? fromAttr : this.dragAbsIndex;
      const relatedLocal = related ? this.domIndexOf(related) : -1;
      let futureIndex =
        this.dropAbsIndex >= 0
          ? this.dropAbsIndex
          : this.toAbsoluteIndex(relatedLocal);
      if (evt.willInsertAfter && this.dropAbsIndex < 0 && futureIndex >= 0) {
        futureIndex += 1;
      }
      if (index < futureIndex && this.dropAbsIndex < 0) {
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
      // Keep pointer-based drop target fresh during Sortable move probes.
      if (originalEvent && "clientY" in originalEvent) {
        const oe = originalEvent as MouseEvent;
        this.lastPointerX = oe.clientX;
        this.lastPointerY = oe.clientY;
        this.updateDropIndexFromPointer();
      }
      if (this.move) {
        const ctx = this.contextForMove(evt);
        if (this.move(ctx, evt) === false) return false;
      }
      // Always cancel Sortable live DOM reorder. Vue owns these nodes —
      // Sortable insertBefore against a remounted window throws NotFoundError.
      return false;
    },
    onDragStart(evt: SortableEvent) {
      this.dragging = true;
      const fromAttr = this.absIndexFromItemEl(evt.item);
      this.dragAbsIndex =
        fromAttr >= 0 ? fromAttr : this.toAbsoluteIndex(evt.oldIndex);
      this.dropAbsIndex = this.dragAbsIndex;
      if (evt.originalEvent && "clientY" in (evt.originalEvent as object)) {
        const oe = evt.originalEvent as MouseEvent;
        this.lastPointerX = oe.clientX;
        this.lastPointerY = oe.clientY;
      }
      this.setupDragAssist();
      this.emitSortableEvent("start", evt, {
        oldIndex: this.dragAbsIndex,
        newIndex: this.dragAbsIndex,
      });
    },
    onDragUpdate(evt: SortableEvent) {
      this.emitSortableEvent("update", evt);
    },
    onDragAdd(evt: SortableEvent) {
      this.emitSortableEvent("add", evt);
      this.cleanupSortableLeftovers(evt.item);
    },
    onDragRemove(evt: SortableEvent) {
      this.emitSortableEvent("remove", evt);
      this.cleanupSortableLeftovers(evt.item);
    },
    onDragEnd(evt: SortableEvent) {
      this.updateDropIndexFromPointer();
      const oldAbs = this.dragAbsIndex;
      let newAbs =
        this.dropAbsIndex >= 0
          ? this.dropAbsIndex
          : this.toAbsoluteIndex(evt.newIndex);

      if (newAbs < 0) newAbs = oldAbs;
      if (newAbs >= this.realList.length) newAbs = this.realList.length - 1;

      this.teardownDragAssist();

      const didMove =
        evt.from === evt.to &&
        oldAbs !== newAbs &&
        oldAbs >= 0 &&
        newAbs >= 0 &&
        oldAbs < this.realList.length &&
        newAbs < this.realList.length;

      // Drop + cancel share this path (Sortable always ends via onEnd).
      // Strip body clones only — never removeChild Vue list nodes (duplicate ids).
      this.cleanupSortableLeftovers(evt.item);

      if (didMove) {
        this.spliceList(oldAbs, newAbs);
      }

      this.dragging = false;
      this.dragAbsIndex = -1;
      this.dropAbsIndex = -1;

      this.emitSortableEvent("end", evt, { oldIndex: oldAbs, newIndex: newAbs });

      // Defer past Sortable's _onDrop (destroy() re-enters _onDrop). Remount under
      // Vue and clear forceFallback's ignoreNextClick so List↔Grid clicks work.
      setTimeout(() => {
        this.reconcileListDom();
        this.clearSortableClickGuard();
      }, 0);
    },
    /**
     * Destroy Sortable, remount the windowed list under Vue, rebind Sortable.
     * Clears orphan Sortable nodes and prevents insertBefore against detached refs.
     */
    reconcileListDom() {
      const viewport = this.getViewport();
      // Remounting the keyed window can transiently reset native scrollTop; keep
      // Vue's window and the viewport locked to the same offset (Jump mid / far).
      const preserved =
        viewport != null ? viewport.scrollTop : this.scrollTop;

      this.destroySortable();
      this.cleanupSortableLeftovers(null);
      this.listEpoch += 1;
      this.scrollTop = preserved;

      this.$nextTick(() => {
        const vp = this.getViewport();
        if (vp) vp.scrollTop = preserved;
        this.scrollTop = preserved;
        this.ensureSortable();
      });
    },
    /**
     * SortableJS (forceFallback) sets ignoreNextClick and capture-listens on
     * document to preventDefault/stopImmediatePropagation on the next click.
     * A synthetic click clears that flag without needing a user gesture.
     */
    clearSortableClickGuard() {
      try {
        document.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: typeof window !== "undefined" ? window : undefined,
          })
        );
      } catch (_) {
        /* SSR / non-DOM — no-op */
      }
    },
    /**
     * Strip floating Sortable clones only. Never removeChild Vue list nodes.
     */
    cleanupSortableLeftovers(item: HTMLElement | undefined | null) {
      const listEl = this.getListElement();

      if (item && item.parentNode) {
        const parent = item.parentNode as Node;
        if (listEl && parent === listEl) {
          // Vue-owned — remount via listEpoch / reconcileListDom.
        } else if (parent === document.body) {
          parent.removeChild(item);
        }
      }

      document
        .querySelectorAll("body > .sortable-fallback, body > .sortable-drag")
        .forEach((node) => {
          if (node.parentNode) node.parentNode.removeChild(node);
        });
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
      // Kept for compatibility; unused on the happy path. Never reinsert orphans.
      const parent = evt.from;
      if (!parent || !evt.item || evt.oldIndex == null) return;
      const children = Array.from(parent.children) as HTMLElement[];
      const currentLocal = children.indexOf(evt.item);
      if (currentLocal === -1) return;
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
      const viewport = this.getViewport();
      if (!viewport) return;
      const cols = this.resolvedColumns;
      const row = Math.floor(Math.max(0, index) / cols);
      const top = Math.max(0, row * this.rowStride);
      viewport.scrollTop = top;
      this.scrollTop = top;
      // Re-apply after any pending keyed remount so Jump mid/far never lands blank.
      this.$nextTick(() => {
        const vp = this.getViewport();
        if (!vp) return;
        vp.scrollTop = top;
        this.scrollTop = top;
      });
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

.vdv-item--pin {
  /* Sortable drag source kept mounted outside the virtual window */
  flex: none;
  grid-column: 1;
  grid-row: 1;
}
</style>
