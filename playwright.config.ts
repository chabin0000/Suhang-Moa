import { defineConfig, devices } from "@playwright/test";

const firebaseEnv = {
  VITE_FIREBASE_API_KEY: "emulator-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "localhost",
  VITE_FIREBASE_PROJECT_ID: "classmap-e2e",
  VITE_FIREBASE_STORAGE_BUCKET: "classmap-e2e.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  VITE_FIREBASE_APP_ID: "1:123456789:web:e2e",
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: "emulator-site-key",
  VITE_USE_FIREBASE_EMULATORS: "true",
  VITE_APPCHECK_DEBUG: "false",
};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4174/",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "pnpm vite --mode e2e --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174/",
    reuseExistingServer: false,
    env: firebaseEnv,
  },
});
