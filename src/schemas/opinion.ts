import { z } from "zod";
import { isClassId } from "../utils/classId";
import type { ClassId } from "../types";

export interface OpinionDraft {
  nickname: string;
  content: string;
}

export interface PublishedOpinion extends OpinionDraft {
  id: string;
  sourceProposalId: string;
  status: "published";
  approvedAt: Date | null;
}

export interface OpinionProposal extends OpinionDraft {
  id: string;
  classId: ClassId;
  eventId: string;
  ownerUid: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  publishedOpinionId: string | null;
}

const firestoreDateSchema = z
  .custom<{ toDate: () => Date }>(
    (value) => typeof value === "object" && value !== null && "toDate" in value &&
      typeof value.toDate === "function" && value.toDate() instanceof Date,
  )
  .transform((timestamp) => timestamp.toDate());

export const opinionDraftSchema = z.object({
  nickname: z.string().trim().min(1, "별명을 입력해 주세요.").max(20, "별명은 20자 이하여야 합니다."),
  content: z.string().trim().min(1, "내용을 입력해 주세요.").max(500, "내용은 500자 이하여야 합니다."),
}).strict();

export const opinionTargetSchema = z.object({
  classId: z.string().refine(isClassId, "유효한 반 정보가 아닙니다."),
  eventId: z.string().trim().min(1).max(150),
}).strict();

export const storedPublishedOpinionSchema = z.object({
  nickname: z.string().trim().min(1).max(20),
  content: z.string().trim().min(1).max(500),
  sourceProposalId: z.string().min(1),
  status: z.literal("published"),
  approvedAt: firestoreDateSchema.nullable(),
}).strict();

export const storedOpinionProposalSchema = z.object({
  classId: z.string().refine(isClassId),
  eventId: z.string().trim().min(1).max(150),
  ownerUid: z.string().min(1),
  nickname: z.string().trim().min(1).max(20),
  content: z.string().trim().min(1).max(500),
  status: z.enum(["pending", "approved", "rejected"]),
  createdAt: firestoreDateSchema.nullable(),
  reviewedAt: firestoreDateSchema.nullable(),
  reviewedBy: z.string().nullable(),
  rejectionReason: z.string().max(1000).nullable(),
  publishedOpinionId: z.string().nullable(),
}).strict();
