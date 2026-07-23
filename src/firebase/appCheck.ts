import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
  type AppCheck,
} from "firebase/app-check";
import type { FirebaseApp } from "firebase/app";

import {
  createAppCheckIdentity,
  getFirebaseClientState,
} from "./clientState";
import {
  FirebaseClientError,
  toFirebaseClientError,
  type FirebasePublicConfig,
} from "./config";

export function initializeWebAppCheck(
  app: FirebaseApp,
  config: FirebasePublicConfig,
): AppCheck | null {
  if (!config.recaptchaEnterpriseSiteKey) {
    return null;
  }

  const state = getFirebaseClientState();
  const currentIdentity = createAppCheckIdentity(config);
  const existing = state.appChecks.get(app);

  if (existing) {
    if (existing.identity !== currentIdentity) {
      throw new FirebaseClientError("APPCHECK_CONFIG_MISMATCH");
    }
    if (existing.status === "failed") {
      throw existing.error;
    }
    return existing.value;
  }

  if (config.useEmulators) {
    state.appChecks.set(app, {
      identity: currentIdentity,
      status: "ready",
      value: null,
    });
    return null;
  }

  try {
    if (config.appCheckDebug) {
      // 로컬 디버그 토큰은 SDK가 콘솔에 출력하며 파일에는 저장하지 않는다.
      (
        self as typeof self & {
          FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
        }
      ).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(
        config.recaptchaEnterpriseSiteKey,
      ),
      isTokenAutoRefreshEnabled: true,
    });
    state.appChecks.set(app, {
      identity: currentIdentity,
      status: "ready",
      value: appCheck,
    });
    return appCheck;
  } catch (error) {
    const safeError = toFirebaseClientError(
      error,
      "APPCHECK_INITIALIZATION_FAILED",
    );
    state.appChecks.set(app, {
      identity: currentIdentity,
      status: "failed",
      error: safeError,
    });
    throw safeError;
  }
}
