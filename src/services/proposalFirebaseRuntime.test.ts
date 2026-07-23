import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposalDraft } from "../types";

type AuthListener = (user: { uid: string; isAnonymous: boolean } | null) => void;
type SnapshotNext = (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void;
type SnapshotError = () => void;

const firebaseAppMock = vi.hoisted(() => ({
  getFirebaseAuth: vi.fn(),
  getFirestoreDb: vi.fn(),
}));
const firebaseAuthMock = vi.hoisted(() => ({
  ensureAnonymousStudent: vi.fn(),
}));
const authSdkMock = vi.hoisted(() => ({ onAuthStateChanged: vi.fn() }));
const firestoreMock = vi.hoisted(() => ({
  collection: vi.fn(), doc: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(),
  orderBy: vi.fn(), query: vi.fn(), serverTimestamp: vi.fn(), where: vi.fn(), writeBatch: vi.fn(),
}));

vi.mock("../firebase/app", () => firebaseAppMock);
vi.mock("../firebase/auth", () => firebaseAuthMock);
vi.mock("firebase/auth", () => authSdkMock);
vi.mock("firebase/firestore", () => firestoreMock);

import {
  loadFirebaseProposalBatchDependencies,
  loadFirebaseProposalHistoryGateway,
} from "./proposalFirebaseRuntime";

const db = { kind: "db" };
const anonymousOne = { uid: "student-1", isAnonymous: true };
const anonymousTwo = { uid: "student-2", isAnonymous: true };
const draft: ProposalDraft = {
  nickname: "Kim", title: "Physics report", subject: "Physics", description: "Observe motion",
  type: "performance", dueDate: "2026-07-30",
};

function storedProposal(overrides: Record<string, unknown> = {}) {
  return {
    batchId: "batch-1", ownerUid: "student-1", classId: "grade-1-class-2", nickname: "Kim",
    title: "Physics report", subject: "Physics", description: "Observe motion", type: "performance",
    dueDate: "2026-07-30", status: "pending", createdAt: { toDate: () => new Date("2026-07-20T00:00:00.000Z") },
    reviewedAt: null, reviewedBy: null, rejectionReason: null, publishedEventId: null,
    ...overrides,
  };
}

describe("proposal Firebase runtime adapter", () => {
  let authListener: AuthListener | undefined;
  const snapshotListeners: Array<{ next: SnapshotNext; error: SnapshotError }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    snapshotListeners.length = 0;
    firebaseAppMock.getFirebaseAuth.mockReturnValue({ kind: "auth" });
    firebaseAppMock.getFirestoreDb.mockReturnValue(db);
    authSdkMock.onAuthStateChanged.mockImplementation((_auth: unknown, listener: AuthListener) => {
      authListener = listener;
      return vi.fn();
    });
    firestoreMock.collection.mockReturnValue({ kind: "proposal-collection" });
    firestoreMock.where.mockReturnValue({ kind: "owner-filter" });
    firestoreMock.orderBy.mockReturnValue({ kind: "created-order" });
    firestoreMock.limit.mockReturnValue({ kind: "limit-50" });
    firestoreMock.query.mockReturnValue({ kind: "proposal-query" });
    firestoreMock.onSnapshot.mockImplementation((_query: unknown, next: SnapshotNext, error: SnapshotError) => {
      snapshotListeners.push({ next, error });
      return vi.fn();
    });
  });

  it("writes two proposals with unique document references in one committed batch", async () => {
    const firstReference = { id: "proposal-1" };
    const secondReference = { id: "proposal-2" };
    const batch = { set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    firestoreMock.doc.mockReturnValueOnce(firstReference).mockReturnValueOnce(secondReference);
    firestoreMock.writeBatch.mockReturnValue(batch);
    firestoreMock.serverTimestamp.mockReturnValue("server-time");

    const dependencies = await loadFirebaseProposalBatchDependencies(() => "batch-1");
    await expect(dependencies.writeBatch("student-1", "batch-1", "grade-1-class-2", [
      { ...draft, status: "pending", reviewedAt: null, reviewedBy: null, rejectionReason: null, publishedEventId: null },
      { ...draft, title: "Math test", status: "pending", reviewedAt: null, reviewedBy: null, rejectionReason: null, publishedEventId: null },
    ])).resolves.toEqual(["proposal-1", "proposal-2"]);

    expect(firestoreMock.writeBatch).toHaveBeenCalledOnce();
    expect(batch.commit).toHaveBeenCalledOnce();
    expect(firestoreMock.doc).toHaveBeenCalledTimes(2);
    expect(firestoreMock.doc.mock.calls[0][0]).toBe(firestoreMock.doc.mock.calls[1][0]);
    expect(batch.set.mock.calls[0][0]).not.toBe(batch.set.mock.calls[1][0]);
    expect(batch.set).toHaveBeenCalledWith(firstReference, expect.objectContaining({
      batchId: "batch-1", ownerUid: "student-1", classId: "grade-1-class-2", status: "pending",
      reviewedAt: null, reviewedBy: null, rejectionReason: null, publishedEventId: null, createdAt: "server-time",
    }));
    expect(batch.set).toHaveBeenCalledWith(secondReference, expect.objectContaining({
      batchId: "batch-1", ownerUid: "student-1", classId: "grade-1-class-2", status: "pending",
      reviewedAt: null, reviewedBy: null, rejectionReason: null, publishedEventId: null, createdAt: "server-time",
    }));
  });

  it("queries only the current anonymous owner's latest fifty proposals", async () => {
    const gateway = await loadFirebaseProposalHistoryGateway();
    gateway.subscribeExistingAnonymous(vi.fn(), vi.fn());
    authListener?.(anonymousOne);

    expect(firestoreMock.where).toHaveBeenCalledWith("ownerUid", "==", "student-1");
    expect(firestoreMock.orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(firestoreMock.limit).toHaveBeenCalledWith(50);
    expect(firestoreMock.query).toHaveBeenCalledWith(
      { kind: "proposal-collection" },
      { kind: "owner-filter" },
      { kind: "created-order" },
      { kind: "limit-50" },
    );
  });

  it("unsubscribes the previous proposal query and ignores its late callbacks after an auth switch", async () => {
    const onNext = vi.fn();
    const onError = vi.fn();
    const firstUnsubscribe = vi.fn();
    const secondUnsubscribe = vi.fn();
    firestoreMock.onSnapshot.mockImplementation((_query: unknown, next: SnapshotNext, error: SnapshotError) => {
      snapshotListeners.push({ next, error });
      return snapshotListeners.length === 1 ? firstUnsubscribe : secondUnsubscribe;
    });
    const gateway = await loadFirebaseProposalHistoryGateway();
    gateway.subscribeExistingAnonymous(onNext, onError);
    authListener?.(anonymousOne);
    const firstListener = snapshotListeners[0];
    authListener?.(anonymousTwo);

    expect(firstUnsubscribe).toHaveBeenCalledOnce();
    firstListener.next({ docs: [{ id: "stale", data: () => storedProposal() }] });
    firstListener.error();
    expect(onNext).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(secondUnsubscribe).not.toHaveBeenCalled();
  });

  it("ignores late callbacks after cleanup and skips malformed or extra-field documents", async () => {
    const onNext = vi.fn();
    const onError = vi.fn();
    const gateway = await loadFirebaseProposalHistoryGateway();
    const unsubscribe = gateway.subscribeExistingAnonymous(onNext, onError);
    authListener?.(anonymousOne);
    const listener = snapshotListeners[0];
    listener.next({ docs: [
      { id: "valid", data: () => storedProposal() },
      { id: "extra", data: () => storedProposal({ unexpected: "raw" }) },
      { id: "invalid", data: () => storedProposal({ dueDate: "2026-02-30" }) },
    ] });
    expect(onNext).toHaveBeenCalledWith([expect.objectContaining({ id: "valid" })]);

    unsubscribe();
    listener.next({ docs: [{ id: "late", data: () => storedProposal() }] });
    listener.error();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});
