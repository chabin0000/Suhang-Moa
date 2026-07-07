import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Suhang-Moa/",
  build: {
    rollupOptions: {
      input: "src/main.tsx",
      output: {
        assetFileNames: "assets/[name][extname]",
        chunkFileNames: "assets/[name].js",
        entryFileNames: "assets/app.js",
      },
    },
  },
  plugins: [react()],
});
