import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue2";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "VueDragVirtualization",
      fileName: (format) => `vue-drag-virtualization.${format}.js`,
    },
    rollupOptions: {
      external: ["vue", "sortablejs"],
      output: {
        exports: "named",
        globals: {
          vue: "Vue",
          sortablejs: "Sortable",
        },
        assetFileNames: "vue-drag-virtualization.[ext]",
      },
    },
    cssCodeSplit: false,
  },
});
