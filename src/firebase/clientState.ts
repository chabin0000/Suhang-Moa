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

export interface FirebaseClientState {
  runtime?: FirebaseRuntime | null;
  runtimeError?: FirebaseClientError;
  auth?: Auth;
  authError?: FirebaseClientError;
  firestore?: Firestore;
  firestoreError?: FirebaseClientError;
  appChecks: WeakMap<FirebaseApp, AppCheck>;
}

const FIREBASE_CLIENT_STATE_KEY = Symbol.for(
  "suhang-moa.firebase.client-state.v1",
);

export function getFirebaseClientState(): FirebaseClientState {
  const stateHost = globalThis as typeof globalThis & Record<symbol, unknown>;
  const existing = stateHost[FIREBASE_CLIENT_STATE_KEY] as
    | FirebaseClientState
    | undefined;

  if (existing) {
    return existing;
  }

  const state: FirebaseClientState = {
    appChecks: new WeakMap<FirebaseApp, AppCheck>(),
  };
  stateHost[FIREBASE_CLIENT_STATE_KEY] = state;
  return state;
}
