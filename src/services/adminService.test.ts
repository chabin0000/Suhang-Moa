import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminScope, ClassId } from "../types";

const firebaseAppMock = vi.hoisted(() => ({ getFirestoreDb: vi.fn() }));
const firestoreMock = vi.hoisted(() => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), onSnapshot: vi.fn(), orderBy: vi.fn(),
  query: vi.fn(), runTransaction: vi.fn(), serverTimestamp: vi.fn(), where: vi.fn(),
}));

vi.mock("../firebase/app", () => firebaseAppMock);
vi.mock("firebase/firestore", () => firestoreMock);

import {
  AdminScopeLookupError,
  ModerationError,
  approveOpinion,
  approveSchedule,
  archiveEvent,
  firebaseModerationQueueGateway,
  getAdminScope,
  rejectOpinion,
  rejectSchedule,
} from "./adminService";

const db = { kind: "db" };
const classId: ClassId = "grade-1-class-2";
const otherClassId: ClassId = "grade-1-class-3";
const classAdmin: AdminScope = { role: "class_admin", classIds: [classId] };
const superAdmin: AdminScope = { role: "super_admin", classIds: [] };
const editedSchedule = {
  proposalId: "proposal-1", classId, title: "관리자가 고친 제목", subject: "물리",
  description: "공개용 설명", type: "exam" as const, dueDate: "2026-07-30",
};

function documentSnapshot(data: unknown, exists = true) {
  return { exists: () => exists, data: () => data };
}

function timestamp() {
  return { toDate: () => new Date("2026-07-20T00:00:00.000Z") };
}

function storedScheduleProposal(overrides: Record<string, unknown> = {}) {
  return {
    batchId: "batch-1", ownerUid: "student-1", classId, nickname: "학생", title: "원래 제목",
    subject: "원래 과목", description: "원래 설명", type: "homework", dueDate: "2026-07-28",
    status: "pending", createdAt: timestamp(), reviewedAt: null, reviewedBy: null,
    rejectionReason: null, publishedEventId: null, ...overrides,
  };
}

function storedOpinionProposal(overrides: Record<string, unknown> = {}) {
  return {
    classId, eventId: "event-1", ownerUid: "student-1", nickname: "학생", content: "원래 의견",
    status: "pending", createdAt: timestamp(), reviewedAt: null, reviewedBy: null,
    rejectionReason: null, publishedOpinionId: null, ...overrides,
  };
}

function runTransactionWith(
  read: (reference: unknown) => ReturnType<typeof documentSnapshot>,
  retries = 1,
) {
  firestoreMock.runTransaction.mockImplementation(async (_db: unknown, callback: (tx: any) => Promise<unknown>) => {
    let result: unknown;
    for (let index = 0; index < retries; index += 1) {
      const transaction = { get: vi.fn(async (reference: unknown) => read(reference)), set: vi.fn(), update: vi.fn() };
      result = await callback(transaction);
      (firestoreMock.runTransaction.mock.results as any[]).push?.(transaction);
    }
    return result;
  });
}

describe("adminService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseAppMock.getFirestoreDb.mockReturnValue(db);
    firestoreMock.collection.mockImplementation((_db: unknown, ...segments: string[]) => ({ kind: "collection", segments }));
    firestoreMock.doc.mockImplementation((first: unknown, ...segments: string[]) => (
      "segments" in (first as object) ? { id: "event-fixed", kind: "public", parent: first } : { kind: "doc", segments }
    ));
    firestoreMock.serverTimestamp.mockReturnValue("SERVER_TIME");
  });

  it("normalizes a verified super-admin email without reading Firestore", async () => {
    await expect(getAdminScope({ uid: "super-admin", email: "  CHABIN0960@GMAIL.COM  ", emailVerified: true }))
      .resolves.toEqual({ role: "super_admin", classIds: [] });
    expect(firestoreMock.getDoc).not.toHaveBeenCalled();
  });

  it("reads the exact admin document path and returns only declared class IDs", async () => {
    firestoreMock.getDoc.mockResolvedValue(documentSnapshot({ role: "class_admin", active: true, classIds: [classId] }));
    await expect(getAdminScope({ uid: "class-admin-1", email: "teacher@example.com", emailVerified: true }))
      .resolves.toEqual(classAdmin);
    expect(firestoreMock.doc).toHaveBeenCalledWith(db, "admins", "class-admin-1");
  });

  it("maps Firestore scope reads to a safe typed error", async () => {
    firestoreMock.getDoc.mockRejectedValue(new Error("network unavailable"));
    await expect(getAdminScope({ uid: "class-admin-1", email: "teacher@example.com", emailVerified: true }))
      .rejects.toEqual(new AdminScopeLookupError());
  });

  it("approves a pending schedule with the exact public payload while preserving source content", async () => {
    const transactions: any[] = [];
    firestoreMock.runTransaction.mockImplementation(async (_db: unknown, callback: (tx: any) => Promise<unknown>) => {
      const transaction = { get: vi.fn(async () => documentSnapshot(storedScheduleProposal())), set: vi.fn(), update: vi.fn() };
      transactions.push(transaction);
      return callback(transaction);
    });

    await expect(approveSchedule(classAdmin, "teacher-1", editedSchedule)).resolves.toEqual({ status: "approved", publicId: "event-fixed" });
    expect(firestoreMock.collection).toHaveBeenCalledWith(db, "classes", classId, "events");
    expect(transactions[0].get).toHaveBeenCalledWith({ kind: "doc", segments: ["scheduleProposals", "proposal-1"] });
    expect(transactions[0].set).toHaveBeenCalledWith(expect.objectContaining({ id: "event-fixed" }), {
      classId, title: "관리자가 고친 제목", subject: "물리", description: "공개용 설명", type: "exam", dueDate: "2026-07-30",
      source: "approved-proposal", sourceProposalId: "proposal-1", status: "published", approvedBy: "teacher-1",
      createdAt: "SERVER_TIME", updatedAt: "SERVER_TIME",
    });
    expect(transactions[0].update).toHaveBeenCalledWith({ kind: "doc", segments: ["scheduleProposals", "proposal-1"] }, {
      status: "approved", reviewedAt: "SERVER_TIME", reviewedBy: "teacher-1", rejectionReason: null, publishedEventId: "event-fixed",
    });
  });

  it("reuses one allocated event reference when the SDK retries the transaction", async () => {
    const references: unknown[] = [];
    firestoreMock.runTransaction.mockImplementation(async (_db: unknown, callback: (tx: any) => Promise<unknown>) => {
      for (let index = 0; index < 2; index += 1) {
        const transaction = { get: vi.fn(async () => documentSnapshot(storedScheduleProposal())), set: vi.fn((reference) => references.push(reference)), update: vi.fn() };
        await callback(transaction);
      }
      return { status: "approved", publicId: "event-fixed" };
    });
    await approveSchedule(classAdmin, "teacher-1", editedSchedule);
    expect(firestoreMock.doc).toHaveBeenCalledTimes(2);
    expect(references).toHaveLength(2);
    expect(references[0]).toBe(references[1]);
  });

  it("returns already-processed without a public write for a repeated schedule approval", async () => {
    const transaction = { get: vi.fn(async () => documentSnapshot(storedScheduleProposal({ status: "approved", publishedEventId: "existing" }))), set: vi.fn(), update: vi.fn() };
    firestoreMock.runTransaction.mockImplementation((_db: unknown, callback: (tx: any) => Promise<unknown>) => callback(transaction));
    await expect(approveSchedule(classAdmin, "teacher-1", editedSchedule)).resolves.toEqual({ status: "already-processed", publicId: "existing" });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("rejects only valid reasons and never creates a public event", async () => {
    await expect(rejectSchedule(classAdmin, "teacher-1", { proposalId: "proposal-1", classId, reason: " " }))
      .rejects.toMatchObject({ code: "validation" });
    expect(firebaseAppMock.getFirestoreDb).not.toHaveBeenCalled();

    const transaction = { get: vi.fn(async () => documentSnapshot(storedScheduleProposal())), set: vi.fn(), update: vi.fn() };
    firestoreMock.runTransaction.mockImplementation((_db: unknown, callback: (tx: any) => Promise<unknown>) => callback(transaction));
    await expect(rejectSchedule(classAdmin, "teacher-1", { proposalId: "proposal-1", classId, reason: "  사유  " })).resolves.toEqual({ status: "rejected" });
    expect(transaction.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ rejectionReason: "사유" }));
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("approves an opinion from the stored proposal byte-for-byte after rereading its published parent", async () => {
    const transaction = { get: vi.fn(async (reference: any) => reference.segments?.[0] === "opinionProposals"
      ? documentSnapshot(storedOpinionProposal({ nickname: "  학생  ", content: "  원문 의견  " })) : documentSnapshot({ status: "published" })), set: vi.fn(), update: vi.fn() };
    firestoreMock.runTransaction.mockImplementation((_db: unknown, callback: (tx: any) => Promise<unknown>) => callback(transaction));
    firestoreMock.doc.mockImplementation((first: any, ...segments: string[]) => "segments" in first
      ? { id: "opinion-fixed", kind: "public", parent: first } : { kind: "doc", segments });
    await expect(approveOpinion(classAdmin, "teacher-1", { proposalId: "opinion-1", classId, eventId: "event-1" }))
      .resolves.toEqual({ status: "approved", publicId: "opinion-fixed" });
    expect(transaction.set).toHaveBeenCalledWith(expect.objectContaining({ id: "opinion-fixed" }), {
      nickname: "  학생  ", content: "  원문 의견  ", sourceProposalId: "opinion-1", status: "published", approvedBy: "teacher-1", approvedAt: "SERVER_TIME",
    });
    expect(transaction.update).toHaveBeenCalledWith({ kind: "doc", segments: ["opinionProposals", "opinion-1"] }, expect.objectContaining({ publishedOpinionId: "opinion-fixed" }));
    expect(transaction.get).toHaveBeenCalledWith({ kind: "doc", segments: ["classes", classId, "events", "event-1"] });
  });

  it("reuses the same nested opinion reference through a retry and does not rewrite an approved opinion", async () => {
    const references: unknown[] = [];
    firestoreMock.doc.mockImplementation((first: any, ...segments: string[]) => "segments" in first
      ? { id: "opinion-fixed", kind: "public", parent: first } : { kind: "doc", segments });
    firestoreMock.runTransaction.mockImplementation(async (_db: unknown, callback: (tx: any) => Promise<unknown>) => {
      for (let index = 0; index < 2; index += 1) {
        const transaction = { get: vi.fn(async (reference: any) => reference.segments?.[0] === "opinionProposals"
          ? documentSnapshot(storedOpinionProposal()) : documentSnapshot({ status: "published" })), set: vi.fn((reference) => references.push(reference)), update: vi.fn() };
        await callback(transaction);
      }
      return { status: "approved", publicId: "opinion-fixed" };
    });
    await approveOpinion(classAdmin, "teacher-1", { proposalId: "opinion-1", classId, eventId: "event-1" });
    expect(firestoreMock.collection).toHaveBeenCalledWith(db, "classes", classId, "events", "event-1", "opinions");
    expect(references).toHaveLength(2);
    expect(references[0]).toBe(references[1]);

    const processed = { get: vi.fn(async () => documentSnapshot(storedOpinionProposal({ status: "approved", publishedOpinionId: "opinion-fixed" }))), set: vi.fn(), update: vi.fn() };
    firestoreMock.runTransaction.mockImplementation((_db: unknown, callback: (tx: any) => Promise<unknown>) => callback(processed));
    await expect(approveOpinion(classAdmin, "teacher-1", { proposalId: "opinion-1", classId, eventId: "event-1" }))
      .resolves.toEqual({ status: "already-processed", publicId: "opinion-fixed" });
    expect(processed.set).not.toHaveBeenCalled();
    expect(processed.update).not.toHaveBeenCalled();
  });

  it("rejects parent-unavailable opinions without public writes", async () => {
    const transaction = { get: vi.fn(async (reference: any) => reference.segments?.[0] === "opinionProposals"
      ? documentSnapshot(storedOpinionProposal()) : documentSnapshot({ status: "archived" })), set: vi.fn(), update: vi.fn() };
    firestoreMock.runTransaction.mockImplementation((_db: unknown, callback: (tx: any) => Promise<unknown>) => callback(transaction));
    await expect(approveOpinion(classAdmin, "teacher-1", { proposalId: "opinion-1", classId, eventId: "event-1" }))
      .rejects.toMatchObject({ code: "parent-unavailable" });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("archives instead of deleting and returns already-processed for archived events", async () => {
    const transaction = { get: vi.fn(async () => documentSnapshot({ status: "published" })), update: vi.fn(), delete: vi.fn() };
    firestoreMock.runTransaction.mockImplementation((_db: unknown, callback: (tx: any) => Promise<unknown>) => callback(transaction));
    await expect(archiveEvent(classAdmin, "teacher-1", { classId, eventId: "event-1" })).resolves.toEqual({ status: "archived" });
    expect(transaction.update).toHaveBeenCalledWith(expect.anything(), { status: "archived", archivedAt: "SERVER_TIME", archivedBy: "teacher-1", updatedAt: "SERVER_TIME" });
    expect(transaction.delete).not.toHaveBeenCalled();
  });

  it("returns already-processed for a repeated archive without another update", async () => {
    const transaction = { get: vi.fn(async () => documentSnapshot({ status: "archived" })), update: vi.fn() };
    firestoreMock.runTransaction.mockImplementation((_db: unknown, callback: (tx: any) => Promise<unknown>) => callback(transaction));
    await expect(archiveEvent(classAdmin, "teacher-1", { classId, eventId: "event-1" })).resolves.toEqual({ status: "already-processed" });
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("rejects an opinion without creating a public document", async () => {
    const transaction = { get: vi.fn(async () => documentSnapshot(storedOpinionProposal())), set: vi.fn(), update: vi.fn() };
    firestoreMock.runTransaction.mockImplementation((_db: unknown, callback: (tx: any) => Promise<unknown>) => callback(transaction));
    await expect(rejectOpinion(classAdmin, "teacher-1", { proposalId: "opinion-1", classId, reason: "부적절한 표현" }))
      .resolves.toEqual({ status: "rejected" });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "rejected", rejectionReason: "부적절한 표현" }));
  });

  it("subscribes only schedule proposals for the schedule pending tab", () => {
    const unsubscribe = vi.fn();
    firestoreMock.where.mockImplementation((...args: unknown[]) => ({ where: args }));
    firestoreMock.orderBy.mockImplementation((...args: unknown[]) => ({ orderBy: args }));
    firestoreMock.query.mockImplementation((...args: unknown[]) => ({ query: args }));
    firestoreMock.onSnapshot.mockImplementation((_query: unknown, _next: unknown, _error: unknown) => unsubscribe);
    firebaseModerationQueueGateway.subscribe(classAdmin, classId, "schedules", vi.fn(), vi.fn());
    expect(firestoreMock.collection).toHaveBeenCalledWith(db, "scheduleProposals");
    expect(firestoreMock.where).toHaveBeenCalledWith("classId", "==", classId);
    expect(firestoreMock.where).toHaveBeenCalledWith("status", "==", "pending");
    expect(firestoreMock.orderBy).toHaveBeenCalledWith("createdAt", "asc");
    expect(firestoreMock.query.mock.calls[0][1]).toEqual({ where: ["classId", "==", classId] });
    expect(firestoreMock.collection).not.toHaveBeenCalledWith(db, "opinionProposals");
    expect(firestoreMock.onSnapshot).toHaveBeenCalledOnce();
  });

  it("subscribes only opinion proposals for the opinion pending tab", () => {
    firestoreMock.where.mockImplementation((...args: unknown[]) => ({ where: args }));
    firestoreMock.orderBy.mockImplementation((...args: unknown[]) => ({ orderBy: args }));
    firestoreMock.query.mockImplementation((...args: unknown[]) => ({ query: args }));
    firestoreMock.onSnapshot.mockReturnValue(vi.fn());
    firebaseModerationQueueGateway.subscribe(classAdmin, classId, "opinions", vi.fn(), vi.fn());
    expect(firestoreMock.collection).toHaveBeenCalledWith(db, "opinionProposals");
    expect(firestoreMock.collection).not.toHaveBeenCalledWith(db, "scheduleProposals");
    expect(firestoreMock.orderBy).toHaveBeenCalledWith("createdAt", "asc");
    expect(firestoreMock.onSnapshot).toHaveBeenCalledOnce();
  });

  it("uses reviewedAt descending history queries, skips malformed rows, and merges ties deterministically", () => {
    const listeners: Array<(snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void> = [];
    firestoreMock.where.mockImplementation((...args: unknown[]) => ({ where: args }));
    firestoreMock.orderBy.mockImplementation((...args: unknown[]) => ({ orderBy: args }));
    firestoreMock.query.mockImplementation((...args: unknown[]) => ({ query: args }));
    firestoreMock.onSnapshot.mockImplementation((_query: unknown, next: (snapshot: any) => void) => {
      listeners.push(next);
      return vi.fn();
    });
    const onNext = vi.fn();
    firebaseModerationQueueGateway.subscribe(superAdmin, null, "history", onNext, vi.fn());
    listeners[0]({ docs: [
      { id: "schedule-z", data: () => storedScheduleProposal({ status: "approved", reviewedAt: { toDate: () => new Date("2026-07-22T00:00:00.000Z") } }) },
      { id: "bad", data: () => ({ classId, status: "approved" }) },
    ] });
    listeners[1]({ docs: [
      { id: "opinion-a", data: () => storedOpinionProposal({ status: "rejected", reviewedAt: { toDate: () => new Date("2026-07-22T00:00:00.000Z") } }) },
    ] });
    expect(onNext).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "schedule-z", kind: "schedule" }),
      expect.objectContaining({ id: "opinion-a", kind: "opinion" }),
    ]);
    expect(firestoreMock.where).not.toHaveBeenCalledWith("classId", "==", expect.anything());
    expect(firestoreMock.where).toHaveBeenCalledWith("status", "in", ["approved", "rejected"]);
    expect(firestoreMock.orderBy).toHaveBeenCalledWith("reviewedAt", "desc");
    expect(firestoreMock.onSnapshot).toHaveBeenCalledTimes(2);
  });

  it("puts null reviewed times last and releases an already-open listener after partial history setup failure", () => {
    const listeners: Array<(snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void> = [];
    const scheduleUnsubscribe = vi.fn();
    firestoreMock.where.mockImplementation((...args: unknown[]) => ({ where: args }));
    firestoreMock.orderBy.mockImplementation((...args: unknown[]) => ({ orderBy: args }));
    firestoreMock.query.mockImplementation((...args: unknown[]) => ({ query: args }));
    firestoreMock.onSnapshot.mockImplementationOnce((_query: unknown, next: (snapshot: any) => void) => {
      listeners.push(next);
      return scheduleUnsubscribe;
    }).mockImplementationOnce(() => { throw new Error("second listener failed"); });
    const onError = vi.fn();
    firebaseModerationQueueGateway.subscribe(superAdmin, null, "history", vi.fn(), onError);
    expect(scheduleUnsubscribe).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith("network");

    firestoreMock.onSnapshot.mockImplementation((_query: unknown, next: (snapshot: any) => void) => {
      listeners.push(next);
      return vi.fn();
    });
    const onNext = vi.fn();
    firebaseModerationQueueGateway.subscribe(superAdmin, null, "history", onNext, vi.fn());
    listeners[1]({ docs: [{ id: "no-review", data: () => storedScheduleProposal({ status: "approved", reviewedAt: null }) }] });
    listeners[2]({ docs: [{ id: "reviewed", data: () => storedOpinionProposal({ status: "approved", reviewedAt: { toDate: () => new Date("2026-07-23T00:00:00.000Z") } }) }] });
    expect(onNext).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "reviewed" }),
      expect.objectContaining({ id: "no-review" }),
    ]);
  });

  it("blocks invalid or out-of-scope commands before any Firebase access", async () => {
    await expect(approveSchedule(classAdmin, "teacher-1", { ...editedSchedule, classId: otherClassId })).rejects.toMatchObject({ code: "unauthorized" });
    await expect(approveSchedule(superAdmin, "teacher-1", { ...editedSchedule, classId: "bad-class" as ClassId })).rejects.toMatchObject({ code: "validation" });
    expect(firebaseAppMock.getFirestoreDb).not.toHaveBeenCalled();
    expect(firestoreMock.doc).not.toHaveBeenCalled();
    expect(firestoreMock.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects Firestore path separators before Firebase access and maps document construction errors safely", async () => {
    await expect(approveSchedule(superAdmin, "teacher-1", { ...editedSchedule, proposalId: "bad/path" }))
      .rejects.toEqual(new ModerationError("validation"));
    expect(firebaseAppMock.getFirestoreDb).not.toHaveBeenCalled();
    firestoreMock.doc.mockImplementation(() => { throw new Error("raw sdk path failure"); });
    await expect(approveSchedule(superAdmin, "teacher-1", editedSchedule)).rejects.toEqual(new ModerationError("network"));
  });

  it("maps raw Firestore permission, network, and aborted errors to safe typed errors", async () => {
    firestoreMock.runTransaction.mockRejectedValueOnce({ code: "permission-denied", message: "secret" });
    await expect(approveSchedule(superAdmin, "teacher-1", editedSchedule)).rejects.toEqual(new ModerationError("permission-denied"));
    firestoreMock.runTransaction.mockRejectedValueOnce({ code: "aborted", message: "secret" });
    await expect(approveSchedule(superAdmin, "teacher-1", editedSchedule)).rejects.toEqual(new ModerationError("retryable"));
  });
});
