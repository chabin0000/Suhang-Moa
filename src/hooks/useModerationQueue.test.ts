import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useModerationQueue, type ModerationQueueGateway } from "./useModerationQueue";
import type { AdminScope, ClassId } from "../types";

const classId: ClassId = "grade-1-class-2";
const scope: AdminScope = { role: "class_admin", classIds: [classId] };

describe("useModerationQueue", () => {
  it("rejects an out-of-scope class before it subscribes", () => {
    const gateway: ModerationQueueGateway = { subscribe: vi.fn() };
    const { result } = renderHook(() => useModerationQueue(scope, "grade-1-class-3" as ClassId, "schedules", gateway));
    expect(result.current).toMatchObject({ loading: false, error: "unauthorized", rows: [] });
    expect(gateway.subscribe).not.toHaveBeenCalled();
  });

  it("cleans up subscriptions and ignores a stale callback after the selected class changes", () => {
    const listeners: Array<(rows: any[]) => void> = [];
    const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];
    const gateway: ModerationQueueGateway = {
      subscribe: vi.fn((_scope, _classId, _tab, onNext) => {
        listeners.push(onNext);
        const unsubscribe = vi.fn();
        unsubscribes.push(unsubscribe);
        return unsubscribe;
      }),
    };
    const { result, rerender } = renderHook(
      ({ selectedClassId }) => useModerationQueue(scope, selectedClassId, "schedules", gateway),
      { initialProps: { selectedClassId: classId as ClassId | null } },
    );
    rerender({ selectedClassId: null });
    act(() => listeners[0]([{ id: "stale", kind: "schedule" }]));
    expect(unsubscribes[0]).toHaveBeenCalledOnce();
    expect(result.current.rows).toEqual([]);
  });

  it("maps a rejected lazy gateway loader to a retryable queue state", async () => {
    const failingLoader = async () => {
      throw new Error("offline");
    };
    const { result } = renderHook(() => useModerationQueue(scope, classId, "schedules", undefined, failingLoader));
    await vi.waitFor(() => expect(result.current).toMatchObject({ loading: false, error: "retryable" }));
  });
});
