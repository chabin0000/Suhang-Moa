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
  let authUnsubscribe: ReturnType<typeof vi.fn>;
  const snapshotListeners: Array<{ next: SnapshotNext; error: SnapshotError }> = [];
  const proposalUnsubscribes: Array<ReturnType<typeof vi.fn>> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    snapshotListeners.length = 0;
    proposalUnsubscribes.length = 0;
    authUnsubscribe = vi.fn();
    firebaseAppMock.getFirebaseAuth.mockReturnValue({ kind: "auth" });
    firebaseAppMock.getFirestoreDb.mockReturnValue(db);
    authSdkMock.onAuthStateChanged.mockImplementation((_auth: unknown, listener: AuthListener) => {
      authListener = listener;
      return authUnsubscribe;
    });
    firestoreMock.collection.mockReturnValue({ kind: "proposal-collection" });
    firestoreMock.where.mockReturnValue({ kind: "owner-filter" });
    firestoreMock.orderBy.mockReturnValue({ kind: "created-order" });
    firestoreMock.limit.mockReturnValue({ kind: "limit-50" });
    firestoreMock.query.mockReturnValue({ kind: "proposal-query" });
    firestoreMock.onSnapshot.mockImplementation((_query: unknown, next: SnapshotNext, error: SnapshotError) => {
      snapshotListeners.push({ next, error });
      const unsubscribe = vi.fn();
      proposalUnsubscribes.push(unsubscribe);
      return unsubscribe;
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
    expect(firestoreMock.collection).toHaveBeenNthCalledWith(1, db, "scheduleProposals");
    expect(firestoreMock.collection).toHaveBeenNthCalledWith(2, db, "scheduleProposals");
    expect(firestoreMock.doc).toHaveBeenCalledTimes(2);
    expect(firestoreMock.doc.mock.calls[0][0]).toBe(firestoreMock.doc.mock.calls[1][0]);
    expect(batch.set.mock.calls[0][0]).not.toBe(batch.set.mock.calls[1][0]);
    expect(batch.set).toHaveBeenNthCalledWith(1, firstReference, {
      ...draft, ownerUid: "student-1", batchId: "batch-1", classId: "grade-1-class-2",
      status: "pending", reviewedAt: null, reviewedBy: null, rejectionReason: null,
      publishedEventId: null, createdAt: "server-time",
    });
    expect(batch.set).toHaveBeenNthCalledWith(2, secondReference, {
      ...draft, title: "Math test", ownerUid: "student-1", batchId: "batch-1", classId: "grade-1-class-2",
      status: "pending", reviewedAt: null, reviewedBy: null, rejectionReason: null,
      publishedEventId: null, createdAt: "server-time",
    });
  });

  it("queries only the current anonymous owner's latest fifty proposals", async () => {
    const gateway = await loadFirebaseProposalHistoryGateway();
    gateway.subscribeExistingAnonymous(vi.fn(), vi.fn());
    authListener?.(anonymousOne);

    expect(firestoreMock.collection).toHaveBeenCalledWith(db, "scheduleProposals");
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

  it("unsubscribes and clears state when an anonymous user becomes non-anonymous", async () => {
    const onNext = vi.fn();
    const onError = vi.fn();
    const gateway = await loadFirebaseProposalHistoryGateway();
    gateway.subscribeExistingAnonymous(onNext, onError);
    authListener?.(anonymousOne);
    const firstListener = snapshotListeners[0];
    authListener?.({ uid: "google-admin", isAnonymous: false });

    expect(proposalUnsubscribes[0]).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledWith([]);
    expect(firestoreMock.onSnapshot).toHaveBeenCalledOnce();
    firstListener.next({ docs: [{ id: "stale", data: () => storedProposal() }] });
    firstListener.error();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("blocks stale anonymous A callbacks and delivers the current anonymous B callbacks", async () => {
    const onNext = vi.fn();
    const onError = vi.fn();
    const gateway = await loadFirebaseProposalHistoryGateway();
    gateway.subscribeExistingAnonymous(onNext, onError);
    authListener?.(anonymousOne);
    const firstListener = snapshotListeners[0];
    authListener?.(anonymousTwo);
    const secondListener = snapshotListeners[1];

    expect(proposalUnsubscribes[0]).toHaveBeenCalledOnce();
    firstListener.next({ docs: [{ id: "stale", data: () => storedProposal() }] });
    firstListener.error();
    expect(onNext).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    secondListener.next({ docs: [{ id: "current", data: () => storedProposal({ ownerUid: "student-2" }) }] });
    secondListener.error();
    expect(onNext).toHaveBeenCalledWith([expect.objectContaining({ id: "current", ownerUid: "student-2" })]);
    expect(onError).toHaveBeenCalledOnce();
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
    expect(authUnsubscribe).toHaveBeenCalledOnce();
    expect(proposalUnsubscribes[0]).toHaveBeenCalledOnce();
    listener.next({ docs: [{ id: "late", data: () => storedProposal() }] });
    listener.error();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});
