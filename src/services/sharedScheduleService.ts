import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { z } from "zod";
import { getFirestoreDb } from "../firebase/app";
import { isRealIsoDate, scheduleTypeSchema } from "../schemas/schedule";
import type { ClassId, SharedEvent } from "../types";

export type SharedScheduleErrorCode =
  | "firebase-disabled"
  | "permission-denied"
  | "network";

export interface SharedScheduleGateway {
  subscribePublished(
    classId: ClassId,
    onNext: (events: SharedEvent[]) => void,
    onError: (error: SharedScheduleSubscriptionError) => void,
  ): () => void;
}

export type SharedScheduleSubscriptionError = Error & {
  code?: SharedScheduleErrorCode;
  category?: "validation";
};

export class SharedScheduleGatewayError extends Error {
  readonly code: SharedScheduleErrorCode;

  constructor(code: SharedScheduleErrorCode) {
    super(`공유 일정 구독 오류: ${code}`);
    this.name = "SharedScheduleGatewayError";
    this.code = code;
  }
}

export class SharedScheduleValidationError extends Error {
  readonly category = "validation";
  readonly documentId: string;

  constructor(documentId: string) {
    super(`공유 일정 문서 ${documentId}의 형식이 올바르지 않습니다.`);
    this.name = "SharedScheduleValidationError";
    this.documentId = documentId;
  }
}

const storedSharedEventSchema = z.object({
  title: z.string().trim().min(1).max(80),
  subject: z.string().trim().max(40).optional(),
  description: z.string().trim().max(1000).optional(),
  type: scheduleTypeSchema,
  dueDate: z.string().refine(isRealIsoDate),
  status: z.literal("published"),
});

function convertSnapshotDocument(
  classId: ClassId,
  snapshot: QueryDocumentSnapshot<DocumentData>,
): SharedEvent | null {
  let result: ReturnType<typeof storedSharedEventSchema.safeParse>;

  try {
    result = storedSharedEventSchema.safeParse(snapshot.data());
  } catch {
    return null;
  }

  if (!result.success) {
    return null;
  }

  const { title, subject, description, type, dueDate, status } = result.data;

  return {
    source: "shared",
    id: snapshot.id,
    classId,
    title,
    subject,
    description,
    type,
    dueDate,
    status,
  };
}

function readFirebaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  const code = error.code;
  return typeof code === "string" ? code : null;
}

function normalizeSubscriptionError(error: unknown): SharedScheduleGatewayError {
  const code = readFirebaseErrorCode(error);

  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return new SharedScheduleGatewayError("permission-denied");
  }

  return new SharedScheduleGatewayError("network");
}

function noop(): void {}

export const firebaseSharedScheduleGateway: SharedScheduleGateway = {
  subscribePublished(classId, onNext, onError) {
    let db;

    try {
      db = getFirestoreDb();
    } catch (error) {
      onError(normalizeSubscriptionError(error));
      return noop;
    }

    if (!db) {
      onError(new SharedScheduleGatewayError("firebase-disabled"));
      return noop;
    }

    try {
      const publishedEventsQuery = query(
        collection(db, "classes", classId, "events"),
        where("status", "==", "published"),
        orderBy("dueDate", "asc"),
        limit(50),
      );

      return onSnapshot(
        publishedEventsQuery,
        (snapshot) => {
          const events: SharedEvent[] = [];

          for (const documentSnapshot of snapshot.docs) {
            const event = convertSnapshotDocument(classId, documentSnapshot);

            if (!event) {
              onError(
                new SharedScheduleValidationError(documentSnapshot.id),
              );
              continue;
            }

            events.push(event);
          }

          onNext(events);
        },
        (error) => {
          onError(normalizeSubscriptionError(error));
        },
      );
    } catch (error) {
      onError(normalizeSubscriptionError(error));
      return noop;
    }
  },
};
