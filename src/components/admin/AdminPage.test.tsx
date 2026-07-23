import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHashRoute } from "../../hooks/useHashRoute";
import { useAdminSession } from "../../hooks/useAdminSession";
import type { AdminScope } from "../../types";
import type { ModerationQueueGateway, ModerationQueueRow } from "../../services/adminService";
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
    expect(screen.getByText("전체 반 권한")).toBeInTheDocument();
  });

  it("converts a rejected Google login command into a signed-out message", async () => {
    authMock.signInAdminWithGoogle.mockRejectedValue(new Error("popup closed"));
    const { result } = renderHook(() => useAdminSession());
    authListener(null);

    await expect(result.current.login()).resolves.toBeUndefined();
    await waitFor(() => expect(result.current.status).toBe("signed-out"));
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

describe("administrator moderation workspace", () => {
  afterEach(() => cleanup());
  const scope: AdminScope = { role: "class_admin", classIds: ["grade-1-class-2"] };
  const schedule = {
    id: "proposal-1", kind: "schedule" as const, batchId: "batch", ownerUid: "student", classId: "grade-1-class-2" as const,
    nickname: "민지", title: "초안 제목", subject: "물리", description: "원본 설명", type: "performance" as const,
    dueDate: "2026-08-01", status: "pending" as const, createdAt: null, reviewedAt: null,
    reviewedBy: null, rejectionReason: null, publishedEventId: null,
  };
  const opinion = {
    id: "opinion-1", kind: "opinion" as const, classId: "grade-1-class-2" as const, eventId: "event-1", ownerUid: "student",
    nickname: "학생", content: "<b>그대로 보이는 의견</b>", status: "pending" as const, createdAt: null,
    reviewedAt: null, reviewedBy: null, rejectionReason: null, publishedOpinionId: null,
  };

  function renderWorkspace(rows: ModerationQueueRow[] = [schedule], commandOverrides: Record<string, unknown> = {}) {
    let listener: (next: ModerationQueueRow[]) => void = () => {};
    const gateway: ModerationQueueGateway = {
      subscribe: vi.fn((_scope, _classId, _tab, onNext) => { listener = onNext; queueMicrotask(() => onNext(rows)); return vi.fn(); }),
    };
    const commands = {
      approveSchedule: vi.fn().mockResolvedValue({ status: "approved" }), rejectSchedule: vi.fn().mockResolvedValue({ status: "rejected" }),
      approveOpinion: vi.fn().mockResolvedValue({ status: "approved" }), rejectOpinion: vi.fn().mockResolvedValue({ status: "rejected" }),
      archiveEvent: vi.fn().mockResolvedValue({ status: "archived" }), ...commandOverrides,
    };
    const session = { status: "authorized" as const, scope, user: { uid: "teacher", email: "teacher@example.com", emailVerified: true, isAnonymous: false }, message: null, login: vi.fn(), logout: vi.fn() };
    render(<AdminPage sessionOverride={session} queueGateway={gateway} commands={commands} />);
    return { gateway, commands, emit: (next: ModerationQueueRow[]) => listener(next) };
  }

  it("uses exactly three Task 9 tabs, scoped class queries, and 36 super-admin class options", async () => {
    const { gateway } = renderWorkspace();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(await screen.findByRole("option", { name: "1학년 2반" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "1학년 3반" })).not.toBeInTheDocument();
    await waitFor(() => expect(gateway.subscribe).toHaveBeenLastCalledWith(scope, "grade-1-class-2", "schedules", expect.any(Function), expect.any(Function)));
  });

  it("keeps list context, validates drafts, and submits the exact edited schedule command once", async () => {
    const { commands } = renderWorkspace();
    await screen.findByRole("button", { name: /초안 제목/ });
    fireEvent.click(screen.getByRole("button", { name: /초안 제목/ }));
    const title = screen.getByLabelText("제목");
    fireEvent.change(title, { target: { value: "수정 제목" } });
    fireEvent.click(screen.getByRole("button", { name: "확인하고 게시" }));
    await waitFor(() => expect(commands.approveSchedule).toHaveBeenCalledWith(scope, "teacher", expect.objectContaining({ proposalId: "proposal-1", classId: "grade-1-class-2", title: "수정 제목" })));
    expect(screen.getByText("초안 제목")).toBeInTheDocument();
  });

  it("shows opinion text as text, requires a rejection reason, and locks duplicate actions", async () => {
    const { commands } = renderWorkspace([opinion]);
    await screen.findByRole("button", { name: /학생/ });
    fireEvent.click(screen.getByRole("button", { name: /학생/ }));
    expect(screen.getByText("<b>그대로 보이는 의견</b>")).toBeInTheDocument();
    expect(screen.queryByLabelText("제목")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "반려" }));
    fireEvent.click(screen.getByRole("button", { name: "반려 확정" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "근거가 부족합니다" } });
    fireEvent.click(screen.getByRole("button", { name: "반려 확정" }));
    fireEvent.click(screen.getByRole("button", { name: "반려 확정" }));
    await waitFor(() => expect(commands.rejectOpinion).toHaveBeenCalledOnce());
  });

  it("keeps an edited schedule draft after a normal command failure", async () => {
    const { commands } = renderWorkspace([schedule], { approveSchedule: vi.fn().mockRejectedValue({ code: "network" }) });
    fireEvent.click((await screen.findByText("\uCD08\uC548 \uC81C\uBAA9")).closest("button")!);
    fireEvent.change(screen.getByLabelText("\uC81C\uBAA9"), { target: { value: "\uC785\uB825\uAC12 \uC720\uC9C0" } });
    fireEvent.click(screen.getByRole("button", { name: "\uD655\uC778\uD558\uACE0 \uAC8C\uC2DC" }));
    await waitFor(() => expect(commands.approveSchedule).toHaveBeenCalledOnce());
    expect(screen.getByDisplayValue("\uC785\uB825\uAC12 \uC720\uC9C0")).toBeInTheDocument();
  });

  it("clears selection when its queue row disappears and exposes a mobile back command", async () => {
    const { emit } = renderWorkspace();
    fireEvent.click((await screen.findByText("\uCD08\uC548 \uC81C\uBAA9")).closest("button")!);
    expect(screen.getByRole("button", { name: "Back to queue" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to queue" }));
    expect(screen.queryByRole("button", { name: "Back to queue" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("\uCD08\uC548 \uC81C\uBAA9").closest("button")!);
    act(() => emit([]));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Back to queue" })).not.toBeInTheDocument());
  });
});
