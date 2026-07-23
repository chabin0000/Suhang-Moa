import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassId, SharedEvent } from "../types";

const firebaseAppMock = vi.hoisted(() => ({
  getFirestoreDb: vi.fn(),
}));

const firestoreMock = vi.hoisted(() => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock("../firebase/app", () => firebaseAppMock);
vi.mock("firebase/firestore", () => firestoreMock);

import {
  firebaseSharedScheduleGateway,
  SharedScheduleGatewayError,
  SharedScheduleValidationError,
  type SharedScheduleGateway,
} from "./sharedScheduleService";
import { useSharedSchedules } from "../hooks/useSharedSchedules";

type UseSharedSchedulesWithLoader = (
  classId: ClassId | null,
  gateway?: SharedScheduleGateway,
  loadDefaultGateway?: () => Promise<SharedScheduleGateway>,
) => ReturnType<typeof useSharedSchedules>;

type SnapshotDocument = {
  id: string;
  data: () => unknown;
};

type SnapshotListener = {
  next: (snapshot: { docs: SnapshotDocument[] }) => void;
  error: (error: Error) => void;
};

const classOne: ClassId = "grade-1-class-1";
const classTwo: ClassId = "grade-1-class-2";

function snapshotDocument(
  id: string,
  data: Record<string, unknown>,
): SnapshotDocument {
  return {
    id,
    data: () => data,
  };
}

function sharedEvent(
  id: string,
  classId: ClassId,
  title: string,
): SharedEvent {
  return {
    source: "shared",
    id,
    classId,
    title,
    subject: "과학",
    description: "공유 일정 설명",
    type: "exam",
    dueDate: "2026-07-25",
    status: "published",
  };
}

describe("firebaseSharedScheduleGateway", () => {
  const db = { kind: "firestore" };
  const collectionReference = { kind: "events-collection" };
  const publishedConstraint = { kind: "published-constraint" };
  const dueDateConstraint = { kind: "due-date-constraint" };
  const publishedQuery = { kind: "published-query" };

  beforeEach(() => {
    vi.clearAllMocks();
    firebaseAppMock.getFirestoreDb.mockReturnValue(db);
    firestoreMock.collection.mockReturnValue(collectionReference);
    firestoreMock.where.mockReturnValue(publishedConstraint);
    firestoreMock.orderBy.mockReturnValue(dueDateConstraint);
    firestoreMock.query.mockReturnValue(publishedQuery);
  });

  it("events 컬렉션에 published 조건과 dueDate 오름차순 조건을 포함한다", () => {
    const unsubscribe = vi.fn();
    firestoreMock.onSnapshot.mockReturnValue(unsubscribe);

    const returned = firebaseSharedScheduleGateway.subscribePublished(
      classOne,
      vi.fn(),
      vi.fn(),
    );

    expect(firestoreMock.collection).toHaveBeenCalledWith(
      db,
      "classes",
      classOne,
      "events",
    );
    expect(firestoreMock.where).toHaveBeenCalledWith(
      "status",
      "==",
      "published",
    );
    expect(firestoreMock.orderBy).toHaveBeenCalledWith("dueDate", "asc");
    expect(firestoreMock.query).toHaveBeenCalledWith(
      collectionReference,
      publishedConstraint,
      dueDateConstraint,
    );
    expect(returned).toBe(unsubscribe);

    const collectionSegments = firestoreMock.collection.mock.calls.flat();
    expect(collectionSegments).not.toContain("scheduleProposals");
    expect(collectionSegments).not.toContain("opinionProposals");
  });

  it("published 문서만 UI 모델로 변환하고 pending 제안 형태는 제외한다", () => {
    const onNext = vi.fn();
    const onError = vi.fn();
    firestoreMock.onSnapshot.mockImplementation(
      (
        _query: unknown,
        next: SnapshotListener["next"],
      ) => {
        next({
          docs: [
            snapshotDocument("published-event", {
              title: "게시된 공동 일정",
              subject: "수학",
              description: "시험 범위 확인",
              type: "exam",
              dueDate: "2026-07-28",
              status: "published",
            }),
            snapshotDocument("pending-proposal", {
              ownerUid: "student-1",
              nickname: "학생",
              title: "승인 전 일정",
              subject: "국어",
              description: "아직 공개하면 안 됨",
              type: "homework",
              dueDate: "2026-07-29",
              status: "pending",
            }),
          ],
        });
        return vi.fn();
      },
    );

    firebaseSharedScheduleGateway.subscribePublished(classOne, onNext, onError);

    expect(onNext).toHaveBeenCalledWith([
      {
        source: "shared",
        id: "published-event",
        classId: classOne,
        title: "게시된 공동 일정",
        subject: "수학",
        description: "시험 범위 확인",
        type: "exam",
        dueDate: "2026-07-28",
        status: "published",
      },
    ]);
    expect(onNext.mock.calls[0][0]).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "pending-proposal" }),
      ]),
    );
  });

  it("손상된 문서만 생략하고 원시 값을 노출하지 않은 검증 오류를 보고한다", () => {
    const secretRawValue = "민감한-원시-문서-값";
    const onNext = vi.fn();
    const onError = vi.fn();
    firestoreMock.onSnapshot.mockImplementation(
      (
        _query: unknown,
        next: SnapshotListener["next"],
      ) => {
        next({
          docs: [
            snapshotDocument("valid-event", {
              title: "정상 일정",
              subject: "물리",
              description: "",
              type: "performance",
              dueDate: "2026-07-30",
              status: "published",
            }),
            snapshotDocument("malformed-event", {
              title: secretRawValue,
              type: "not-a-schedule-type",
              dueDate: "2026-02-30",
              status: "published",
            }),
          ],
        });
        return vi.fn();
      },
    );

    firebaseSharedScheduleGateway.subscribePublished(classOne, onNext, onError);

    expect(onNext).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "valid-event",
        title: "정상 일정",
      }),
    ]);
    expect(onError).toHaveBeenCalledTimes(1);

    const validationError = onError.mock.calls[0][0];
    expect(validationError).toBeInstanceOf(SharedScheduleValidationError);
    expect(validationError.message).toContain("malformed-event");
    expect(validationError.message).not.toContain(secretRawValue);
    expect(validationError).not.toHaveProperty("rawData");
  });

  it("Firestore Timestamp 메타데이터를 SharedEvent에 포함하지 않는다", () => {
    const firestoreTimestamp = {
      seconds: 1_774_406_400,
      nanoseconds: 0,
      toDate: () => new Date("2026-03-24T00:00:00.000Z"),
    };
    const onNext = vi.fn();
    firestoreMock.onSnapshot.mockImplementation(
      (
        _query: unknown,
        next: SnapshotListener["next"],
      ) => {
        next({
          docs: [
            snapshotDocument("timestamp-event", {
              source: "admin",
              sourceProposalId: null,
              title: "시간 경계 확인",
              subject: "정보",
              description: "UI에는 날짜 문자열만 전달",
              type: "etc",
              dueDate: "2026-03-24",
              status: "published",
              createdAt: firestoreTimestamp,
              updatedAt: firestoreTimestamp,
              publishedAt: firestoreTimestamp,
              publishedBy: "admin-1",
            }),
          ],
        });
        return vi.fn();
      },
    );

    firebaseSharedScheduleGateway.subscribePublished(
      classOne,
      onNext,
      vi.fn(),
    );

    expect(onNext).toHaveBeenCalledWith([
      {
        source: "shared",
        id: "timestamp-event",
        classId: classOne,
        title: "시간 경계 확인",
        subject: "정보",
        description: "UI에는 날짜 문자열만 전달",
        type: "etc",
        dueDate: "2026-03-24",
        status: "published",
      },
    ]);
  });

  it("Firebase가 비활성화되면 firebase-disabled 오류를 전달한다", () => {
    firebaseAppMock.getFirestoreDb.mockReturnValue(null);
    const onNext = vi.fn();
    const onError = vi.fn();

    const unsubscribe = firebaseSharedScheduleGateway.subscribePublished(
      classOne,
      onNext,
      onError,
    );

    expect(onNext).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "firebase-disabled" }),
    );
    expect(firestoreMock.collection).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it.each([
    ["permission-denied", "permission-denied"],
    ["unavailable", "network"],
  ] as const)(
    "Firestore %s 오류를 %s 상태로 변환한다",
    (firestoreCode, expectedCode) => {
      let listener: SnapshotListener | undefined;
      firestoreMock.onSnapshot.mockImplementation(
        (
          _query: unknown,
          next: SnapshotListener["next"],
          error: SnapshotListener["error"],
        ) => {
          listener = { next, error };
          return vi.fn();
        },
      );
      const onError = vi.fn();

      firebaseSharedScheduleGateway.subscribePublished(
        classOne,
        vi.fn(),
        onError,
      );
      listener?.error(
        Object.assign(new Error("Firebase SDK detail"), {
          code: firestoreCode,
        }),
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: expectedCode }),
      );
    },
  );
});

describe("useSharedSchedules", () => {
  function createGateway() {
    const order: string[] = [];
    const subscriptions: Array<{
      classId: ClassId;
      onNext: (events: SharedEvent[]) => void;
      onError: (error: Error) => void;
      unsubscribe: ReturnType<typeof vi.fn>;
    }> = [];

    const gateway: SharedScheduleGateway = {
      subscribePublished(classId, onNext, onError) {
        order.push(`subscribe:${classId}`);
        const unsubscribe = vi.fn(() => {
          order.push(`unsubscribe:${classId}`);
        });
        subscriptions.push({ classId, onNext, onError, unsubscribe });
        return unsubscribe;
      },
    };

    return { gateway, order, subscriptions };
  }

  it("반 변경 시 이전 구독을 먼저 해제하고 오래된 콜백을 무시한다", () => {
    const { gateway, order, subscriptions } = createGateway();
    const firstEvent = sharedEvent("first", classOne, "이전 반 일정");
    const secondEvent = sharedEvent("second", classTwo, "현재 반 일정");
    const { result, rerender, unmount } = renderHook(
      ({ classId }) => useSharedSchedules(classId, gateway),
      { initialProps: { classId: classOne as ClassId | null } },
    );

    expect(result.current).toEqual({
      events: [],
      loading: true,
      error: null,
    });

    rerender({ classId: classTwo });

    expect(order).toEqual([
      `subscribe:${classOne}`,
      `unsubscribe:${classOne}`,
      `subscribe:${classTwo}`,
    ]);

    act(() => {
      subscriptions[0].onNext([firstEvent]);
      subscriptions[0].onError(
        new SharedScheduleGatewayError("network"),
      );
    });
    expect(result.current).toEqual({
      events: [],
      loading: true,
      error: null,
    });

    act(() => {
      subscriptions[1].onNext([secondEvent]);
    });
    expect(result.current).toEqual({
      events: [secondEvent],
      loading: false,
      error: null,
    });

    unmount();
    expect(subscriptions[1].unsubscribe).toHaveBeenCalledTimes(1);
  });

  it.each([
    "firebase-disabled",
    "permission-denied",
    "network",
  ] as const)("%s 오류를 정확한 상태 union으로 반환한다", (code) => {
    const { gateway, subscriptions } = createGateway();
    const { result } = renderHook(() =>
      useSharedSchedules(classOne, gateway),
    );

    act(() => {
      subscriptions[0].onError(new SharedScheduleGatewayError(code));
    });

    expect(result.current).toEqual({
      events: [],
      loading: false,
      error: code,
    });
  });

  it("classId가 없으면 Firebase를 구독하지 않는다", () => {
    const { gateway, subscriptions } = createGateway();
    const { result } = renderHook(() =>
      useSharedSchedules(null, gateway),
    );

    expect(subscriptions).toHaveLength(0);
    expect(result.current).toEqual({
      events: [],
      loading: false,
      error: null,
    });
  });

  it("waits for the default gateway and only subscribes to the latest class", async () => {
    let resolveGateway: ((gateway: SharedScheduleGateway) => void) | undefined;
    const loadDefaultGateway = () =>
      new Promise<SharedScheduleGateway>((resolve) => {
        resolveGateway = resolve;
      });
    const unsubscribe = vi.fn();
    const gateway: SharedScheduleGateway = {
      subscribePublished: vi.fn(() => unsubscribe),
    };
    const useHook = useSharedSchedules as UseSharedSchedulesWithLoader;
    const { rerender, unmount } = renderHook(
      ({ classId }) => useHook(classId, undefined, loadDefaultGateway),
      { initialProps: { classId: classOne as ClassId | null } },
    );

    rerender({ classId: classTwo });
    resolveGateway?.(gateway);
    await act(async () => {
      await Promise.resolve();
    });

    expect(gateway.subscribePublished).toHaveBeenCalledTimes(1);
    expect(gateway.subscribePublished).toHaveBeenCalledWith(
      classTwo,
      expect.any(Function),
      expect.any(Function),
    );

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not leave a listener behind when unmounted before the default gateway loads", async () => {
    let resolveGateway: ((gateway: SharedScheduleGateway) => void) | undefined;
    const loadDefaultGateway = () =>
      new Promise<SharedScheduleGateway>((resolve) => {
        resolveGateway = resolve;
      });
    const gateway: SharedScheduleGateway = {
      subscribePublished: vi.fn(() => vi.fn()),
    };
    const useHook = useSharedSchedules as UseSharedSchedulesWithLoader;
    const { unmount } = renderHook(() =>
      useHook(classOne, undefined, loadDefaultGateway),
    );

    unmount();
    resolveGateway?.(gateway);
    await act(async () => {
      await Promise.resolve();
    });

    expect(gateway.subscribePublished).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  cleanup();
});
