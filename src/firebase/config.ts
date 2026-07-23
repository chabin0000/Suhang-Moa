import { z } from "zod";

export const FIREBASE_PUBLIC_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_RECAPTCHA_ENTERPRISE_SITE_KEY",
] as const;

export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  recaptchaEnterpriseSiteKey: string;
  useEmulators: boolean;
  appCheckDebug: boolean;
}

export type FirebaseClientErrorCode =
  | "APPCHECK_DEBUG_FORBIDDEN"
  | "APPCHECK_CONFIG_MISMATCH"
  | "APPCHECK_INITIALIZATION_FAILED"
  | "AUTH_ADMIN_SESSION_ACTIVE"
  | "AUTH_ADMIN_SIGN_IN_FAILED"
  | "AUTH_ANONYMOUS_SIGN_IN_FAILED"
  | "AUTH_SIGN_OUT_FAILED"
  | "AUTH_SUBSCRIPTION_FAILED"
  | "FIREBASE_INITIALIZATION_FAILED"
  | "FIREBASE_CONFIG_MISMATCH"
  | "FIREBASE_SERVICE_INITIALIZATION_FAILED"
  | "FIREBASE_UNAVAILABLE";

const FIREBASE_CLIENT_ERROR_MESSAGES = {
  APPCHECK_DEBUG_FORBIDDEN:
    "운영 환경에서는 App Check 디버그 모드를 사용할 수 없습니다.",
  APPCHECK_CONFIG_MISMATCH:
    "App Check 설정 충돌이 감지되었습니다. 페이지를 새로고침해 주세요.",
  APPCHECK_INITIALIZATION_FAILED: "App Check를 초기화하지 못했습니다.",
  AUTH_ADMIN_SESSION_ACTIVE:
    "관리자 로그아웃 후 학생 제출을 다시 시도해 주세요.",
  AUTH_ADMIN_SIGN_IN_FAILED:
    "관리자 로그인에 실패했습니다. 다시 시도해 주세요.",
  AUTH_ANONYMOUS_SIGN_IN_FAILED:
    "학생 인증에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  AUTH_SIGN_OUT_FAILED: "로그아웃에 실패했습니다. 다시 시도해 주세요.",
  AUTH_SUBSCRIPTION_FAILED: "로그인 상태를 확인하지 못했습니다.",
  FIREBASE_CONFIG_MISMATCH:
    "Firebase 설정 충돌이 감지되었습니다. 페이지를 새로고침해 주세요.",
  FIREBASE_INITIALIZATION_FAILED: "공유 일정 기능을 초기화하지 못했습니다.",
  FIREBASE_SERVICE_INITIALIZATION_FAILED:
    "공유 일정 기능에 연결하지 못했습니다.",
  FIREBASE_UNAVAILABLE: "공유 일정 기능이 설정되지 않았습니다.",
} as const satisfies Record<FirebaseClientErrorCode, string>;

export class FirebaseClientError extends Error {
  readonly code: FirebaseClientErrorCode;

  constructor(code: FirebaseClientErrorCode) {
    super(FIREBASE_CLIENT_ERROR_MESSAGES[code]);
    this.name = "FirebaseClientError";
    this.code = code;
  }
}

export function toFirebaseClientError(
  error: unknown,
  fallbackCode: FirebaseClientErrorCode,
): FirebaseClientError {
  return error instanceof FirebaseClientError
    ? error
    : new FirebaseClientError(fallbackCode);
}

const booleanStringSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const firebaseEnvSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().trim().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().trim().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().trim().min(1),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().trim().min(1),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().trim().min(1),
  VITE_FIREBASE_APP_ID: z.string().trim().min(1),
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: z.string().trim().min(1),
  VITE_USE_FIREBASE_EMULATORS: booleanStringSchema,
  VITE_APPCHECK_DEBUG: booleanStringSchema,
});

export function readFirebaseConfig(
  env: ImportMetaEnv,
  mode: string,
): { enabled: true; value: FirebasePublicConfig } | { enabled: false } {
  const appCheckDebug = booleanStringSchema.safeParse(
    env.VITE_APPCHECK_DEBUG,
  );

  if (
    mode === "production" &&
    appCheckDebug.success &&
    appCheckDebug.data
  ) {
    throw new FirebaseClientError("APPCHECK_DEBUG_FORBIDDEN");
  }

  const parsed = firebaseEnvSchema.safeParse(env);

  if (!parsed.success) {
    return { enabled: false };
  }

  return {
    enabled: true,
    value: {
      apiKey: parsed.data.VITE_FIREBASE_API_KEY,
      authDomain: parsed.data.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: parsed.data.VITE_FIREBASE_PROJECT_ID,
      storageBucket: parsed.data.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: parsed.data.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: parsed.data.VITE_FIREBASE_APP_ID,
      recaptchaEnterpriseSiteKey:
        parsed.data.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
      useEmulators: parsed.data.VITE_USE_FIREBASE_EMULATORS,
      appCheckDebug: parsed.data.VITE_APPCHECK_DEBUG,
    },
  };
}

export function assertFirebaseEnvForCiProduction(
  env: Readonly<Record<string, string | boolean | undefined>>,
  mode: string,
  ci: string | undefined,
): void {
  if (mode !== "production" || ci !== "true") {
    return;
  }

  const missingKeys = FIREBASE_PUBLIC_ENV_KEYS.filter((key) => {
    const value = env[key];
    return typeof value !== "string" || value.trim() === "";
  });

  if (missingKeys.length > 0) {
    throw new Error(missingKeys.join(", "));
  }
}
