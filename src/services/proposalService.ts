import { z } from "zod";
import { proposalBatchSchema } from "../schemas/proposal";
import type { ScheduleProposal } from "../schemas/proposal";
import type { ClassId, ProposalDraft } from "../types";
import { ProposalSubmitError } from "./proposalErrors";

export { ProposalSubmitError } from "./proposalErrors";

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
  const { loadFirebaseProposalBatchDependencies } = await import(
    "./proposalFirebaseRuntime"
  );
  const dependencies = await loadFirebaseProposalBatchDependencies(createBatchId);
  const service = createProposalBatchService(dependencies);

  return service.submitBatch;
}

export type ProposalHistoryGateway = {
  subscribeExistingAnonymous(
    onNext: (proposals: ScheduleProposal[]) => void,
    onError: () => void,
  ): () => void;
};

export async function loadDefaultProposalHistoryGateway(): Promise<ProposalHistoryGateway> {
  const { loadFirebaseProposalHistoryGateway } = await import(
    "./proposalFirebaseRuntime"
  );
  return loadFirebaseProposalHistoryGateway();
}
