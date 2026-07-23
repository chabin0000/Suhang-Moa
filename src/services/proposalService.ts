import { z } from "zod";
import { proposalBatchSchema, storedProposalSchema } from "../schemas/proposal";
import type { ScheduleProposal } from "../schemas/proposal";
import type { ClassId, ProposalDraft } from "../types";

export type ProposalSubmission = z.infer<typeof proposalBatchSchema>;

type ProposalWrite = ProposalSubmission[number] & {
  status: "pending";
  reviewedAt: null;
  reviewedBy: null;
  rejectionReason: null;
  publishedEventId: null;
};

export type ProposalBatchDependencies = {
  ensureAnonymousStudent: () => Promise<{ uid: string }>;
  writeBatch: (
    ownerUid: string,
    batchId: string,
    classId: ClassId,
    proposals: ProposalWrite[],
  ) => Promise<string[]>;
  createBatchId: () => string;
};

export class ProposalSubmitError extends Error {
  readonly code: "validation" | "logout-required" | "submission-failed";

  constructor(code: ProposalSubmitError["code"], message: string) {
    super(message);
    this.name = "ProposalSubmitError";
    this.code = code;
  }
}

function normalizeSubmitError(error: unknown): ProposalSubmitError {
  if (error instanceof ProposalSubmitError) return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "AUTH_ADMIN_SESSION_ACTIVE"
  ) {
    return new ProposalSubmitError(
      "logout-required",
      "관리자 로그인 상태입니다. 로그아웃 후 학생 제안을 다시 요청해 주세요.",
    );
  }
  return new ProposalSubmitError("submission-failed", "검토 요청에 실패했습니다. 다시 시도해 주세요.");
}

export function createProposalBatchService(dependencies: ProposalBatchDependencies) {
  return {
    async submitBatch(classId: ClassId, drafts: ProposalDraft[]): Promise<string[]> {
      const parsed = proposalBatchSchema.safeParse(drafts);
      if (!parsed.success) {
        throw new ProposalSubmitError(
          "validation",
          parsed.error.issues[0]?.message ?? "제안 내용을 다시 확인해 주세요.",
        );
      }

      try {
        const user = await dependencies.ensureAnonymousStudent();
        const proposals: ProposalWrite[] = parsed.data.map((proposal) => ({
          ...proposal,
          status: "pending",
          reviewedAt: null,
          reviewedBy: null,
          rejectionReason: null,
          publishedEventId: null,
        }));
        return await dependencies.writeBatch(
          user.uid,
          dependencies.createBatchId(),
          classId,
          proposals,
        );
      } catch (error) {
        throw normalizeSubmitError(error);
      }
    },
  };
}

function createBatchId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export async function loadDefaultProposalBatchSubmitter() {
  const [{ ensureAnonymousStudent }, { getFirestoreDb }, firestore] = await Promise.all([
    import("../firebase/auth"),
    import("../firebase/app"),
    import("firebase/firestore"),
  ]);
  const db = getFirestoreDb();
  if (!db) {
    throw new ProposalSubmitError("submission-failed", "제안 기능이 설정되지 않았습니다.");
  }

  const service = createProposalBatchService({
    ensureAnonymousStudent,
    createBatchId,
    async writeBatch(ownerUid, batchId, classId, proposals) {
      const batch = firestore.writeBatch(db);
      const ids: string[] = [];

      for (const proposal of proposals) {
        const reference = firestore.doc(firestore.collection(db, "scheduleProposals"));
        ids.push(reference.id);
        batch.set(reference, {
          ...proposal,
          ownerUid,
          batchId,
          classId,
          createdAt: firestore.serverTimestamp(),
        });
      }

      await batch.commit();
      return ids;
    },
  });

  return service.submitBatch;
}

export type ProposalHistoryGateway = {
  subscribeExistingAnonymous(
    onNext: (proposals: ScheduleProposal[]) => void,
    onError: () => void,
  ): () => void;
};

export async function loadDefaultProposalHistoryGateway(): Promise<ProposalHistoryGateway> {
  const [{ getFirebaseAuth, getFirestoreDb }, auth, firestore] = await Promise.all([
    import("../firebase/app"),
    import("firebase/auth"),
    import("firebase/firestore"),
  ]);

  return {
    subscribeExistingAnonymous(onNext, onError) {
      let unsubscribeProposals: (() => void) | null = null;
      let closed = false;
      let unsubscribeAuth = () => {};

      try {
        const firebaseAuth = getFirebaseAuth();
        const db = getFirestoreDb();
        if (!firebaseAuth || !db) return () => {};

        unsubscribeAuth = auth.onAuthStateChanged(firebaseAuth, (user) => {
          unsubscribeProposals?.();
          unsubscribeProposals = null;
          if (closed || !user?.isAnonymous) {
            onNext([]);
            return;
          }

          const proposalQuery = firestore.query(
            firestore.collection(db, "scheduleProposals"),
            firestore.where("ownerUid", "==", user.uid),
            firestore.orderBy("createdAt", "desc"),
            firestore.limit(50),
          );
          unsubscribeProposals = firestore.onSnapshot(
            proposalQuery,
            (snapshot) => {
              if (closed) return;
              const proposals: ScheduleProposal[] = [];
              for (const documentSnapshot of snapshot.docs) {
                let parsed: ReturnType<typeof storedProposalSchema.safeParse>;
                try {
                  parsed = storedProposalSchema.safeParse(documentSnapshot.data());
                } catch {
                  continue;
                }
                if (!parsed.success) continue;
                proposals.push({
                  id: documentSnapshot.id,
                  ...parsed.data,
                  classId: parsed.data.classId as ClassId,
                });
              }
              onNext(proposals);
            },
            () => { if (!closed) onError(); },
          );
        });
      } catch {
        onError();
      }

      return () => {
        closed = true;
        unsubscribeAuth();
        unsubscribeProposals?.();
      };
    },
  };
}
