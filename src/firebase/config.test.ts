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
  const auth = {
    name: "test-auth",
    currentUser: null as { uid: string; isAnonymous: boolean } | null,
    authStateReady: vi.fn(),
  };
  const firestore = { name: "test-firestore" };
  const appCheck = { name: "test-app-check" };
  const localPersistence = { type: "LOCAL" };
  const googleProvider = { providerId: "google.com" };

  return {
    callOrder,
    app,
    auth,
    firestore,
    appCheck,
    localPersistence,
    googleProvider,
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

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  clearDebugToken();
  firebaseSdk.callOrder.length = 0;
  firebaseSdk.debugTokenAtInitialization = undefined;

  firebaseSdk.initializeApp.mockReset().mockImplementation(() => {
    firebaseSdk.callOrder.push("initializeApp");
    return firebaseSdk.app;
  });
  firebaseSdk.getApps.mockReset().mockReturnValue([]);
  firebaseSdk.getApp.mockReset().mockReturnValue(firebaseSdk.app);
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

    expect(read).toThrow(FirebaseClientError);

    try {
      read();
    } catch (error) {
      expect(error).toMatchObject({
        code: "APPCHECK_DEBUG_FORBIDDEN",
        message: "운영 환경에서는 App Check 디버그 모드를 사용할 수 없습니다.",
      });
      expect(String(error)).not.toContain("must-not-leak-api-key");
      expect(String(error)).not.toContain("VITE_FIREBASE");
      expect(String(error)).not.toContain("{");
    }
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

    expect(read).toThrow(FirebaseClientError);
    expect(read).toThrow(
      "운영 환경에서는 App Check 디버그 모드를 사용할 수 없습니다.",
    );
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

    expect(() =>
      assertFirebaseEnvForCiProduction(env, "production", "true"),
    ).toThrow(
      "VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID",
    );

    try {
      assertFirebaseEnvForCiProduction(env, "production", "true");
    } catch (error) {
      expect((error as Error).message).toBe(
        "VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID",
      );
      expect(String(error)).not.toContain("public-site-key");
      expect(String(error)).not.toContain("suhang-moa");
    }
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

    expect(() => getFirebaseApp()).toThrow(
      "운영 환경에서는 App Check 디버그 모드를 사용할 수 없습니다.",
    );
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

  it("reuses an existing Firebase app and remains idempotent", async () => {
    stubRuntimeEnv();
    firebaseSdk.getApps.mockReturnValue([firebaseSdk.app]);
    const { getFirebaseApp } = await import("./app");

    expect(getFirebaseApp()).toBe(firebaseSdk.app);
    expect(getFirebaseApp()).toBe(firebaseSdk.app);
    expect(firebaseSdk.getApp).toHaveBeenCalledTimes(1);
    expect(firebaseSdk.initializeApp).not.toHaveBeenCalled();
  });

  it("replaces raw Firebase initialization errors with a UI-safe error", async () => {
    stubRuntimeEnv();
    firebaseSdk.initializeApp.mockImplementation(() => {
      throw new Error(JSON.stringify(COMPLETE_ENV));
    });
    const { getFirebaseApp } = await import("./app");

    try {
      getFirebaseApp();
      throw new Error("expected getFirebaseApp to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "FIREBASE_INITIALIZATION_FAILED",
        message: "공유 일정 기능을 초기화하지 못했습니다.",
      });
      expect(String(error)).not.toContain("public-api-key");
      expect(String(error)).not.toContain("public-site-key");
      expect(String(error)).not.toContain("VITE_FIREBASE");
    }
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

    try {
      initializeWebAppCheck(firebaseSdk.app, config.value);
      throw new Error("expected initializeWebAppCheck to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "APPCHECK_INITIALIZATION_FAILED",
        message: "App Check를 초기화하지 못했습니다.",
      });
      expect(String(error)).not.toContain("public-api-key");
      expect(String(error)).not.toContain("public-site-key");
      expect(String(error)).not.toContain("VITE_FIREBASE");
    }
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

    try {
      await ensureAnonymousStudent();
      throw new Error("expected ensureAnonymousStudent to reject");
    } catch (error) {
      expect(error).toMatchObject({
        code: "AUTH_ANONYMOUS_SIGN_IN_FAILED",
        message: "학생 인증에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      });
      expect(String(error)).not.toContain("Firebase raw error");
      expect(String(error)).not.toContain("public-api-key");
    }
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

    await expect(signInAdminWithGoogle()).rejects.toMatchObject({
      code: "AUTH_ADMIN_SIGN_IN_FAILED",
      message: "관리자 로그인에 실패했습니다. 다시 시도해 주세요.",
    });
    await signInAdminWithGoogle().catch((error: unknown) => {
      expect(String(error)).not.toContain("popup raw error");
    });
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

    await expect(signOutCurrentUser()).rejects.toMatchObject({
      code: "AUTH_SIGN_OUT_FAILED",
      message: "로그아웃에 실패했습니다. 다시 시도해 주세요.",
    });
    await signOutCurrentUser().catch((error: unknown) => {
      expect(String(error)).not.toContain("sign-out raw");
    });
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

    try {
      subscribeAuthState(vi.fn());
      throw new Error("expected subscribeAuthState to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "AUTH_SUBSCRIPTION_FAILED",
        message: "로그인 상태를 확인하지 못했습니다.",
      });
      expect(String(error)).not.toContain("subscription raw");
    }
  });
});
