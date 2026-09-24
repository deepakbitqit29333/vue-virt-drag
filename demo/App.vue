<template>
  <div class="page">
    <header class="hero">
      <p class="eyebrow">Vue 2 · SortableJS · windowed list &amp; grid</p>
      <h1>vue-drag-virtualization</h1>
      <p class="lede">
        Near drop-in for <code>vuedraggable</code> with virtual rendering — only
        visible rows/cells stay mounted. Switch layouts below; drag to reorder
        a 5,000-item collection.
      </p>
    </header>

    <div class="tabs" role="tablist">
      <button
        type="button"
        class="tab"
        :class="{ active: mode === 'list' }"
        role="tab"
        :aria-selected="mode === 'list'"
        @click="mode = 'list'"
      >
        List
      </button>
      <button
        type="button"
        class="tab"
        :class="{ active: mode === 'grid' }"
        role="tab"
        :aria-selected="mode === 'grid'"
        @click="mode = 'grid'"
      >
        Grid
      </button>
    </div>

    <section class="panel">
      <div class="meta">
        <div>
          <strong>{{ list.length.toLocaleString() }}</strong> items ·
          {{ mode }} · mounted ~{{ mountedHint }}
        </div>
        <div class="meta-actions">
          <label class="check">
            <input v-model="disabled" type="checkbox" />
            disabled
          </label>
          <button type="button" class="btn" @click="shuffle">Shuffle</button>
          <button type="button" class="btn" @click="scrollMid">
            Jump mid
          </button>
          <button type="button" class="btn" @click="reset">Reset</button>
        </div>
      </div>

      <div v-if="lastEvent" class="event-log">
        Last: <code>{{ lastEvent }}</code>
      </div>

      <draggable
        v-if="mode === 'list'"
        ref="listRef"
        v-model="list"
        layout="list"
        :item-key="'id'"
        :item-height="ITEM_HEIGHT"
        :height="VIEWPORT_HEIGHT"
        :overscan="6"
        handle=".handle"
        :disabled="disabled"
        :force-fallback="true"
        ghost-class="demo-ghost"
        chosen-class="demo-chosen"
        :animation="150"
        :move="onMove"
        @start="onStart"
        @end="onEnd"
      >
        <template #item="{ element, index }">
          <div class="row" :class="{ muted: element.locked }">
            <button
              type="button"
              class="handle"
              :disabled="disabled || element.locked"
              aria-label="Drag"
            >
              ⋮⋮
            </button>
            <span class="idx">#{{ index }}</span>
            <span class="name">{{ element.name }}</span>
            <span class="tag" :style="{ background: element.color }" />
          </div>
        </template>
        <template #footer>
          <p class="footer-note">
            Footer slot · last drag {{ lastDrag || "—" }}
          </p>
        </template>
      </draggable>

      <draggable
        v-else
        ref="listRef"
        v-model="list"
        layout="grid"
        :columns="GRID_COLUMNS"
        :item-key="'id'"
        :item-height="CELL"
        :item-width="CELL"
        :gap="GAP"
        :height="VIEWPORT_HEIGHT"
        :overscan="3"
        handle=".handle"
        :disabled="disabled"
        :force-fallback="true"
        ghost-class="demo-ghost"
        chosen-class="demo-chosen"
        :animation="150"
        :move="onMove"
        viewport-class="grid-viewport"
        @start="onStart"
        @end="onEnd"
      >
        <template #item="{ element, index }">
          <div class="cell" :class="{ muted: element.locked }">
            <button
              type="button"
              class="handle"
              :disabled="disabled || element.locked"
              aria-label="Drag"
            >
              ⋮⋮
            </button>
            <span class="cell-idx">#{{ index }}</span>
            <span class="cell-name">{{ element.name }}</span>
            <span class="cell-swatch" :style="{ background: element.color }" />
          </div>
        </template>
        <template #footer>
          <p class="footer-note">
            Grid · {{ GRID_COLUMNS }} cols · last drag {{ lastDrag || "—" }}
          </p>
        </template>
      </draggable>
    </section>

    <section class="migration">
      <h2>Grid usage</h2>
      <pre class="code">{{ gridSnippet }}</pre>
    </section>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import draggable from "vue-drag-virtualization";
import type { MoveEventContext } from "vue-drag-virtualization";

const ITEM_HEIGHT = 52;
const VIEWPORT_HEIGHT = 480;
const COUNT = 5000;
const GRID_COLUMNS = 4;
const CELL = 148;
const GAP = 10;

interface Row {
  id: number;
  name: string;
  color: string;
  locked?: boolean;
}

function makeList(n: number): Row[] {
  const hues = [200, 24, 160, 280, 40, 340];
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Task ${i + 1}`,
    color: `hsl(${hues[i % hues.length]} 55% 42%)`,
    locked: i % 97 === 0,
  }));
}

export default Vue.extend({
  name: "App",
  components: { draggable },
  data() {
    return {
      ITEM_HEIGHT,
      VIEWPORT_HEIGHT,
      GRID_COLUMNS,
      CELL,
      GAP,
      mode: "grid" as "list" | "grid",
      list: makeList(COUNT) as Row[],
      disabled: false,
      lastEvent: "" as string,
      lastDrag: "" as string,
      gridSnippet: `<draggable
  v-model="list"
  layout="grid"
  :columns="4"
  item-key="id"
  :item-height="148"
  :item-width="148"
  :gap="10"
  :height="480"
  handle=".handle"
  @end="onEnd"
>
  <template #item="{ element, index }">
    <div class="cell">…</div>
  </template>
</draggable>`,
    };
  },
  computed: {
    mountedHint(): string {
      if (this.mode === "grid") {
        const stride = CELL + GAP;
        const visibleRows = Math.ceil(VIEWPORT_HEIGHT / stride) + 1 + 6;
        return `${visibleRows * GRID_COLUMNS} cells`;
      }
      const visible = Math.ceil(VIEWPORT_HEIGHT / ITEM_HEIGHT) + 1 + 12;
      return `${visible} rows`;
    },
  },
  methods: {
    onMove(ctx: MoveEventContext<Row>) {
      const dragged = ctx.draggedContext.element;
      const related = ctx.relatedContext.element;
      if (dragged?.locked) return false;
      if (related?.locked) return false;
      return true;
    },
    onStart(evt: { oldIndex: number }) {
      this.lastEvent = `start oldIndex=${evt.oldIndex}`;
    },
    onEnd(evt: { oldIndex: number; newIndex: number }) {
      this.lastEvent = `end ${evt.oldIndex} → ${evt.newIndex}`;
      this.lastDrag = `${evt.oldIndex} → ${evt.newIndex}`;
    },
    shuffle() {
      const next = this.list.slice();
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      this.list = next;
    },
    reset() {
      this.list = makeList(COUNT);
      this.lastEvent = "";
      this.lastDrag = "";
    },
    scrollMid() {
      const ref = this.$refs.listRef as { scrollToIndex?: (i: number) => void };
      ref?.scrollToIndex?.(Math.floor(this.list.length / 2));
    },
  },
});
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&family=IBM+Plex+Mono:wght@400;500&display=swap");

:root {
  --ink: #14201b;
  --muted: #5a6b63;
  --paper: #f3f6f1;
  --panel: #ffffff;
  --line: #d5ddd6;
  --accent: #0f6b4c;
  --accent-soft: #d8eee4;
  --danger: #9b2c2c;
  --shadow: 0 18px 40px rgba(20, 32, 27, 0.08);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "DM Sans", system-ui, sans-serif;
  color: var(--ink);
  background:
    radial-gradient(1200px 500px at 10% -10%, #cfe8dc 0%, transparent 55%),
    radial-gradient(900px 420px at 100% 0%, #e7efd8 0%, transparent 50%),
    linear-gradient(180deg, #eef3ec 0%, var(--paper) 40%, #e8eee6 100%);
  min-height: 100vh;
}

.page {
  max-width: 760px;
  margin: 0 auto;
  padding: 48px 20px 80px;
}

.hero h1 {
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  letter-spacing: -0.03em;
  margin: 0 0 12px;
  line-height: 1.1;
}

.eyebrow {
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}

.lede {
  margin: 0;
  color: var(--muted);
  font-size: 1.05rem;
  line-height: 1.5;
  max-width: 42rem;
}

.lede code,
.event-log code,
.migration code {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 0.9em;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-top: 28px;
}

.tab {
  appearance: none;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--muted);
  border-radius: 4px 4px 0 0;
  padding: 8px 16px;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.tab.active {
  background: var(--panel);
  color: var(--accent);
  border-bottom-color: var(--panel);
}

.panel {
  margin-top: 0;
  background: var(--panel);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  border-radius: 0 4px 4px 4px;
  overflow: hidden;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, #fbfcfb, #f4f7f4);
  font-size: 0.92rem;
}

.meta-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.check {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--muted);
  font-size: 0.88rem;
}

.btn {
  appearance: none;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  border-radius: 4px;
  padding: 6px 10px;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.event-log {
  padding: 8px 16px;
  font-size: 0.82rem;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
  background: var(--accent-soft);
}

.grid-viewport {
  padding: 12px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
  background: #fff;
}

.row.muted {
  background: #f7f2f2;
  color: var(--danger);
}

.cell {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  position: relative;
}

.cell.muted {
  background: #f7f2f2;
  color: var(--danger);
}

.handle {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: grab;
  font-size: 0.95rem;
  letter-spacing: -0.15em;
  padding: 4px 2px;
  line-height: 1;
  align-self: flex-start;
}

.handle:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.handle:active {
  cursor: grabbing;
}

.idx {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 0.78rem;
  color: var(--muted);
  min-width: 4.5rem;
}

.name {
  flex: 1;
  font-weight: 600;
}

.tag {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.cell-idx {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 0.72rem;
  color: var(--muted);
}

.cell-name {
  font-weight: 700;
  font-size: 0.92rem;
}

.cell-swatch {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 14px;
  height: 14px;
  border-radius: 3px;
}

.demo-ghost {
  opacity: 0.45;
  background: var(--accent-soft) !important;
}

.demo-chosen .handle {
  color: var(--accent);
}

.footer-note {
  margin: 0;
  padding: 12px 16px;
  font-size: 0.85rem;
  color: var(--muted);
  border-top: 1px solid var(--line);
  background: #fafcfb;
}

.migration {
  margin-top: 36px;
}

.migration h2 {
  font-size: 1.1rem;
  margin: 0 0 10px;
}

.code {
  margin: 0;
  padding: 16px;
  overflow: auto;
  background: #13201a;
  color: #d7ebe1;
  border-radius: 4px;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 0.78rem;
  line-height: 1.55;
}

@media (max-width: 600px) {
  .page {
    padding: 28px 14px 60px;
  }

  .meta {
    align-items: flex-start;
  }
}
</style>
