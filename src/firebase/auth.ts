import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type Auth,
  type Unsubscribe,
  type User,
} from "firebase/auth";

import { getFirebaseAuth } from "./app";
import {
  FirebaseClientError,
  toFirebaseClientError,
  type FirebaseClientErrorCode,
} from "./config";

function requireFirebaseAuth(): Auth {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new FirebaseClientError("FIREBASE_UNAVAILABLE");
  }
  return auth;
}

function wrapAuthError(
  error: unknown,
  fallbackCode: FirebaseClientErrorCode,
): FirebaseClientError {
  return toFirebaseClientError(error, fallbackCode);
}

export async function ensureAnonymousStudent(): Promise<User> {
  const auth = requireFirebaseAuth();

  try {
    await setPersistence(auth, browserLocalPersistence);
    await auth.authStateReady();

    if (auth.currentUser) {
      if (auth.currentUser.isAnonymous) {
        return auth.currentUser;
      }
      throw new FirebaseClientError("AUTH_ADMIN_SESSION_ACTIVE");
    }

    return (await signInAnonymously(auth)).user;
  } catch (error) {
    throw wrapAuthError(error, "AUTH_ANONYMOUS_SIGN_IN_FAILED");
  }
}

export async function signInAdminWithGoogle(): Promise<User> {
  const auth = requireFirebaseAuth();

  try {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    return (await signInWithPopup(auth, provider)).user;
  } catch (error) {
    throw wrapAuthError(error, "AUTH_ADMIN_SIGN_IN_FAILED");
  }
}

export async function signOutCurrentUser(): Promise<void> {
  const auth = requireFirebaseAuth();

  try {
    await signOut(auth);
  } catch (error) {
    throw wrapAuthError(error, "AUTH_SIGN_OUT_FAILED");
  }
}

export function subscribeAuthState(
  listener: (user: User | null) => void,
): Unsubscribe {
  const auth = requireFirebaseAuth();

  try {
    return onAuthStateChanged(auth, listener);
  } catch (error) {
    throw wrapAuthError(error, "AUTH_SUBSCRIPTION_FAILED");
  }
}
