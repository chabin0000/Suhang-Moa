import { z } from "zod";
import { scheduleTypeSchema, isRealIsoDate } from "./schedule";
import type { ClassId, ProposalStatus, ScheduleType } from "../types";

export interface ScheduleProposal {
  id: string;
  batchId: string;
  ownerUid: string;
  classId: ClassId;
  nickname: string;
  title: string;
  subject: string;
  description: string;
  type: ScheduleType;
  dueDate: string;
  status: ProposalStatus;
  createdAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  publishedEventId: string | null;
}

const classIdSchema = z.string().regex(/^grade-[123]-class-[1-9]\d*$/);

export const proposalDraftSchema = z
  .object({
    nickname: z.string().trim().min(1, "별명을 입력해 주세요.").max(20),
    title: z.string().trim().min(1, "제목을 입력해 주세요.").max(80),
    subject: z.string().trim().max(40),
    description: z.string().trim().max(1000),
    type: scheduleTypeSchema,
    dueDate: z.string().refine(isRealIsoDate, "유효한 날짜를 입력해 주세요."),
  })
  .strict();

export const proposalBatchSchema = z.array(proposalDraftSchema).min(1).max(10);

const firestoreDateSchema = z
  .custom<{ toDate: () => Date }>(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof value.toDate === "function" &&
      value.toDate() instanceof Date,
  )
  .transform((timestamp) => timestamp.toDate());

export const storedProposalSchema = z
  .object({
    batchId: z.string().min(1),
    ownerUid: z.string().min(1),
    classId: classIdSchema,
    nickname: z.string().trim().min(1).max(20),
    title: z.string().trim().min(1).max(80),
    subject: z.string().trim().max(40),
    description: z.string().trim().max(1000),
    type: scheduleTypeSchema,
    dueDate: z.string().refine(isRealIsoDate),
    status: z.enum(["pending", "approved", "rejected"]),
    createdAt: firestoreDateSchema.nullable(),
    reviewedAt: firestoreDateSchema.nullable(),
    reviewedBy: z.string().nullable(),
    rejectionReason: z.string().max(1000).nullable(),
    publishedEventId: z.string().nullable(),
  })
  .strict();
