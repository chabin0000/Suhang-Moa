import { useCallback, useEffect, useRef, useState } from "react";
import {
  signInAdminWithGoogle,
  signOutCurrentUser,
  subscribeAuthState,
} from "../firebase/auth";
import { AdminScopeLookupError, getAdminScope } from "../services/adminService";
import type { AdminScope } from "../types";

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

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeAuthState((user) => {
      generation.current += 1;
      const currentGeneration = generation.current;

      if (!active) return;
      if (!user || user.isAnonymous) {
        if (deniedUserUid.current) {
          setSession((current) => current.status === "unauthorized" ? current : signedOutState);
        } else {
          setSession(signedOutState);
        }
        return;
      }

      deniedUserUid.current = null;
      setSession({ status: "checking", user, scope: null, message: null });
      void getAdminScope(user)
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
          void signOutCurrentUser().catch(() => undefined);
        })
        .catch((error: unknown) => {
          if (!active || currentGeneration !== generation.current) return;
          deniedUserUid.current = user.uid;
          const message = error instanceof AdminScopeLookupError
            ? "관리자 권한을 확인하지 못했습니다. 잠시 후 다시 로그인해 주세요."
            : "관리자 권한을 확인하지 못했습니다.";
          setSession({ status: "unauthorized", user, scope: null, message });
          void signOutCurrentUser().catch(() => undefined);
        });
    });

    return () => {
      active = false;
      generation.current += 1;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async () => {
    deniedUserUid.current = null;
    setSession((current) => ({ ...current, message: null }));
    await signInAdminWithGoogle();
  }, []);

  const logout = useCallback(async () => {
    deniedUserUid.current = null;
    await signOutCurrentUser();
  }, []);

  return { ...session, login, logout };
}
