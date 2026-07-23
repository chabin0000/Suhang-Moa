import { z } from "zod";
import { scheduleDraftSchema } from "./schedule";
import { isClassId } from "../utils/classId";
import type { ClassId, ScheduleDraft } from "../types";
import { storedOpinionProposalSchema } from "./opinion";
import { storedProposalSchema } from "./proposal";

const documentIdSchema = z.string().min(1).max(150).refine(
  (value) => value === value.trim() && value !== "." && value !== ".." && !value.includes("/"),
);
const classIdSchema = z.string().refine(isClassId);

export interface PublishScheduleInput extends ScheduleDraft {
  proposalId: string;
  classId: ClassId;
}

export type ApproveOpinionInput = {
  proposalId: string;
  classId: ClassId;
  eventId: string;
};

export type RejectProposalInput = {
  proposalId: string;
  classId: ClassId;
  reason: string;
};

export type ArchiveEventInput = {
  classId: ClassId;
  eventId: string;
};

export interface ModerationResult {
  status: "approved" | "rejected" | "archived" | "already-processed";
  publicId?: string;
}

export const publishScheduleInputSchema = scheduleDraftSchema.extend({
  proposalId: documentIdSchema,
  classId: classIdSchema,
}).strict();

export const approveOpinionInputSchema = z.object({
  proposalId: documentIdSchema,
  classId: classIdSchema,
  eventId: documentIdSchema,
}).strict();

export const rejectionInputSchema = z.object({
  proposalId: documentIdSchema,
  classId: classIdSchema,
  reason: z.string().trim().min(1).max(300),
}).strict();

export const archiveEventInputSchema = z.object({
  classId: classIdSchema,
  eventId: documentIdSchema,
}).strict();

export const moderationScheduleQueueRowSchema = storedProposalSchema;
export const moderationOpinionQueueRowSchema = storedOpinionProposalSchema;
