import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gatewayMock = vi.hoisted(() => ({
  subscribePublished: vi.fn(() => vi.fn()),
}));

vi.mock("./services/sharedScheduleService", () => ({
  firebaseSharedScheduleGateway: gatewayMock,
}));

vi.mock("./components/admin/AdminPage", () => ({
  default: () => <h1>관리자 작업 공간</h1>,
}));

import App from "./App";

describe("App shared schedule integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "#/");
    gatewayMock.subscribePublished.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens a stored class and subscribes using its converted class ID", async () => {
    window.localStorage.setItem(
      "classmap:selectedClass",
      JSON.stringify({ grade: 2, classNo: 7 }),
    );

    render(<App />);

    await waitFor(() => {
      expect(gatewayMock.subscribePublished).toHaveBeenCalledWith(
        "grade-2-class-7",
        expect.any(Function),
        expect.any(Function),
      );
    });
    expect(screen.getByRole("heading", { name: /ClassMap/ })).toHaveTextContent(
      "2학년 7반",
    );
  });

  it("persists a newly selected class and subscribes with the new class ID", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "2학년" }));
    fireEvent.click(screen.getByRole("button", { name: "3반" }));
    fireEvent.click(screen.getByRole("button", { name: /우리 반 들어가기/ }));

    await waitFor(() => {
      expect(gatewayMock.subscribePublished).toHaveBeenCalledWith(
        "grade-2-class-3",
        expect.any(Function),
        expect.any(Function),
      );
    });
    expect(window.localStorage.getItem("classmap:selectedClass")).toBe(
      JSON.stringify({ grade: 2, classNo: 3 }),
    );
  });

  it("renders admin only for the exact hash and preserves the stored class after returning", async () => {
    window.localStorage.setItem(
      "classmap:selectedClass",
      JSON.stringify({ grade: 1, classNo: 2 }),
    );
    window.history.replaceState({}, "", "#/admin");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "관리자 작업 공간" })).toBeInTheDocument();
    act(() => {
      window.location.hash = "#/admin/other";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(await screen.findByRole("heading", { name: /ClassMap/ })).toHaveTextContent(/1.*2.*ClassMap/);
    expect(window.localStorage.getItem("classmap:selectedClass")).toBe(
      JSON.stringify({ grade: 1, classNo: 2 }),
    );
  });
});
