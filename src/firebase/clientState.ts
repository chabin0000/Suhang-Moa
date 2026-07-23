import type { AppCheck } from "firebase/app-check";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

import type {
  FirebaseClientError,
  FirebasePublicConfig,
} from "./config";

export interface FirebaseRuntime {
  app: FirebaseApp;
  config: FirebasePublicConfig;
}

export type AppCheckClientState =
  | {
      identity: string;
      status: "ready";
      value: AppCheck | null;
    }
  | {
      identity: string;
      status: "failed";
      error: FirebaseClientError;
    };

export interface FirebaseClientState {
  runtimeIdentity?: string;
  runtime?: FirebaseRuntime | null;
  runtimeError?: FirebaseClientError;
  auth?: Auth;
  authError?: FirebaseClientError;
  firestore?: Firestore;
  firestoreError?: FirebaseClientError;
  appChecks: WeakMap<FirebaseApp, AppCheckClientState>;
}

const FIREBASE_CLIENT_STATE_KEY = Symbol.for(
  "suhang-moa.firebase.client-state.v2",
);

export function createFirebaseRuntimeIdentity(
  config: FirebasePublicConfig,
  mode: string,
): string {
  return JSON.stringify([
    "suhang-moa/firebase-runtime/v1",
    mode,
    config.apiKey,
    config.authDomain,
    config.projectId,
    config.storageBucket,
    config.messagingSenderId,
    config.appId,
    config.recaptchaEnterpriseSiteKey,
    config.useEmulators,
    config.appCheckDebug,
  ]);
}

export function createAppCheckIdentity(
  config: FirebasePublicConfig,
): string {
  return JSON.stringify([
    "suhang-moa/app-check/v1",
    config.recaptchaEnterpriseSiteKey,
    config.useEmulators,
    config.appCheckDebug,
  ]);
}

export function getFirebaseClientState(): FirebaseClientState {
  const stateHost = globalThis as typeof globalThis & Record<symbol, unknown>;
  const existing = stateHost[FIREBASE_CLIENT_STATE_KEY] as
    | FirebaseClientState
    | undefined;

  if (existing) {
    return existing;
  }

  const state: FirebaseClientState = {
    appChecks: new WeakMap<FirebaseApp, AppCheckClientState>(),
  };
  stateHost[FIREBASE_CLIENT_STATE_KEY] = state;
  return state;
}
