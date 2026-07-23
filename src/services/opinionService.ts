import { z } from "zod";
import { opinionDraftSchema, opinionTargetSchema } from "../schemas/opinion";
import type { OpinionDraft, PublishedOpinion } from "../schemas/opinion";
import type { ClassId } from "../types";

export interface OpinionGateway {
  subscribePublished(
    classId: ClassId,
    eventId: string,
    onNext: (items: PublishedOpinion[]) => void,
    onError: (error: Error) => void,
  ): () => void;
  submit(classId: ClassId, eventId: string, draft: OpinionDraft): Promise<string>;
}

type PendingOpinion = OpinionDraft & {
  status: "pending";
  reviewedAt: null;
  reviewedBy: null;
  rejectionReason: null;
  publishedOpinionId: null;
};

export type OpinionServiceDependencies = {
  ensureAnonymousStudent: () => Promise<{ uid: string }>;
  submitProposal: (
    ownerUid: string,
    classId: ClassId,
    eventId: string,
    proposal: PendingOpinion,
  ) => Promise<string>;
};

export class OpinionSubmitError extends Error {
  readonly code: "validation" | "logout-required" | "parent-unavailable" | "submission-failed";

  constructor(code: OpinionSubmitError["code"], message: string) {
    super(message);
    this.name = "OpinionSubmitError";
    this.code = code;
  }
}

function normalizeSubmitError(error: unknown): OpinionSubmitError {
  if (error instanceof OpinionSubmitError) return error;
  if (typeof error === "object" && error !== null && "code" in error && error.code === "AUTH_ADMIN_SESSION_ACTIVE") {
    return new OpinionSubmitError("logout-required", "관리자 Google 로그인 상태입니다. 로그아웃 후 의견을 제출해 주세요.");
  }
  return new OpinionSubmitError("submission-failed", "의견 제출에 실패했습니다. 다시 시도해 주세요.");
}

export function createOpinionService(dependencies: OpinionServiceDependencies): Pick<OpinionGateway, "submit"> {
  return {
    async submit(classId, eventId, draft) {
      const target = opinionTargetSchema.safeParse({ classId, eventId });
      const parsedDraft = opinionDraftSchema.safeParse(draft);
      if (!target.success || !parsedDraft.success) {
        const issue = !target.success
          ? target.error.issues[0]
          : !parsedDraft.success
            ? parsedDraft.error.issues[0]
            : undefined;
        throw new OpinionSubmitError("validation", issue?.message ?? "의견 내용을 확인해 주세요.");
      }

      try {
        const user = await dependencies.ensureAnonymousStudent();
        return await dependencies.submitProposal(user.uid, target.data.classId as ClassId, target.data.eventId, {
          ...parsedDraft.data,
          status: "pending",
          reviewedAt: null,
          reviewedBy: null,
          rejectionReason: null,
          publishedOpinionId: null,
        });
      } catch (error) {
        throw normalizeSubmitError(error);
      }
    },
  };
}

export async function loadDefaultOpinionGateway(): Promise<OpinionGateway> {
  const { loadFirebaseOpinionGateway } = await import("./opinionFirebaseRuntime");
  return loadFirebaseOpinionGateway();
}

export type OpinionValidationResult = z.infer<typeof opinionDraftSchema>;
