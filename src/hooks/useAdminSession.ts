import { useCallback, useEffect, useRef, useState } from "react";
import {
  signInAdminWithGoogle,
  signOutCurrentUser,
  subscribeAuthState,
} from "../firebase/auth";
import type { AdminScope } from "../types";

const adminServicePromise = import("../services/adminService");

function loadAdminScope(user: { uid: string; email: string | null; emailVerified: boolean }): Promise<AdminScope | null> {
  return adminServicePromise.then(({ getAdminScope }) => getAdminScope(user));
}

type AdminUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
};

export type AdminSessionStatus =
  | "signed-out"
  | "checking"
  | "authorized"
  | "unauthorized";

type AdminSessionState = {
  status: AdminSessionStatus;
  user: AdminUser | null;
  scope: AdminScope | null;
  message: string | null;
};

export type AdminSession = AdminSessionState & {
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const signedOutState = {
  status: "signed-out" as const,
  user: null,
  scope: null,
  message: null,
};

export function useAdminSession(): AdminSession {
  const [session, setSession] = useState<AdminSessionState>(signedOutState);
  const generation = useRef(0);
  const deniedUserUid = useRef<string | null>(null);
  const autoSignOutAttemptedUid = useRef<string | null>(null);
  const manualLogout = useRef(false);

  useEffect(() => {
    let active = true;
    const handleAuthState = (user: AdminUser | null) => {
      generation.current += 1;
      const currentGeneration = generation.current;

      if (!active) return;
      if (!user || user.isAnonymous) {
        if (manualLogout.current) {
          manualLogout.current = false;
          deniedUserUid.current = null;
          setSession(signedOutState);
          return;
        }
        if (deniedUserUid.current) {
          setSession((current) => current.status === "unauthorized" ? current : signedOutState);
        } else {
          setSession(signedOutState);
        }
        return;
      }

      deniedUserUid.current = null;
      autoSignOutAttemptedUid.current = null;
      setSession({ status: "checking", user, scope: null, message: null });
      void loadAdminScope(user)
        .then((scope) => {
          if (!active || currentGeneration !== generation.current) return;
          if (scope) {
            setSession({ status: "authorized", user, scope, message: null });
            return;
          }

          deniedUserUid.current = user.uid;
          setSession({
            status: "unauthorized",
            user,
            scope: null,
            message: "권한이 없는 Google 계정입니다. 관리자 권한을 확인한 뒤 다시 로그인해 주세요.",
          });
          if (autoSignOutAttemptedUid.current !== user.uid) {
            autoSignOutAttemptedUid.current = user.uid;
            void signOutCurrentUser().catch(() => {
              if (!active || currentGeneration !== generation.current) return;
              setSession((current) => current.status === "unauthorized" && current.user?.uid === user.uid
                ? {
                    ...current,
                    message: "권한이 없는 Google 계정입니다. 자동 로그아웃에 실패했습니다. 로그아웃을 다시 시도해 주세요.",
                  }
                : current);
            });
          }
        })
        .catch((error: unknown) => {
          if (!active || currentGeneration !== generation.current) return;
          deniedUserUid.current = user.uid;
          const message = "관리자 권한을 확인하지 못했습니다. 잠시 후 다시 로그인해 주세요.";
          setSession({ status: "unauthorized", user, scope: null, message });
          if (autoSignOutAttemptedUid.current !== user.uid) {
            autoSignOutAttemptedUid.current = user.uid;
            void signOutCurrentUser().catch(() => {
              if (!active || currentGeneration !== generation.current) return;
              setSession((current) => current.status === "unauthorized" && current.user?.uid === user.uid
                ? {
                    ...current,
                    message: `${message} 자동 로그아웃에 실패했습니다. 로그아웃을 다시 시도해 주세요.`,
                  }
                : current);
            });
          }
        });
    };

    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeAuthState(handleAuthState);
    } catch {
      setSession({
        ...signedOutState,
        message: "로그인 설정 오류가 발생했습니다. Firebase 설정을 확인해 주세요.",
      });
    }

    return () => {
      active = false;
      generation.current += 1;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async () => {
    deniedUserUid.current = null;
    autoSignOutAttemptedUid.current = null;
    manualLogout.current = false;
    generation.current += 1;
    setSession(signedOutState);
    try {
      await signInAdminWithGoogle();
    } catch {
      setSession({
        ...signedOutState,
        message: "Google 로그인하지 못했습니다. 팝업을 닫았거나 로그인 설정을 확인해 주세요.",
      });
    }
  }, []);

  const logout = useCallback(async () => {
    manualLogout.current = true;
    try {
      await signOutCurrentUser();
    } catch {
      manualLogout.current = false;
      setSession((current) => ({
        ...current,
        message: "로그아웃하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
      }));
    }
  }, []);

  return { ...session, login, logout };
}
