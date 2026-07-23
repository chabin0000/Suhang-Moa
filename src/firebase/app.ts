import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

import { initializeWebAppCheck } from "./appCheck";
import {
  readFirebaseConfig,
  toFirebaseClientError,
  type FirebaseClientError,
  type FirebasePublicConfig,
} from "./config";

interface FirebaseRuntime {
  app: FirebaseApp;
  config: FirebasePublicConfig;
}

let runtime: FirebaseRuntime | null | undefined;
let runtimeError: FirebaseClientError | undefined;
let auth: Auth | undefined;
let authError: FirebaseClientError | undefined;
let firestore: Firestore | undefined;
let firestoreError: FirebaseClientError | undefined;

function toFirebaseOptions(config: FirebasePublicConfig): FirebaseOptions {
  return {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  };
}

function getFirebaseRuntime(): FirebaseRuntime | null {
  if (runtime !== undefined) {
    return runtime;
  }
  if (runtimeError) {
    throw runtimeError;
  }

  try {
    // 환경값 파싱과 SDK 초기화는 첫 getter 호출 전에는 실행하지 않는다.
    const configState = readFirebaseConfig(import.meta.env, import.meta.env.MODE);
    if (!configState.enabled) {
      runtime = null;
      return runtime;
    }

    const app =
      getApps().length > 0
        ? getApp()
        : initializeApp(toFirebaseOptions(configState.value));
    runtime = { app, config: configState.value };
    return runtime;
  } catch (error) {
    runtimeError = toFirebaseClientError(
      error,
      "FIREBASE_INITIALIZATION_FAILED",
    );
    throw runtimeError;
  }
}

export function getFirebaseApp(): FirebaseApp | null {
  return getFirebaseRuntime()?.app ?? null;
}

export function getFirebaseAuth(): Auth | null {
  if (auth) {
    return auth;
  }
  if (authError) {
    throw authError;
  }

  const currentRuntime = getFirebaseRuntime();
  if (!currentRuntime) {
    return null;
  }

  try {
    const nextAuth = getAuth(currentRuntime.app);
    if (currentRuntime.config.useEmulators) {
      connectAuthEmulator(nextAuth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
    }
    auth = nextAuth;
    return auth;
  } catch (error) {
    authError = toFirebaseClientError(
      error,
      "FIREBASE_SERVICE_INITIALIZATION_FAILED",
    );
    throw authError;
  }
}

export function getFirestoreDb(): Firestore | null {
  if (firestore) {
    return firestore;
  }
  if (firestoreError) {
    throw firestoreError;
  }

  const currentRuntime = getFirebaseRuntime();
  if (!currentRuntime) {
    return null;
  }

  try {
    if (!currentRuntime.config.useEmulators) {
      initializeWebAppCheck(currentRuntime.app, currentRuntime.config);
    }

    const nextFirestore = getFirestore(currentRuntime.app);
    if (currentRuntime.config.useEmulators) {
      connectFirestoreEmulator(nextFirestore, "127.0.0.1", 8080);
    }
    firestore = nextFirestore;
    return firestore;
  } catch (error) {
    firestoreError = toFirebaseClientError(
      error,
      "FIREBASE_SERVICE_INITIALIZATION_FAILED",
    );
    throw firestoreError;
  }
}
