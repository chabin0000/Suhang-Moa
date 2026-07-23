import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
  type AppCheck,
} from "firebase/app-check";
import type { FirebaseApp } from "firebase/app";

import {
  toFirebaseClientError,
  type FirebasePublicConfig,
} from "./config";

const initializedAppChecks = new WeakMap<FirebaseApp, AppCheck>();

export function initializeWebAppCheck(
  app: FirebaseApp,
  config: FirebasePublicConfig,
): AppCheck | null {
  if (config.useEmulators) {
    return null;
  }

  const existing = initializedAppChecks.get(app);
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
    initializedAppChecks.set(app, appCheck);
    return appCheck;
  } catch (error) {
    throw toFirebaseClientError(error, "APPCHECK_INITIALIZATION_FAILED");
  }
}
