import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FIREBASE_PUBLIC_ENV_KEYS,
  FirebaseClientError,
  assertFirebaseEnvForCiProduction,
  readFirebaseConfig,
} from "./config";

const firebaseSdk = vi.hoisted(() => {
  const callOrder: string[] = [];
  const app = {
    name: "test-app",
    options: {},
    automaticDataCollectionEnabled: false,
  };
  const namedApp = {
    name: "named-app",
    options: {},
    automaticDataCollectionEnabled: false,
  };
  const auth = {
    name: "test-auth",
    currentUser: null as { uid: string; isAnonymous: boolean } | null,
    authStateReady: vi.fn(),
  };
  const firestore = { name: "test-firestore" };
  const appCheck = { name: "test-app-check" };
  const localPersistence = { type: "LOCAL" };
  const googleProvider = { providerId: "google.com" };
  const apps = new Map<
    string,
    {
      app: typeof app;
      options: Record<string, unknown>;
    }
  >();

  return {
    callOrder,
    app,
    namedApp,
    auth,
    firestore,
    appCheck,
    localPersistence,
    googleProvider,
    apps,
    debugTokenAtInitialization: undefined as boolean | string | undefined,
    initializeApp: vi.fn(),
    getApps: vi.fn(),
    getApp: vi.fn(),
    getAuth: vi.fn(),
    connectAuthEmulator: vi.fn(),
    setPersistence: vi.fn(),
    signInAnonymously: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    GoogleAuthProvider: vi.fn(),
    getFirestore: vi.fn(),
    connectFirestoreEmulator: vi.fn(),
    initializeAppCheck: vi.fn(),
    ReCaptchaEnterpriseProvider: vi.fn(),
  };
});

vi.mock("firebase/app", () => ({
  getApp: firebaseSdk.getApp,
  getApps: firebaseSdk.getApps,
  initializeApp: firebaseSdk.initializeApp,
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: firebaseSdk.localPersistence,
  connectAuthEmulator: firebaseSdk.connectAuthEmulator,
  getAuth: firebaseSdk.getAuth,
  GoogleAuthProvider: firebaseSdk.GoogleAuthProvider,
  onAuthStateChanged: firebaseSdk.onAuthStateChanged,
  setPersistence: firebaseSdk.setPersistence,
  signInAnonymously: firebaseSdk.signInAnonymously,
  signInWithPopup: firebaseSdk.signInWithPopup,
  signOut: firebaseSdk.signOut,
}));

vi.mock("firebase/firestore", () => ({
  connectFirestoreEmulator: firebaseSdk.connectFirestoreEmulator,
  getFirestore: firebaseSdk.getFirestore,
}));

vi.mock("firebase/app-check", () => ({
  initializeAppCheck: firebaseSdk.initializeAppCheck,
  ReCaptchaEnterpriseProvider: firebaseSdk.ReCaptchaEnterpriseProvider,
}));

const COMPLETE_ENV = {
  VITE_FIREBASE_API_KEY: "public-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "suhang-moa.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "suhang-moa",
  VITE_FIREBASE_STORAGE_BUCKET: "suhang-moa.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  VITE_FIREBASE_APP_ID: "1:1234567890:web:abcdef",
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: "public-site-key",
  VITE_USE_FIREBASE_EMULATORS: "false",
  VITE_APPCHECK_DEBUG: "false",
} satisfies Record<string, string>;

const EXPECTED_FIREBASE_OPTIONS = {
  apiKey: "public-api-key",
  authDomain: "suhang-moa.firebaseapp.com",
  projectId: "suhang-moa",
  storageBucket: "suhang-moa.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};

const FIREBASE_CLIENT_STATE_KEYS = [
  Symbol.for("suhang-moa.firebase.client-state.v1"),
  Symbol.for("suhang-moa.firebase.client-state.v2"),
];

function makeEnv(
  overrides: Record<string, string | boolean | undefined> = {},
): ImportMetaEnv {
  return {
    BASE_URL: "/",
    MODE: "test",
    DEV: true,
    PROD: false,
    SSR: false,
    ...COMPLETE_ENV,
    ...overrides,
  } as ImportMetaEnv;
}

function stubRuntimeEnv(
  overrides: Record<string, string | boolean | undefined> = {},
): void {
  const env = {
    ...COMPLETE_ENV,
    MODE: "development",
    ...overrides,
  };

  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
}

function getDebugToken(): boolean | string | undefined {
  return (
    globalThis as typeof globalThis & {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
    }
  ).FIREBASE_APPCHECK_DEBUG_TOKEN;
}

function clearDebugToken(): void {
  delete (
    globalThis as typeof globalThis & {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
    }
  ).FIREBASE_APPCHECK_DEBUG_TOKEN;
}

function clearFirebaseClientState(): void {
  const stateHost = globalThis as typeof globalThis & Record<symbol, unknown>;
  for (const key of FIREBASE_CLIENT_STATE_KEYS) {
    delete stateHost[key];
  }
}

function seedMockFirebaseApp(
  name: string,
  app: typeof firebaseSdk.app,
  options: Record<string, unknown>,
): void {
  firebaseSdk.apps.set(name, { app, options });
}

function captureThrown(command: () => unknown): unknown {
  try {
    command();
  } catch (error) {
    return error;
  }
  throw new Error("expected command to throw");
}

async function captureRejection(
  command: () => Promise<unknown>,
): Promise<unknown> {
  try {
    await command();
  } catch (error) {
    return error;
  }
  throw new Error("expected command to reject");
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  clearDebugToken();
  clearFirebaseClientState();
  firebaseSdk.callOrder.length = 0;
  firebaseSdk.debugTokenAtInitialization = undefined;
  firebaseSdk.apps.clear();

  firebaseSdk.initializeApp
    .mockReset()
    .mockImplementation((options, name = "[DEFAULT]") => {
      firebaseSdk.callOrder.push("initializeApp");
      const existing = firebaseSdk.apps.get(name);

      if (existing) {
        if (JSON.stringify(existing.options) === JSON.stringify(options)) {
          return existing.app;
        }
        throw new Error(
          `Firebase duplicate-app: ${JSON.stringify({
            existing: existing.options,
            requested: options,
          })}`,
        );
      }

      const app = name === "[DEFAULT]" ? firebaseSdk.app : firebaseSdk.namedApp;
      firebaseSdk.apps.set(name, { app, options });
      return app;
    });
  firebaseSdk.getApps
    .mockReset()
    .mockImplementation(() =>
      Array.from(firebaseSdk.apps.values(), ({ app }) => app),
    );
  firebaseSdk.getApp
    .mockReset()
    .mockImplementation((name = "[DEFAULT]") => {
      const existing = firebaseSdk.apps.get(name);
      if (!existing) {
        throw new Error(`Firebase: no app named ${name}`);
      }
      return existing.app;
    });
  firebaseSdk.getAuth.mockReset().mockImplementation(() => {
    firebaseSdk.callOrder.push("getAuth");
    return firebaseSdk.auth;
  });
  firebaseSdk.auth.currentUser = null;
  firebaseSdk.auth.authStateReady.mockReset().mockResolvedValue(undefined);
  firebaseSdk.connectAuthEmulator.mockReset();
  firebaseSdk.setPersistence.mockReset().mockResolvedValue(undefined);
  firebaseSdk.signInAnonymously.mockReset();
  firebaseSdk.signInWithPopup.mockReset();
  firebaseSdk.signOut.mockReset().mockResolvedValue(undefined);
  firebaseSdk.onAuthStateChanged.mockReset();
  firebaseSdk.GoogleAuthProvider.mockReset().mockImplementation(function () {
    return firebaseSdk.googleProvider;
  });
  firebaseSdk.getFirestore.mockReset().mockImplementation(() => {
    firebaseSdk.callOrder.push("getFirestore");
    return firebaseSdk.firestore;
  });
  firebaseSdk.connectFirestoreEmulator.mockReset();
  firebaseSdk.ReCaptchaEnterpriseProvider.mockReset().mockImplementation(
    function ReCaptchaEnterpriseProvider(this: { siteKey: string }, siteKey) {
      firebaseSdk.callOrder.push("createAppCheckProvider");
      this.siteKey = siteKey;
    },
  );
  firebaseSdk.initializeAppCheck.mockReset().mockImplementation(() => {
    firebaseSdk.callOrder.push("initializeAppCheck");
    firebaseSdk.debugTokenAtInitialization = getDebugToken();
    return firebaseSdk.appCheck;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  clearDebugToken();
  clearFirebaseClientState();
});

describe("Firebase public configuration", () => {
  it("parses a complete public Firebase configuration", () => {
    expect(readFirebaseConfig(makeEnv(), "development")).toEqual({
      enabled: true,
      value: {
        apiKey: "public-api-key",
        authDomain: "suhang-moa.firebaseapp.com",
        projectId: "suhang-moa",
        storageBucket: "suhang-moa.firebasestorage.app",
        messagingSenderId: "1234567890",
        appId: "1:1234567890:web:abcdef",
        recaptchaEnterpriseSiteKey: "public-site-key",
        useEmulators: false,
        appCheckDebug: false,
      },
    });
  });

  it("uses safe false defaults when optional control flags are absent", () => {
    expect(
      readFirebaseConfig(
        makeEnv({
          VITE_USE_FIREBASE_EMULATORS: undefined,
          VITE_APPCHECK_DEBUG: undefined,
        }),
        "development",
      ),
    ).toMatchObject({
      enabled: true,
      value: {
        useEmulators: false,
        appCheckDebug: false,
      },
    });
  });

  it("returns a disabled backend when a local variable is missing", () => {
    expect(
      readFirebaseConfig(
        makeEnv({ VITE_FIREBASE_PROJECT_ID: undefined }),
        "development",
      ),
    ).toEqual({ enabled: false });
  });

  it("rejects App Check debug mode in production with a UI-safe error", () => {
    const read = () =>
      readFirebaseConfig(
        makeEnv({
          VITE_FIREBASE_API_KEY: "must-not-leak-api-key",
          VITE_APPCHECK_DEBUG: "true",
        }),
        "production",
      );

    const error = captureThrown(read);

    expect(error).toBeInstanceOf(FirebaseClientError);
    expect(error).toMatchObject({
      code: "APPCHECK_DEBUG_FORBIDDEN",
      message: "운영 환경에서는 App Check 디버그 모드를 사용할 수 없습니다.",
    });
    expect(String(error)).not.toContain("must-not-leak-api-key");
    expect(String(error)).not.toContain("VITE_FIREBASE");
    expect(String(error)).not.toContain("{");
  });

  it("rejects production debug mode before validating the remaining config", () => {
    const read = () =>
      readFirebaseConfig(
        makeEnv({
          VITE_FIREBASE_PROJECT_ID: undefined,
          VITE_APPCHECK_DEBUG: "true",
        }),
        "production",
      );

    const error = captureThrown(read);

    expect(error).toBeInstanceOf(FirebaseClientError);
    expect(error).toMatchObject({
      code: "APPCHECK_DEBUG_FORBIDDEN",
      message: "운영 환경에서는 App Check 디버그 모드를 사용할 수 없습니다.",
    });
  });

  it("does not expose a debug-token environment key", () => {
    expect(FIREBASE_PUBLIC_ENV_KEYS).toEqual([
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_STORAGE_BUCKET",
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
      "VITE_FIREBASE_APP_ID",
      "VITE_RECAPTCHA_ENTERPRISE_SITE_KEY",
    ]);
    expect(FIREBASE_PUBLIC_ENV_KEYS.join(",")).not.toContain("TOKEN");
  });
});

describe("CI production configuration guard", () => {
  it("skips Firebase validation outside CI production builds", () => {
    expect(() =>
      assertFirebaseEnvForCiProduction({}, "development", "true"),
    ).not.toThrow();
    expect(() =>
      assertFirebaseEnvForCiProduction({}, "production", undefined),
    ).not.toThrow();
  });

  it("reports only missing public variable names", () => {
    const env = makeEnv({
      VITE_FIREBASE_API_KEY: "",
      VITE_FIREBASE_PROJECT_ID: "   ",
    });

    const error = captureThrown(() => {
      assertFirebaseEnvForCiProduction(env, "production", "true");
    });

    expect((error as Error).message).toBe(
      "VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID",
    );
    expect(String(error)).not.toContain("public-site-key");
    expect(String(error)).not.toContain("suhang-moa");
  });
});

describe("lazy Firebase initialization policy", () => {
  it("does not initialize Firebase while importing the boundary", async () => {
    stubRuntimeEnv();

    await import("./app");

    expect(firebaseSdk.initializeApp).not.toHaveBeenCalled();
    expect(firebaseSdk.getAuth).not.toHaveBeenCalled();
    expect(firebaseSdk.getFirestore).not.toHaveBeenCalled();
    expect(firebaseSdk.initializeAppCheck).not.toHaveBeenCalled();
  });

  it("returns null without initializing Firebase when config is absent", async () => {
    stubRuntimeEnv({ VITE_FIREBASE_PROJECT_ID: undefined });
    const { getFirebaseApp, getFirebaseAuth, getFirestoreDb } =
      await import("./app");

    expect(getFirebaseApp()).toBeNull();
    expect(getFirebaseAuth()).toBeNull();
    expect(getFirestoreDb()).toBeNull();
    expect(firebaseSdk.initializeApp).not.toHaveBeenCalled();
  });

  it("initializes App Check before Firestore in production", async () => {
    stubRuntimeEnv({ MODE: "production" });
    const { getFirestoreDb } = await import("./app");

    expect(getFirestoreDb()).toBe(firebaseSdk.firestore);
    expect(firebaseSdk.callOrder).toEqual([
      "initializeApp",
      "createAppCheckProvider",
      "initializeAppCheck",
      "getFirestore",
    ]);
    expect(firebaseSdk.ReCaptchaEnterpriseProvider).toHaveBeenCalledWith(
      "public-site-key",
    );
  });

  it("rejects production debug mode before Firebase initialization", async () => {
    stubRuntimeEnv({
      MODE: "production",
      VITE_APPCHECK_DEBUG: "true",
    });
    const { getFirebaseApp } = await import("./app");

    const error = captureThrown(getFirebaseApp);

    expect(error).toMatchObject({
      code: "APPCHECK_DEBUG_FORBIDDEN",
      message: "운영 환경에서는 App Check 디버그 모드를 사용할 수 없습니다.",
    });
    expect(firebaseSdk.initializeApp).not.toHaveBeenCalled();
    expect(firebaseSdk.initializeAppCheck).not.toHaveBeenCalled();
  });

  it("connects each emulator at most once and never initializes App Check", async () => {
    stubRuntimeEnv({
      VITE_USE_FIREBASE_EMULATORS: "true",
      VITE_APPCHECK_DEBUG: "true",
    });
    const { getFirebaseAuth, getFirestoreDb } = await import("./app");

    expect(getFirebaseAuth()).toBe(firebaseSdk.auth);
    expect(getFirebaseAuth()).toBe(firebaseSdk.auth);
    expect(getFirestoreDb()).toBe(firebaseSdk.firestore);
    expect(getFirestoreDb()).toBe(firebaseSdk.firestore);

    expect(firebaseSdk.connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(firebaseSdk.connectAuthEmulator).toHaveBeenCalledWith(
      firebaseSdk.auth,
      "http://127.0.0.1:9099",
      { disableWarnings: true },
    );
    expect(firebaseSdk.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(firebaseSdk.connectFirestoreEmulator).toHaveBeenCalledWith(
      firebaseSdk.firestore,
      "127.0.0.1",
      8080,
    );
    expect(firebaseSdk.initializeAppCheck).not.toHaveBeenCalled();
    expect(firebaseSdk.ReCaptchaEnterpriseProvider).not.toHaveBeenCalled();
    expect(getDebugToken()).toBeUndefined();
  });

  it("reuses the same runtime identity across module re-evaluation", async () => {
    stubRuntimeEnv({ VITE_USE_FIREBASE_EMULATORS: "true" });
    const firstBoundary = await import("./app");

    expect(firstBoundary.getFirebaseAuth()).toBe(firebaseSdk.auth);
    expect(firstBoundary.getFirestoreDb()).toBe(firebaseSdk.firestore);

    vi.resetModules();
    const reloadedBoundary = await import("./app");

    expect(reloadedBoundary.getFirebaseAuth()).toBe(firebaseSdk.auth);
    expect(reloadedBoundary.getFirestoreDb()).toBe(firebaseSdk.firestore);
    expect(firebaseSdk.initializeApp).toHaveBeenCalledTimes(1);
    expect(firebaseSdk.connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(firebaseSdk.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
  });

  it("rejects a changed Firebase project after module re-evaluation", async () => {
    stubRuntimeEnv({
      VITE_FIREBASE_PROJECT_ID: "must-not-leak-project-a",
    });
    const firstBoundary = await import("./app");

    expect(firstBoundary.getFirebaseApp()).toBe(firebaseSdk.app);

    vi.resetModules();
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "must-not-leak-project-b");
    const reloadedBoundary = await import("./app");
    const error = captureThrown(reloadedBoundary.getFirebaseApp);

    expect(error).toMatchObject({
      code: "FIREBASE_CONFIG_MISMATCH",
      message:
        "Firebase 설정 충돌이 감지되었습니다. 페이지를 새로고침해 주세요.",
    });
    expect(String(error)).not.toContain("must-not-leak-project-a");
    expect(String(error)).not.toContain("must-not-leak-project-b");
    expect(firebaseSdk.initializeApp).toHaveBeenCalledTimes(1);
  });

  it("returns null for disabled current config despite a cached runtime", async () => {
    stubRuntimeEnv({ VITE_USE_FIREBASE_EMULATORS: "true" });
    const firstBoundary = await import("./app");

    expect(firstBoundary.getFirebaseApp()).toBe(firebaseSdk.app);
    expect(firstBoundary.getFirebaseAuth()).toBe(firebaseSdk.auth);
    expect(firstBoundary.getFirestoreDb()).toBe(firebaseSdk.firestore);

    vi.resetModules();
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", undefined);
    const reloadedBoundary = await import("./app");

    expect(reloadedBoundary.getFirebaseApp()).toBeNull();
    expect(reloadedBoundary.getFirebaseAuth()).toBeNull();
    expect(reloadedBoundary.getFirestoreDb()).toBeNull();
    expect(firebaseSdk.initializeApp).toHaveBeenCalledTimes(1);
    expect(firebaseSdk.connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(firebaseSdk.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
  });

  it("validates production debug mode before using a cached runtime", async () => {
    stubRuntimeEnv();
    const firstBoundary = await import("./app");

    expect(firstBoundary.getFirebaseApp()).toBe(firebaseSdk.app);

    vi.resetModules();
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_APPCHECK_DEBUG", "true");
    const reloadedBoundary = await import("./app");
    const error = captureThrown(reloadedBoundary.getFirebaseApp);

    expect(error).toMatchObject({
      code: "APPCHECK_DEBUG_FORBIDDEN",
      message: "운영 환경에서는 App Check 디버그 모드를 사용할 수 없습니다.",
    });
    expect(firebaseSdk.initializeApp).toHaveBeenCalledTimes(1);
  });

  it("keeps App Check idempotent across module re-evaluation", async () => {
    const config = readFirebaseConfig(makeEnv(), "production");
    const firstBoundary = await import("./appCheck");

    if (!config.enabled) {
      throw new Error("expected enabled Firebase config");
    }

    expect(
      firstBoundary.initializeWebAppCheck(firebaseSdk.app, config.value),
    ).toBe(firebaseSdk.appCheck);

    vi.resetModules();
    const reloadedBoundary = await import("./appCheck");

    expect(
      reloadedBoundary.initializeWebAppCheck(firebaseSdk.app, config.value),
    ).toBe(firebaseSdk.appCheck);
    expect(firebaseSdk.initializeAppCheck).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: "site key",
      overrides: {
        VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: "must-not-leak-site-key-b",
      },
    },
    {
      label: "debug flag",
      overrides: { VITE_APPCHECK_DEBUG: "true" },
    },
    {
      label: "emulator flag",
      overrides: { VITE_USE_FIREBASE_EMULATORS: "true" },
    },
  ])(
    "rejects a changed App Check $label after module re-evaluation",
    async ({ overrides }) => {
      const initialConfig = readFirebaseConfig(makeEnv(), "development");
      const firstBoundary = await import("./appCheck");

      if (!initialConfig.enabled) {
        throw new Error("expected enabled Firebase config");
      }
      expect(
        firstBoundary.initializeWebAppCheck(
          firebaseSdk.app,
          initialConfig.value,
        ),
      ).toBe(firebaseSdk.appCheck);

      vi.resetModules();
      const changedConfig = readFirebaseConfig(
        makeEnv(overrides),
        "development",
      );
      const reloadedBoundary = await import("./appCheck");

      if (!changedConfig.enabled) {
        throw new Error("expected changed Firebase config");
      }
      const error = captureThrown(() => {
        reloadedBoundary.initializeWebAppCheck(
          firebaseSdk.app,
          changedConfig.value,
        );
      });

      expect(error).toMatchObject({
        code: "APPCHECK_CONFIG_MISMATCH",
        message:
          "App Check 설정 충돌이 감지되었습니다. 페이지를 새로고침해 주세요.",
      });
      expect(String(error)).not.toContain("public-site-key");
      expect(String(error)).not.toContain("must-not-leak-site-key-b");
      expect(firebaseSdk.initializeAppCheck).toHaveBeenCalledTimes(1);
    },
  );

  it("retrieves an identical existing default app through initializeApp", async () => {
    stubRuntimeEnv();
    seedMockFirebaseApp(
      "[DEFAULT]",
      firebaseSdk.app,
      EXPECTED_FIREBASE_OPTIONS,
    );
    const { getFirebaseApp } = await import("./app");

    expect(getFirebaseApp()).toBe(firebaseSdk.app);
    expect(getFirebaseApp()).toBe(firebaseSdk.app);
    expect(firebaseSdk.initializeApp).toHaveBeenCalledTimes(1);
    expect(firebaseSdk.initializeApp).toHaveBeenCalledWith(
      EXPECTED_FIREBASE_OPTIONS,
    );
    expect(firebaseSdk.getApps).not.toHaveBeenCalled();
    expect(firebaseSdk.getApp).not.toHaveBeenCalled();
  });

  it("maps a mismatched default app to a UI-safe error", async () => {
    stubRuntimeEnv();
    seedMockFirebaseApp("[DEFAULT]", firebaseSdk.app, {
      ...EXPECTED_FIREBASE_OPTIONS,
      projectId: "must-not-leak-other-project",
    });
    const { getFirebaseApp } = await import("./app");

    const error = captureThrown(getFirebaseApp);

    expect(error).toMatchObject({
      code: "FIREBASE_INITIALIZATION_FAILED",
      message: "공유 일정 기능을 초기화하지 못했습니다.",
    });
    expect(String(error)).not.toContain("public-api-key");
    expect(String(error)).not.toContain("public-site-key");
    expect(String(error)).not.toContain("VITE_FIREBASE");
    expect(String(error)).not.toContain("must-not-leak-other-project");
    expect(firebaseSdk.initializeApp).toHaveBeenCalledTimes(1);
  });

  it("initializes a default app when only named apps exist", async () => {
    stubRuntimeEnv();
    seedMockFirebaseApp(
      "named-app",
      firebaseSdk.namedApp,
      EXPECTED_FIREBASE_OPTIONS,
    );
    const { getFirebaseApp } = await import("./app");

    expect(getFirebaseApp()).toBe(firebaseSdk.app);
    expect(firebaseSdk.apps.get("named-app")?.app).toBe(firebaseSdk.namedApp);
    expect(firebaseSdk.apps.get("[DEFAULT]")?.app).toBe(firebaseSdk.app);
    expect(firebaseSdk.initializeApp).toHaveBeenCalledWith(
      EXPECTED_FIREBASE_OPTIONS,
    );
    expect(firebaseSdk.getApps).not.toHaveBeenCalled();
    expect(firebaseSdk.getApp).not.toHaveBeenCalled();
  });
});

describe("App Check boundary", () => {
  it("sets local debug mode before App Check initialization", async () => {
    stubRuntimeEnv({ VITE_APPCHECK_DEBUG: "true" });
    const config = readFirebaseConfig(
      makeEnv({ VITE_APPCHECK_DEBUG: "true" }),
      "development",
    );
    const { initializeWebAppCheck } = await import("./appCheck");

    expect(config.enabled).toBe(true);
    if (!config.enabled) {
      throw new Error("expected enabled Firebase config");
    }

    expect(initializeWebAppCheck(firebaseSdk.app, config.value)).toBe(
      firebaseSdk.appCheck,
    );
    expect(firebaseSdk.debugTokenAtInitialization).toBe(true);
  });

  it("skips App Check entirely in emulator mode", async () => {
    const config = readFirebaseConfig(
      makeEnv({
        VITE_USE_FIREBASE_EMULATORS: "true",
        VITE_APPCHECK_DEBUG: "true",
      }),
      "development",
    );
    const { initializeWebAppCheck } = await import("./appCheck");

    if (!config.enabled) {
      throw new Error("expected enabled Firebase config");
    }

    expect(initializeWebAppCheck(firebaseSdk.app, config.value)).toBeNull();
    expect(firebaseSdk.ReCaptchaEnterpriseProvider).not.toHaveBeenCalled();
    expect(firebaseSdk.initializeAppCheck).not.toHaveBeenCalled();
    expect(getDebugToken()).toBeUndefined();
  });

  it("is idempotent for the same Firebase app", async () => {
    const config = readFirebaseConfig(makeEnv(), "production");
    const { initializeWebAppCheck } = await import("./appCheck");

    if (!config.enabled) {
      throw new Error("expected enabled Firebase config");
    }

    expect(initializeWebAppCheck(firebaseSdk.app, config.value)).toBe(
      firebaseSdk.appCheck,
    );
    expect(initializeWebAppCheck(firebaseSdk.app, config.value)).toBe(
      firebaseSdk.appCheck,
    );
    expect(firebaseSdk.initializeAppCheck).toHaveBeenCalledTimes(1);
  });

  it("hides raw App Check initialization failures", async () => {
    const config = readFirebaseConfig(makeEnv(), "production");
    firebaseSdk.initializeAppCheck.mockImplementation(() => {
      throw new Error(JSON.stringify(COMPLETE_ENV));
    });
    const { initializeWebAppCheck } = await import("./appCheck");

    if (!config.enabled) {
      throw new Error("expected enabled Firebase config");
    }

    const error = captureThrown(() => {
      initializeWebAppCheck(firebaseSdk.app, config.value);
    });

    expect(error).toMatchObject({
      code: "APPCHECK_INITIALIZATION_FAILED",
      message: "App Check를 초기화하지 못했습니다.",
    });
    expect(String(error)).not.toContain("public-api-key");
    expect(String(error)).not.toContain("public-site-key");
    expect(String(error)).not.toContain("VITE_FIREBASE");
    expect(firebaseSdk.initializeAppCheck).toHaveBeenCalledTimes(1);
  });
});

describe("student and administrator authentication boundaries", () => {
  const anonymousUser = {
    uid: "anonymous-student",
    isAnonymous: true,
  };
  const adminUser = {
    uid: "google-admin",
    isAnonymous: false,
  };

  it("throws a typed UI-safe error when Firebase is unavailable", async () => {
    stubRuntimeEnv({ VITE_FIREBASE_PROJECT_ID: undefined });
    const { ensureAnonymousStudent } = await import("./auth");

    await expect(ensureAnonymousStudent()).rejects.toMatchObject({
      code: "FIREBASE_UNAVAILABLE",
      message: "공유 일정 기능이 설정되지 않았습니다.",
    });
    expect(firebaseSdk.signInAnonymously).not.toHaveBeenCalled();
  });

  it("preserves an existing anonymous user with local persistence", async () => {
    stubRuntimeEnv();
    firebaseSdk.auth.currentUser = anonymousUser;
    const { ensureAnonymousStudent } = await import("./auth");

    await expect(ensureAnonymousStudent()).resolves.toBe(anonymousUser);
    expect(firebaseSdk.setPersistence).toHaveBeenCalledWith(
      firebaseSdk.auth,
      firebaseSdk.localPersistence,
    );
    expect(firebaseSdk.auth.authStateReady).toHaveBeenCalledTimes(1);
    expect(firebaseSdk.signInAnonymously).not.toHaveBeenCalled();
    expect(firebaseSdk.signOut).not.toHaveBeenCalled();
  });

  it("rejects a restored Google admin without signing it out", async () => {
    stubRuntimeEnv();
    firebaseSdk.auth.authStateReady.mockImplementation(async () => {
      firebaseSdk.auth.currentUser = adminUser;
    });
    const { ensureAnonymousStudent } = await import("./auth");

    await expect(ensureAnonymousStudent()).rejects.toMatchObject({
      code: "AUTH_ADMIN_SESSION_ACTIVE",
      message: "관리자 로그아웃 후 학생 제출을 다시 시도해 주세요.",
    });
    expect(firebaseSdk.signInAnonymously).not.toHaveBeenCalled();
    expect(firebaseSdk.signOut).not.toHaveBeenCalled();
  });

  it("creates an anonymous user only when no session exists", async () => {
    stubRuntimeEnv();
    firebaseSdk.signInAnonymously.mockResolvedValue({ user: anonymousUser });
    const { ensureAnonymousStudent } = await import("./auth");

    await expect(ensureAnonymousStudent()).resolves.toBe(anonymousUser);
    expect(firebaseSdk.signInAnonymously).toHaveBeenCalledWith(firebaseSdk.auth);
  });

  it("hides raw anonymous sign-in failures", async () => {
    stubRuntimeEnv();
    firebaseSdk.signInAnonymously.mockRejectedValue(
      new Error("Firebase raw error with public-api-key"),
    );
    const { ensureAnonymousStudent } = await import("./auth");

    const error = await captureRejection(ensureAnonymousStudent);

    expect(error).toMatchObject({
      code: "AUTH_ANONYMOUS_SIGN_IN_FAILED",
      message: "학생 인증에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });
    expect(String(error)).not.toContain("Firebase raw error");
    expect(String(error)).not.toContain("public-api-key");
    expect(firebaseSdk.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("signs an administrator in with Google and local persistence", async () => {
    stubRuntimeEnv();
    firebaseSdk.signInWithPopup.mockResolvedValue({ user: adminUser });
    const { signInAdminWithGoogle } = await import("./auth");

    await expect(signInAdminWithGoogle()).resolves.toBe(adminUser);
    expect(firebaseSdk.setPersistence).toHaveBeenCalledWith(
      firebaseSdk.auth,
      firebaseSdk.localPersistence,
    );
    expect(firebaseSdk.GoogleAuthProvider).toHaveBeenCalledTimes(1);
    expect(firebaseSdk.signInWithPopup).toHaveBeenCalledWith(
      firebaseSdk.auth,
      firebaseSdk.googleProvider,
    );
  });

  it("hides raw Google sign-in failures", async () => {
    stubRuntimeEnv();
    firebaseSdk.signInWithPopup.mockRejectedValue(
      new Error("Firebase popup raw error"),
    );
    const { signInAdminWithGoogle } = await import("./auth");

    const error = await captureRejection(signInAdminWithGoogle);

    expect(error).toMatchObject({
      code: "AUTH_ADMIN_SIGN_IN_FAILED",
      message: "관리자 로그인에 실패했습니다. 다시 시도해 주세요.",
    });
    expect(String(error)).not.toContain("popup raw error");
    expect(firebaseSdk.signInWithPopup).toHaveBeenCalledTimes(1);
  });

  it("signs out through the configured Auth instance", async () => {
    stubRuntimeEnv();
    const { signOutCurrentUser } = await import("./auth");

    await expect(signOutCurrentUser()).resolves.toBeUndefined();
    expect(firebaseSdk.signOut).toHaveBeenCalledWith(firebaseSdk.auth);
  });

  it("hides raw sign-out failures", async () => {
    stubRuntimeEnv();
    firebaseSdk.signOut.mockRejectedValue(new Error("Firebase sign-out raw"));
    const { signOutCurrentUser } = await import("./auth");

    const error = await captureRejection(signOutCurrentUser);

    expect(error).toMatchObject({
      code: "AUTH_SIGN_OUT_FAILED",
      message: "로그아웃에 실패했습니다. 다시 시도해 주세요.",
    });
    expect(String(error)).not.toContain("sign-out raw");
    expect(firebaseSdk.signOut).toHaveBeenCalledTimes(1);
  });

  it("returns the Firebase auth-state unsubscribe function", async () => {
    stubRuntimeEnv();
    const unsubscribe = vi.fn();
    const listener = vi.fn();
    firebaseSdk.onAuthStateChanged.mockReturnValue(unsubscribe);
    const { subscribeAuthState } = await import("./auth");

    expect(subscribeAuthState(listener)).toBe(unsubscribe);
    expect(firebaseSdk.onAuthStateChanged).toHaveBeenCalledWith(
      firebaseSdk.auth,
      listener,
    );
  });

  it("hides raw auth-state subscription failures", async () => {
    stubRuntimeEnv();
    firebaseSdk.onAuthStateChanged.mockImplementation(() => {
      throw new Error("Firebase subscription raw");
    });
    const { subscribeAuthState } = await import("./auth");

    const error = captureThrown(() => {
      subscribeAuthState(vi.fn());
    });

    expect(error).toMatchObject({
      code: "AUTH_SUBSCRIPTION_FAILED",
      message: "로그인 상태를 확인하지 못했습니다.",
    });
    expect(String(error)).not.toContain("subscription raw");
    expect(firebaseSdk.onAuthStateChanged).toHaveBeenCalledTimes(1);
  });
});
