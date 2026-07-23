import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { getFirestoreDb } from "../firebase/app";
import {
  approveOpinionInputSchema,
  archiveEventInputSchema,
  moderationOpinionQueueRowSchema,
  moderationScheduleQueueRowSchema,
  publishScheduleInputSchema,
  rejectionInputSchema,
  type ApproveOpinionInput,
  type ArchiveEventInput,
  type ModerationResult,
  type PublishScheduleInput,
  type RejectProposalInput,
} from "../schemas/moderation";
import { storedOpinionProposalSchema } from "../schemas/opinion";
import { storedProposalSchema } from "../schemas/proposal";
import type { AdminScope, ClassId } from "../types";
import { isClassId } from "../utils/classId";

const SUPER_ADMIN_EMAIL = "chabin0960@gmail.com";

export type AdminIdentity = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
};

const classIdSchema = z.string().refine(isClassId);
const classAdminDocumentSchema = z.object({
  role: z.literal("class_admin"),
  active: z.literal(true),
  classIds: z.array(classIdSchema).min(1).refine(
    (classIds) => new Set(classIds).size === classIds.length,
  ),
}).strict();

export class AdminScopeLookupError extends Error {
  constructor() {
    super("관리자 권한 문서를 확인하지 못했습니다.");
    this.name = "AdminScopeLookupError";
  }
}

export type ModerationErrorCode =
  | "validation"
  | "unauthorized"
  | "not-found"
  | "mismatch"
  | "parent-unavailable"
  | "permission-denied"
  | "network"
  | "retryable";

/** Firebase 원문을 사용자 화면에 노출하지 않는 관리자 작업 오류다. */
export class ModerationError extends Error {
  readonly code: ModerationErrorCode;

  constructor(code: ModerationErrorCode) {
    super(`moderation-${code}`);
    this.name = "ModerationError";
    this.code = code;
  }
}

export type ModerationQueueTab = "pending" | "history";
export type ModerationQueueErrorCode = "permission-denied" | "network" | "retryable" | "unauthorized";
export type ModerationQueueRow = {
  id: string;
  kind: "schedule" | "opinion";
  classId: ClassId;
  status: "pending" | "approved" | "rejected";
  createdAt: Date | null;
  reviewedAt: Date | null;
  [key: string]: unknown;
};

export interface ModerationQueueGateway {
  subscribe(
    scope: AdminScope,
    selectedClassId: ClassId | null,
    tab: ModerationQueueTab,
    onNext: (rows: ModerationQueueRow[]) => void,
    onError: (code: ModerationQueueErrorCode) => void,
  ): () => void;
}

function normalizeEmail(email: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

export async function getAdminScope(
  user: AdminIdentity,
): Promise<AdminScope | null> {
  if (!user.emailVerified) {
    return null;
  }

  if (normalizeEmail(user.email) === SUPER_ADMIN_EMAIL) {
    return { role: "super_admin", classIds: [] };
  }

  try {
    const db = getFirestoreDb();
    if (!db) {
      return null;
    }
    const snapshot = await getDoc(doc(db, "admins", user.uid));
    if (!snapshot.exists()) {
      return null;
    }

    const parsed = classAdminDocumentSchema.safeParse(snapshot.data());
    if (!parsed.success) {
      return null;
    }

    return {
      role: "class_admin",
      classIds: parsed.data.classIds as ClassId[],
    };
  } catch {
    throw new AdminScopeLookupError();
  }
}

function parseCommand<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ModerationError("validation");
  return parsed.data;
}

function requireScope(scope: AdminScope, classId: ClassId): void {
  if (scope.role === "super_admin") return;
  if (scope.role !== "class_admin" || !scope.classIds.includes(classId)) {
    throw new ModerationError("unauthorized");
  }
}

function requireDb() {
  try {
    const db = getFirestoreDb();
    if (!db) throw new ModerationError("network");
    return db;
  } catch (error) {
    if (error instanceof ModerationError) throw error;
    throw new ModerationError("network");
  }
}

function parseStored<T>(schema: z.ZodType<T>, snapshot: { exists(): boolean; data(): unknown }): T {
  if (!snapshot.exists()) throw new ModerationError("not-found");
  const parsed = schema.safeParse(snapshot.data());
  if (!parsed.success) throw new ModerationError("mismatch");
  return parsed.data;
}

function mapFirestoreError(error: unknown): ModerationError {
  if (error instanceof ModerationError) return error;
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code.replace("firestore/", "") : "";
  if (code === "permission-denied") return new ModerationError("permission-denied");
  if (code === "aborted" || code === "failed-precondition" || code === "deadline-exceeded") {
    return new ModerationError("retryable");
  }
  return new ModerationError("network");
}

function alreadyProcessed(status: string, publicId: string | null): ModerationResult | null {
  return status === "pending" ? null : {
    status: "already-processed",
    ...(publicId ? { publicId } : {}),
  };
}

export async function approveSchedule(
  scope: AdminScope,
  adminUid: string,
  input: PublishScheduleInput,
): Promise<ModerationResult> {
  const command = parseCommand(publishScheduleInputSchema, input);
  requireScope(scope, command.classId as ClassId);
  if (!adminUid.trim()) throw new ModerationError("validation");
  const db = requireDb();
  const proposalReference = doc(db, "scheduleProposals", command.proposalId);
  // SDK가 callback을 재실행해도 공개 이벤트 ID는 반드시 하나여야 한다.
  const eventReference = doc(collection(db, "classes", command.classId, "events"));

  try {
    return await runTransaction(db, async (transaction) => {
      const proposal = parseStored(storedProposalSchema, await transaction.get(proposalReference));
      if (proposal.classId !== command.classId) throw new ModerationError("mismatch");
      const processed = alreadyProcessed(proposal.status, proposal.publishedEventId);
      if (processed) return processed;
      transaction.set(eventReference, {
        classId: command.classId,
        title: command.title,
        subject: command.subject,
        description: command.description,
        type: command.type,
        dueDate: command.dueDate,
        source: "approved-proposal",
        sourceProposalId: command.proposalId,
        status: "published",
        approvedBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.update(proposalReference, {
        status: "approved",
        reviewedAt: serverTimestamp(),
        reviewedBy: adminUid,
        rejectionReason: null,
        publishedEventId: eventReference.id,
      });
      return { status: "approved", publicId: eventReference.id };
    });
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

export async function rejectSchedule(
  scope: AdminScope,
  adminUid: string,
  input: RejectProposalInput,
): Promise<ModerationResult> {
  const command = parseCommand(rejectionInputSchema, input);
  requireScope(scope, command.classId as ClassId);
  if (!adminUid.trim()) throw new ModerationError("validation");
  const db = requireDb();
  const proposalReference = doc(db, "scheduleProposals", command.proposalId);
  try {
    return await runTransaction(db, async (transaction) => {
      const proposal = parseStored(storedProposalSchema, await transaction.get(proposalReference));
      if (proposal.classId !== command.classId) throw new ModerationError("mismatch");
      const processed = alreadyProcessed(proposal.status, proposal.publishedEventId);
      if (processed) return processed;
      transaction.update(proposalReference, {
        status: "rejected", reviewedAt: serverTimestamp(), reviewedBy: adminUid,
        rejectionReason: command.reason, publishedEventId: null,
      });
      return { status: "rejected" };
    });
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

export async function approveOpinion(
  scope: AdminScope,
  adminUid: string,
  input: ApproveOpinionInput,
): Promise<ModerationResult> {
  const command = parseCommand(approveOpinionInputSchema, input);
  requireScope(scope, command.classId as ClassId);
  if (!adminUid.trim()) throw new ModerationError("validation");
  const db = requireDb();
  const proposalReference = doc(db, "opinionProposals", command.proposalId);
  const parentReference = doc(db, "classes", command.classId, "events", command.eventId);
  const opinionReference = doc(collection(db, "classes", command.classId, "events", command.eventId, "opinions"));
  try {
    return await runTransaction(db, async (transaction) => {
      const proposal = parseStored(storedOpinionProposalSchema, await transaction.get(proposalReference));
      if (proposal.classId !== command.classId || proposal.eventId !== command.eventId) throw new ModerationError("mismatch");
      const processed = alreadyProcessed(proposal.status, proposal.publishedOpinionId);
      if (processed) return processed;
      const parent = await transaction.get(parentReference);
      if (!parent.exists() || parent.data()?.status !== "published") throw new ModerationError("parent-unavailable");
      transaction.set(opinionReference, {
        nickname: proposal.nickname,
        content: proposal.content,
        sourceProposalId: command.proposalId,
        status: "published",
        approvedBy: adminUid,
        approvedAt: serverTimestamp(),
      });
      transaction.update(proposalReference, {
        status: "approved", reviewedAt: serverTimestamp(), reviewedBy: adminUid,
        rejectionReason: null, publishedOpinionId: opinionReference.id,
      });
      return { status: "approved", publicId: opinionReference.id };
    });
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

export async function archiveEvent(
  scope: AdminScope,
  adminUid: string,
  input: ArchiveEventInput,
): Promise<ModerationResult> {
  const command = parseCommand(archiveEventInputSchema, input);
  requireScope(scope, command.classId as ClassId);
  if (!adminUid.trim()) throw new ModerationError("validation");
  const db = requireDb();
  const eventReference = doc(db, "classes", command.classId, "events", command.eventId);
  try {
    return await runTransaction(db, async (transaction) => {
      const event = await transaction.get(eventReference);
      if (!event.exists()) throw new ModerationError("not-found");
      if (event.data()?.status === "archived") return { status: "already-processed" };
      transaction.update(eventReference, {
        status: "archived", archivedAt: serverTimestamp(), archivedBy: adminUid, updatedAt: serverTimestamp(),
      });
      return { status: "archived" };
    });
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

export async function rejectOpinion(
  scope: AdminScope,
  adminUid: string,
  input: RejectProposalInput,
): Promise<ModerationResult> {
  const command = parseCommand(rejectionInputSchema, input);
  requireScope(scope, command.classId as ClassId);
  if (!adminUid.trim()) throw new ModerationError("validation");
  const db = requireDb();
  const proposalReference = doc(db, "opinionProposals", command.proposalId);
  try {
    return await runTransaction(db, async (transaction) => {
      const proposal = parseStored(storedOpinionProposalSchema, await transaction.get(proposalReference));
      if (proposal.classId !== command.classId) throw new ModerationError("mismatch");
      const processed = alreadyProcessed(proposal.status, proposal.publishedOpinionId);
      if (processed) return processed;
      transaction.update(proposalReference, {
        status: "rejected", reviewedAt: serverTimestamp(), reviewedBy: adminUid,
        rejectionReason: command.reason, publishedOpinionId: null,
      });
      return { status: "rejected" };
    });
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

function queueErrorCode(error: unknown): ModerationQueueErrorCode {
  const mapped = mapFirestoreError(error).code;
  return mapped === "permission-denied" ? mapped : mapped === "retryable" ? mapped : "network";
}

function queueRows(
  kind: ModerationQueueRow["kind"],
  snapshot: { docs: Array<{ id: string; data(): unknown }> },
): ModerationQueueRow[] {
  const schema = kind === "schedule" ? moderationScheduleQueueRowSchema : moderationOpinionQueueRowSchema;
  const rows: ModerationQueueRow[] = [];
  for (const documentSnapshot of snapshot.docs) {
    const parsed = schema.safeParse(documentSnapshot.data());
    if (!parsed.success) continue;
    rows.push({ id: documentSnapshot.id, kind, ...parsed.data, classId: parsed.data.classId as ClassId });
  }
  return rows;
}

function isSelectedClassAllowed(scope: AdminScope, selectedClassId: ClassId | null): boolean {
  if (selectedClassId !== null && !isClassId(selectedClassId)) return false;
  return scope.role === "super_admin" || (selectedClassId !== null && scope.classIds.includes(selectedClassId));
}

export const firebaseModerationQueueGateway: ModerationQueueGateway = {
  subscribe(scope, selectedClassId, tab, onNext, onError) {
    if (!isSelectedClassAllowed(scope, selectedClassId)) {
      onError("unauthorized");
      return () => {};
    }
    let db;
    try {
      db = requireDb();
    } catch (error) {
      onError(queueErrorCode(error));
      return () => {};
    }
    const statusConstraint = tab === "pending"
      ? where("status", "==", "pending")
      : where("status", "in", ["approved", "rejected"]);
    const classConstraint = selectedClassId ? where("classId", "==", selectedClassId) : null;
    const orderConstraint = orderBy(tab === "pending" ? "createdAt" : "reviewedAt", "asc");
    let active = true;
    const latest = new Map<ModerationQueueRow["kind"], ModerationQueueRow[]>();
    const emit = () => {
      if (!active) return;
      onNext([...latest.values()].flat().sort((a, b) => a.id.localeCompare(b.id)));
    };
    const subscribeCollection = (kind: ModerationQueueRow["kind"], path: string) => {
      const constraints = classConstraint ? [classConstraint, statusConstraint, orderConstraint] : [statusConstraint, orderConstraint];
      const sourceQuery = query(collection(db, path), ...constraints);
      return onSnapshot(sourceQuery, (snapshot) => {
        if (!active) return;
        latest.set(kind, queueRows(kind, snapshot));
        emit();
      }, (error) => {
        if (active) onError(queueErrorCode(error));
      });
    };
    try {
      const unsubscribeSchedules = subscribeCollection("schedule", "scheduleProposals");
      const unsubscribeOpinions = subscribeCollection("opinion", "opinionProposals");
      return () => {
        active = false;
        unsubscribeSchedules();
        unsubscribeOpinions();
      };
    } catch (error) {
      active = false;
      onError(queueErrorCode(error));
      return () => {};
    }
  },
};
