import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHashRoute } from "../../hooks/useHashRoute";
import { useAdminSession } from "../../hooks/useAdminSession";
import type { AdminScope } from "../../types";
import AdminPage from "./AdminPage";

const authMock = vi.hoisted(() => ({
  signInAdminWithGoogle: vi.fn(),
  signOutCurrentUser: vi.fn(),
  subscribeAuthState: vi.fn(),
}));
const serviceMock = vi.hoisted(() => ({ getAdminScope: vi.fn() }));

vi.mock("../../firebase/auth", () => authMock);
vi.mock("../../services/adminService", () => serviceMock);

type User = { uid: string; email: string | null; emailVerified: boolean; isAnonymous: boolean };
type AuthListener = (user: User | null) => void;

describe("administrator route and session", () => {
  let authListener: AuthListener;
  let unsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.history.replaceState({}, "", "#/");
    vi.clearAllMocks();
    unsubscribe = vi.fn();
    authMock.subscribeAuthState.mockImplementation((listener: AuthListener) => {
      authListener = listener;
      return unsubscribe;
    });
    authMock.signOutCurrentUser.mockResolvedValue(undefined);
    authMock.signInAdminWithGoogle.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it("maps only the exact admin hash to admin and removes the same hash listener on cleanup", () => {
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useHashRoute());
    expect(result.current).toBe("calendar");

    act(() => {
      window.location.hash = "#/admin";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current).toBe("admin");

    act(() => {
      window.location.hash = "#/admin/queue";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current).toBe("calendar");

    unmount();
    const hashListener = addListener.mock.calls.find(([type]) => type === "hashchange")?.[1];
    expect(hashListener).toEqual(expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("hashchange", hashListener);
    act(() => {
      window.location.hash = "#/admin";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current).toBe("calendar");
  });

  it("keeps the page usable and shows a setup message when auth subscription throws", async () => {
    authMock.subscribeAuthState.mockImplementation(() => {
      throw new Error("Firebase unavailable");
    });

    render(<AdminPage />);

    expect(await screen.findByText(/로그인 설정 오류/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Google/ })).toBeInTheDocument();
  });

  it("shows the signed-out login command and treats an anonymous Firebase user as signed out", async () => {
    serviceMock.getAdminScope.mockResolvedValue(null);
    render(<AdminPage />);
    authListener({ uid: "student", email: null, emailVerified: false, isAnonymous: true });

    expect(await screen.findByRole("button", { name: /Google/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Google/ }));
    await waitFor(() => expect(authMock.signInAdminWithGoogle).toHaveBeenCalledOnce());
  });

  it("keeps an unauthorized explanation visible while signing the Google account out", async () => {
    serviceMock.getAdminScope.mockResolvedValue(null);
    render(<AdminPage />);
    authListener({ uid: "unauthorized", email: "nope@example.com", emailVerified: true, isAnonymous: false });

    expect(await screen.findByText(/권한이 없는 Google 계정/)).toBeInTheDocument();
    expect(authMock.signOutCurrentUser).toHaveBeenCalledOnce();
    authListener(null);
    expect(screen.getByText(/권한이 없는 Google 계정/)).toBeInTheDocument();
  });

  it("reports a failed automatic sign-out and does not retry it for the same account", async () => {
    serviceMock.getAdminScope.mockResolvedValue(null);
    authMock.signOutCurrentUser.mockRejectedValue(new Error("sign-out failed"));
    render(<AdminPage />);
    authListener({ uid: "unauthorized", email: "nope@example.com", emailVerified: true, isAnonymous: false });

    expect(await screen.findByText(/자동 로그아웃에 실패/)).toBeInTheDocument();
    expect(authMock.signOutCurrentUser).toHaveBeenCalledOnce();
    authListener(null);
    expect(authMock.signOutCurrentUser).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /로그아웃 다시 시도/ })).toBeInTheDocument();
  });

  it("renders an authorized scope with a calendar return and icon logout command", async () => {
    const scope: AdminScope = { role: "class_admin", classIds: ["grade-1-class-2"] };
    serviceMock.getAdminScope.mockResolvedValue(scope);
    render(<AdminPage />);
    authListener({ uid: "teacher", email: "teacher@example.com", emailVerified: true, isAnonymous: false });

    expect(await screen.findByText("반 관리자")).toBeInTheDocument();
    expect(screen.getByText("grade-1-class-2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /캘린더/ })).toHaveAttribute("href", "#/");
    fireEvent.click(screen.getByRole("button", { name: /로그아웃/ }));
    await waitFor(() => expect(authMock.signOutCurrentUser).toHaveBeenCalledOnce());
  });

  it("keeps an authorized session and renders a message when logout fails", async () => {
    const scope: AdminScope = { role: "super_admin", classIds: [] };
    serviceMock.getAdminScope.mockResolvedValue(scope);
    authMock.signOutCurrentUser.mockRejectedValue(new Error("sign-out failed"));
    render(<AdminPage />);
    authListener({ uid: "teacher", email: "teacher@example.com", emailVerified: true, isAnonymous: false });

    expect(await screen.findByText("최고 관리자")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /로그아웃/ }));
    expect(await screen.findByText(/로그아웃하지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByText("전체 반 권한")).toBeInTheDocument();
  });

  it("converts a rejected Google login command into a signed-out message", async () => {
    authMock.signInAdminWithGoogle.mockRejectedValue(new Error("popup closed"));
    const { result } = renderHook(() => useAdminSession());
    authListener(null);

    await expect(result.current.login()).resolves.toBeUndefined();
    await waitFor(() => expect(result.current.status).toBe("signed-out"));
    expect(result.current.message).toMatch(/로그인하지 못했습니다/);
  });

  it("does not allow a late user A scope lookup to overwrite user B", async () => {
    let resolveA!: (scope: AdminScope | null) => void;
    const scopeA = new Promise<AdminScope | null>((resolve) => { resolveA = resolve; });
    serviceMock.getAdminScope
      .mockReturnValueOnce(scopeA)
      .mockResolvedValueOnce({ role: "super_admin", classIds: [] });

    const { result } = renderHook(() => useAdminSession());
    authListener({ uid: "user-a", email: "a@example.com", emailVerified: true, isAnonymous: false });
    authListener({ uid: "user-b", email: "b@example.com", emailVerified: true, isAnonymous: false });

    await waitFor(() => expect(result.current.status).toBe("authorized"));
    expect(result.current.user?.uid).toBe("user-b");
    resolveA({ role: "class_admin", classIds: ["grade-1-class-2"] });
    await Promise.resolve();
    expect(result.current.user?.uid).toBe("user-b");
    expect(result.current.scope).toEqual({ role: "super_admin", classIds: [] });
  });
});
