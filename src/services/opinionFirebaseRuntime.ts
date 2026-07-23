import { collection, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { getFirestoreDb } from "../firebase/app";
import { ensureAnonymousStudent } from "../firebase/auth";
import { storedPublishedOpinionSchema } from "../schemas/opinion";
import type { ClassId } from "../types";
import { createOpinionService, OpinionSubmitError, type OpinionGateway } from "./opinionService";

export async function loadFirebaseOpinionGateway(): Promise<OpinionGateway> {
  const db = getFirestoreDb();
  if (!db) {
    throw new OpinionSubmitError("submission-failed", "의견 기능이 설정되지 않았습니다.");
  }

  const service = createOpinionService({
    ensureAnonymousStudent,
    async submitProposal(ownerUid, classId, eventId, proposal) {
      const eventReference = doc(db, "classes", classId, "events", eventId);
      const proposalReference = doc(collection(db, "opinionProposals"));
      await runTransaction(db, async (transaction) => {
        // 부모 일정 확인과 제안 저장을 하나의 트랜잭션으로 묶어 상태 변경 경쟁을 막는다.
        const parent = await transaction.get(eventReference);
        if (!parent.exists() || parent.data()?.status !== "published") {
          throw new OpinionSubmitError("parent-unavailable", "공개 중인 공유 일정에서만 의견을 남길 수 있습니다.");
        }
        transaction.set(proposalReference, {
          ...proposal,
          classId,
          eventId,
          ownerUid,
          createdAt: serverTimestamp(),
        });
      });
      return proposalReference.id;
    },
  });

  return {
    submit: service.submit,
    subscribePublished(classId, eventId, onNext, onError) {
      let closed = false;
      let generation = 0;
      try {
        const publishedOpinionsQuery = query(
          collection(db, "classes", classId, "events", eventId, "opinions"),
          where("status", "==", "published"),
          orderBy("approvedAt", "desc"),
          limit(50),
        );
        const activeGeneration = ++generation;
        const unsubscribe = onSnapshot(publishedOpinionsQuery, (snapshot) => {
          if (closed || activeGeneration !== generation) return;
          const opinions = snapshot.docs.flatMap((documentSnapshot) => {
            const parsed = storedPublishedOpinionSchema.safeParse(documentSnapshot.data());
            return parsed.success ? [{ id: documentSnapshot.id, ...parsed.data }] : [];
          });
          onNext(opinions);
        }, (error) => {
          if (!closed && activeGeneration === generation) onError(error);
        });
        return () => {
          closed = true;
          generation += 1;
          unsubscribe();
        };
      } catch (error) {
        onError(error instanceof Error ? error : new Error("의견을 불러오지 못했습니다."));
        return () => {};
      }
    },
  };
}
