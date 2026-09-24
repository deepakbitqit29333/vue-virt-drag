# vue-drag-virtualization

Vue **2.6+ / 2.7** library: **drag-and-drop + list/grid virtualization** in one component.

Near drop-in for [`vuedraggable`](https://github.com/SortableJS/Vue.Draggable) `^2.24.3` (SortableJS-based), with windowed rendering so long collections only mount visible rows/cells.

## Quick start

```bash
npm install
npm run dev
```

Demo playground: [http://127.0.0.1:43127](http://127.0.0.1:43127)

```bash
npm run build        # library → dist/
npm run build:demo   # static demo build
npm test
```

## Install (consumer)

```bash
npm install vue-drag-virtualization sortablejs
# peer: vue@^2.6.14 || ^2.7
```

```js
import draggable from "vue-drag-virtualization";
import "vue-drag-virtualization/style.css"; // optional defaults

export default {
  components: { draggable },
};
```

Or `Vue.use(VueDragVirtualization)` to register the `draggable` component globally (same name as vuedraggable).

## Minimal migration from vuedraggable

| | vuedraggable | this library |
|---|---|---|
| Import | `import draggable from 'vuedraggable'` | `import draggable from 'vue-drag-virtualization'` |
| List binding | `v-model` / `:list` | same |
| Item rendering | default slot + your `v-for` | **`#item="{ element, index }"`** (library owns the `v-for`) |
| Keys | `:key` on your children | **`item-key`** prop (string field or function) — required |
| Viewport | CSS on your container | **`:height`** (px) + **`:item-height`** (px, fixed) — required |
| Layout | your CSS | `layout="list"` (default) or `layout="grid"` + `:columns` / `:item-width` / `:gap` |
| Drag API | `handle`, `group`, `disabled`, `ghost-class`, `move`, `@start`/`@end`/`@change`, … | same props/events (Sortable options as props) |

### List (after)

```vue
<draggable
  v-model="list"
  item-key="id"
  :item-height="48"
  :height="400"
  handle=".handle"
  @end="onEnd"
>
  <template #item="{ element }">
    <div class="row">…</div>
  </template>
</draggable>
```

### Grid

```vue
<draggable
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
</draggable>
```

That is the intentional break vs plain vuedraggable: virtualization must control which nodes exist in the DOM, so the default-slot `v-for` pattern cannot be preserved.

## API (familiar surface)

**List:** `v-model` / `value` (immutable emit) or `:list` (in-place `splice`) — same rules as vuedraggable (don’t use both).

**Virtualization (required extras):** `item-key`, `item-height`, `height`; optional `overscan`, `viewport-class`.

**Grid extras:** `layout="grid"`, `columns` (default 4), `item-width` (defaults to `item-height`), `gap` (px). Windowing is row-based over a row-major flat array.

**Sortable / vuedraggable props:** `group`, `sort`, `delay`, `disabled`, `animation`, `handle`, `filter`, `ghost-class`, `chosen-class`, `drag-class`, `force-fallback`, `clone`, `move`, `tag`, `component-data`, `options`, …

**Events:** `start`, `add`, `remove`, `update`, `end`, `choose`, `unchoose`, `sort`, `filter`, `clone`, `change`, plus `input` for `v-model`. Indices on drag events are **absolute list indices** (not window-local).

**Slots:** `#item="{ element, index }"` (required), `#header`, `#footer`.

**Method:** `scrollToIndex(index)` on the component ref (grid-aware).

## How virtualization + drag interact

1. Fixed cell/row size computes a visible window (`start`/`end` + overscan). Grid windows whole rows of `columns` cells.
2. Only those items are mounted inside a tall spacer; the window translates with scroll.
3. SortableJS is bound to the mounted item nodes (same engine as vuedraggable). Grid leaves Sortable `direction` unset so 2D moves work.
4. On drop, Sortable’s DOM mutation is reverted and the **data list** is reordered; Vue re-renders the window.

## Known limitations

- **Fixed-size** rows/cells only (no variable height/width).
- Grid is **CSS grid + row-major flat list** (not masonry / nested grids).
- **Same-list reorder** is the supported path. `group` / cross-list / `clone` props are accepted for API familiarity; cross-list transfers are not fully wired yet.
- **Nested** draggables not supported.
- Default-slot `v-for` and `transition-group` as root children are not supported (use `#item`).
- Locked-item / cancel semantics go through the `move` prop, same as vuedraggable.

## License

MIT
