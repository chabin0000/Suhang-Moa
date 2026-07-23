import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirestoreDb, getFirebaseAuth } from "../firebase/app";
import { ensureAnonymousStudent } from "../firebase/auth";
import { storedProposalSchema } from "../schemas/proposal";
import type { ScheduleProposal } from "../schemas/proposal";
import type { ClassId } from "../types";
import type {
  ProposalBatchDependencies,
  ProposalHistoryGateway,
} from "./proposalService";
import { ProposalSubmitError } from "./proposalErrors";

export async function loadFirebaseProposalBatchDependencies(
  createBatchId: () => string,
): Promise<ProposalBatchDependencies> {
  const db = getFirestoreDb();
  if (!db) {
    throw new ProposalSubmitError("submission-failed", "제안 기능이 설정되지 않았습니다.");
  }

  return {
    ensureAnonymousStudent,
    createBatchId,
    async writeBatch(ownerUid, batchId, classId, proposals) {
      const batch = writeBatch(db);
      const ids: string[] = [];
      for (const proposal of proposals) {
        const reference = doc(collection(db, "scheduleProposals"));
        ids.push(reference.id);
        batch.set(reference, {
          ...proposal,
          ownerUid,
          batchId,
          classId,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
      return ids;
    },
  };
}

export async function loadFirebaseProposalHistoryGateway(): Promise<ProposalHistoryGateway> {
  return {
    subscribeExistingAnonymous(onNext, onError) {
      let unsubscribeProposals: (() => void) | null = null;
      let closed = false;
      let generation = 0;
      let unsubscribeAuth = () => {};
      try {
        const firebaseAuth = getFirebaseAuth();
        const db = getFirestoreDb();
        if (!firebaseAuth || !db) return () => {};
        unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
          if (closed) return;
          generation += 1;
          const activeGeneration = generation;
          unsubscribeProposals?.();
          unsubscribeProposals = null;
          if (!user?.isAnonymous) {
            onNext([]);
            return;
          }
          const proposalQuery = query(
            collection(db, "scheduleProposals"),
            where("ownerUid", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(50),
          );
          unsubscribeProposals = onSnapshot(
            proposalQuery,
            (snapshot) => {
              if (closed || activeGeneration !== generation) return;
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
            () => {
              if (!closed && activeGeneration === generation) onError();
            },
          );
        });
      } catch {
        onError();
      }
      return () => {
        closed = true;
        generation += 1;
        unsubscribeAuth();
        unsubscribeProposals?.();
      };
    },
  };
}
