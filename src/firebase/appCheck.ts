import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
  type AppCheck,
} from "firebase/app-check";
import type { FirebaseApp } from "firebase/app";

import { getFirebaseClientState } from "./clientState";
import {
  toFirebaseClientError,
  type FirebasePublicConfig,
} from "./config";

export function initializeWebAppCheck(
  app: FirebaseApp,
  config: FirebasePublicConfig,
): AppCheck | null {
  if (config.useEmulators) {
    return null;
  }

  const state = getFirebaseClientState();
  const existing = state.appChecks.get(app);
  if (existing) {
    return existing;
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
    state.appChecks.set(app, appCheck);
    return appCheck;
  } catch (error) {
    throw toFirebaseClientError(error, "APPCHECK_INITIALIZATION_FAILED");
  }
}
