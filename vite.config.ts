import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { assertFirebaseEnvForCiProduction } from "./src/firebase/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  assertFirebaseEnvForCiProduction(env, mode, process.env.CI);

  return {
    base: "/Suhang-Moa/",
    build: {
      rollupOptions: {
        input: "src/main.tsx",
        output: {
          assetFileNames: "assets/[name][extname]",
          chunkFileNames: "assets/[name].js",
          entryFileNames: "assets/app.js",
          manualChunks(id) {
            if (!id.includes("/node_modules/@firebase/")) {
              return undefined;
            }

            const packageName = id.split("/node_modules/@firebase/")[1]?.split("/")[0];
            return packageName ? `firebase-${packageName}` : undefined;
          },
        },
      },
    },
    plugins: [react()],
  };
});
