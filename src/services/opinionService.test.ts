import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassId } from "../types";

const firebaseAppMock = vi.hoisted(() => ({ getFirestoreDb: vi.fn() }));
const firebaseAuthMock = vi.hoisted(() => ({ ensureAnonymousStudent: vi.fn() }));
const firestoreMock = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  where: vi.fn(),
}));

vi.mock("../firebase/app", () => firebaseAppMock);
vi.mock("../firebase/auth", () => firebaseAuthMock);
vi.mock("firebase/firestore", () => firestoreMock);

import {
  OpinionSubmitError,
  createOpinionService,
  loadDefaultOpinionGateway,
} from "./opinionService";

const classId = "grade-1-class-2" as ClassId;
const draft = { nickname: "Kim", content: "Bring a ruler." };

describe("opinion service", () => {
  it.each([
    ["nickname", ""],
    ["nickname", "x".repeat(21)],
    ["content", ""],
    ["content", "x".repeat(501)],
  ] as const)("rejects invalid %s before authentication", async (field, value) => {
    const ensureAnonymousStudent = vi.fn();
    const service = createOpinionService({
      ensureAnonymousStudent,
      submitProposal: vi.fn(),
    });

    await expect(
      service.submit(classId, "event-1", { ...draft, [field]: value }),
    ).rejects.toMatchObject({ code: "validation" });
    expect(ensureAnonymousStudent).not.toHaveBeenCalled();
  });

  it("rejects an invalid stable target before a proposal write", async () => {
    const submitProposal = vi.fn();
    const service = createOpinionService({
      ensureAnonymousStudent: vi.fn(),
      submitProposal,
    });

    await expect(service.submit("grade-9-class-2" as ClassId, "", draft)).rejects.toMatchObject({
      code: "validation",
    });
    expect(submitProposal).not.toHaveBeenCalled();
  });

  it("authenticates anonymously and submits only a pending proposal", async () => {
    const ensureAnonymousStudent = vi.fn().mockResolvedValue({ uid: "student-1" });
    const submitProposal = vi.fn().mockResolvedValue("proposal-1");
    const service = createOpinionService({ ensureAnonymousStudent, submitProposal });

    await expect(service.submit(classId, "event-1", draft)).resolves.toBe("proposal-1");
    expect(submitProposal).toHaveBeenCalledWith("student-1", classId, "event-1", {
      ...draft,
      status: "pending",
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      publishedOpinionId: null,
    });
  });

  it("maps an active Google administrator session to a logout-required message", async () => {
    const service = createOpinionService({
      ensureAnonymousStudent: vi.fn().mockRejectedValue({ code: "AUTH_ADMIN_SESSION_ACTIVE" }),
      submitProposal: vi.fn(),
    });

    await expect(service.submit(classId, "event-1", draft)).rejects.toMatchObject({
      code: "logout-required",
    });
  });
});

describe("Firebase opinion gateway", () => {
  const db = { kind: "db" };
  let listener: ((snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void) | undefined;
  let errorListener: ((error: Error) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    listener = undefined;
    errorListener = undefined;
    firebaseAppMock.getFirestoreDb.mockReturnValue(db);
    firebaseAuthMock.ensureAnonymousStudent.mockResolvedValue({ uid: "student-1" });
    firestoreMock.collection.mockImplementation((_db: unknown, ...path: string[]) => ({ path }));
    firestoreMock.doc.mockImplementation((reference?: unknown) =>
      reference ? { parent: reference } : { id: "proposal-1" },
    );
    firestoreMock.where.mockReturnValue({ kind: "published" });
    firestoreMock.orderBy.mockReturnValue({ kind: "approved-order" });
    firestoreMock.query.mockReturnValue({ kind: "opinions-query" });
    firestoreMock.serverTimestamp.mockReturnValue("server-time");
    firestoreMock.onSnapshot.mockImplementation((_query: unknown, next: typeof listener, error: typeof errorListener) => {
      listener = next;
      errorListener = error;
      return vi.fn();
    });
  });

  it("queries only published public opinions by approvedAt descending", async () => {
    const gateway = await loadDefaultOpinionGateway();
    gateway.subscribePublished(classId, "event-1", vi.fn(), vi.fn());

    expect(firestoreMock.collection).toHaveBeenCalledWith(
      db, "classes", classId, "events", "event-1", "opinions",
    );
    expect(firestoreMock.where).toHaveBeenCalledWith("status", "==", "published");
    expect(firestoreMock.orderBy).toHaveBeenCalledWith("approvedAt", "desc");
  });

  it("shows approved documents with an approver and skips missing, extra, or malformed records", async () => {
    const onNext = vi.fn();
    const onError = vi.fn();
    const gateway = await loadDefaultOpinionGateway();
    const unsubscribe = gateway.subscribePublished(classId, "event-1", onNext, onError);
    listener?.({ docs: [
      { id: "valid", data: () => ({ nickname: "Kim", content: "Useful", status: "published", sourceProposalId: "p-1", approvedBy: "admin-1", approvedAt: { toDate: () => new Date("2026-07-20") } }) },
      { id: "missing-approver", data: () => ({ nickname: "Kim", content: "Missing", status: "published", sourceProposalId: "p-2", approvedAt: null }) },
      { id: "bad", data: () => ({ nickname: "Kim", content: "bad", status: "published", sourceProposalId: "p-2", approvedAt: null, extra: true }) },
    ] });
    expect(onNext).toHaveBeenCalledWith([expect.objectContaining({ id: "valid", approvedBy: "admin-1" })]);

    unsubscribe();
    listener?.({ docs: [] });
    errorListener?.(new Error("late"));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("rejects missing or archived parents inside the proposal transaction", async () => {
    const gateway = await loadDefaultOpinionGateway();
    const transaction = { get: vi.fn().mockResolvedValue({ exists: () => false }), set: vi.fn() };
    firestoreMock.runTransaction.mockImplementation(async (_db: unknown, callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction));

    await expect(gateway.submit(classId, "event-1", draft)).rejects.toMatchObject({ code: "parent-unavailable" });
    expect(transaction.set).not.toHaveBeenCalled();

    transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ status: "archived" }) });
    await expect(gateway.submit(classId, "event-1", draft)).rejects.toMatchObject({ code: "parent-unavailable" });
  });

  it("writes one pending proposal after an active parent check and never writes public opinions", async () => {
    const gateway = await loadDefaultOpinionGateway();
    const proposalReference = { id: "proposal-1" };
    firestoreMock.doc.mockImplementationOnce((reference: unknown) => ({ parent: reference })).mockReturnValueOnce(proposalReference);
    const transaction = {
      get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ status: "published" }) }),
      set: vi.fn(),
    };
    firestoreMock.runTransaction.mockImplementation(async (_db: unknown, callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction));

    await expect(gateway.submit(classId, "event-1", draft)).resolves.toBe("proposal-1");
    expect(transaction.set).toHaveBeenCalledWith(proposalReference, expect.objectContaining({
      classId, eventId: "event-1", ownerUid: "student-1", status: "pending", createdAt: "server-time",
      reviewedAt: null, reviewedBy: null, rejectionReason: null, publishedOpinionId: null,
    }));
    expect(firestoreMock.collection.mock.calls.map((call: unknown[]) => call.slice(1))).toContainEqual(["opinionProposals"]);
    expect(firestoreMock.collection.mock.calls.map((call: unknown[]) => call.slice(1))).not.toContainEqual(["classes", classId, "events", "event-1", "opinions"]);
  });
});
