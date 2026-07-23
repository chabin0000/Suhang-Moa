import {
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
import { getFirebaseClientState, type FirebaseRuntime } from "./clientState";
import {
  readFirebaseConfig,
  toFirebaseClientError,
  type FirebasePublicConfig,
} from "./config";

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
  const state = getFirebaseClientState();

  if (state.runtime !== undefined) {
    return state.runtime;
  }
  if (state.runtimeError) {
    throw state.runtimeError;
  }

  try {
    // 환경값 파싱과 SDK 초기화는 첫 getter 호출 전에는 실행하지 않는다.
    const configState = readFirebaseConfig(import.meta.env, import.meta.env.MODE);
    if (!configState.enabled) {
      state.runtime = null;
      return state.runtime;
    }

    const app = initializeApp(toFirebaseOptions(configState.value));
    state.runtime = { app, config: configState.value };
    return state.runtime;
  } catch (error) {
    state.runtimeError = toFirebaseClientError(
      error,
      "FIREBASE_INITIALIZATION_FAILED",
    );
    throw state.runtimeError;
  }
}

export function getFirebaseApp(): FirebaseApp | null {
  return getFirebaseRuntime()?.app ?? null;
}

export function getFirebaseAuth(): Auth | null {
  const state = getFirebaseClientState();

  if (state.auth) {
    return state.auth;
  }
  if (state.authError) {
    throw state.authError;
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
    state.auth = nextAuth;
    return state.auth;
  } catch (error) {
    state.authError = toFirebaseClientError(
      error,
      "FIREBASE_SERVICE_INITIALIZATION_FAILED",
    );
    throw state.authError;
  }
}

export function getFirestoreDb(): Firestore | null {
  const state = getFirebaseClientState();

  if (state.firestore) {
    return state.firestore;
  }
  if (state.firestoreError) {
    throw state.firestoreError;
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
    state.firestore = nextFirestore;
    return state.firestore;
  } catch (error) {
    state.firestoreError = toFirebaseClientError(
      error,
      "FIREBASE_SERVICE_INITIALIZATION_FAILED",
    );
    throw state.firestoreError;
  }
}
