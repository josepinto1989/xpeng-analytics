import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
    watch: {
      ignored: ["**/public/processor/**"],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
  build: {
    target: "es2022",
  },
});
