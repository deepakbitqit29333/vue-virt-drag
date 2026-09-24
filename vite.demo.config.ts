import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue2";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname, "demo"),
  // Project Pages site: https://deepakbitqit29333.github.io/vue-virt-drag/
  base: process.env.DEMO_BASE ?? "/vue-virt-drag/",
  build: {
    outDir: resolve(__dirname, "demo-dist"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "vue-drag-virtualization": resolve(__dirname, "src/index.ts"),
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 43127,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 43127,
    strictPort: true,
  },
});
