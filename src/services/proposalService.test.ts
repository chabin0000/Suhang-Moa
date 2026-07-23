import { describe, expect, it, vi } from "vitest";
import type { ClassId, ProposalDraft } from "../types";
import {
  ProposalSubmitError,
  createProposalBatchService,
} from "./proposalService";

const classId = "grade-1-class-2" as ClassId;
const validDraft: ProposalDraft = {
  nickname: "Kim",
  title: "Physics report",
  subject: "Physics",
  description: "Measure spring oscillation.",
  type: "performance",
  dueDate: "2026-07-30",
};

describe("proposal batch service", () => {
  it.each([
    ["nickname", ""],
    ["nickname", "x".repeat(21)],
    ["title", ""],
    ["title", "x".repeat(81)],
    ["subject", "x".repeat(41)],
    ["description", "x".repeat(1001)],
    ["dueDate", "2026-02-29"],
  ] as const)("rejects invalid %s", async (field, value) => {
    const service = createProposalBatchService({
      ensureAnonymousStudent: vi.fn(),
      writeBatch: vi.fn(),
      createBatchId: () => "batch-1",
    });

    await expect(
      service.submitBatch(classId, [{ ...validDraft, [field]: value }]),
    ).rejects.toBeInstanceOf(ProposalSubmitError);
  });

  it("rejects batches outside one to ten proposals", async () => {
    const service = createProposalBatchService({
      ensureAnonymousStudent: vi.fn(),
      writeBatch: vi.fn(),
      createBatchId: () => "batch-1",
    });

    await expect(service.submitBatch(classId, [])).rejects.toBeInstanceOf(ProposalSubmitError);
    await expect(
      service.submitBatch(classId, Array.from({ length: 11 }, () => validDraft)),
    ).rejects.toBeInstanceOf(ProposalSubmitError);
  });

  it("uses one batch id and returns unique document ids after one write", async () => {
    const ensureAnonymousStudent = vi.fn().mockResolvedValue({ uid: "student-1" });
    const writeBatch = vi.fn().mockResolvedValue(["doc-1", "doc-2"]);
    const service = createProposalBatchService({
      ensureAnonymousStudent,
      writeBatch,
      createBatchId: () => "batch-1",
    });

    await expect(
      service.submitBatch(classId, [validDraft, { ...validDraft, title: "Math test" }]),
    ).resolves.toEqual(["doc-1", "doc-2"]);

    expect(ensureAnonymousStudent).toHaveBeenCalledTimes(1);
    expect(writeBatch).toHaveBeenCalledWith(
      "student-1",
      "batch-1",
      classId,
      expect.arrayContaining([
        expect.objectContaining({ status: "pending", reviewedAt: null, reviewedBy: null }),
      ]),
    );
    expect(writeBatch).toHaveBeenCalledTimes(1);
  });

  it("keeps Google admin signed in and returns a logout-required error", async () => {
    const service = createProposalBatchService({
      ensureAnonymousStudent: vi.fn().mockRejectedValue({ code: "AUTH_ADMIN_SESSION_ACTIVE" }),
      writeBatch: vi.fn(),
      createBatchId: () => "batch-1",
    });

    await expect(service.submitBatch(classId, [validDraft])).rejects.toMatchObject({
      code: "logout-required",
      message: expect.stringContaining("로그아웃"),
    });
  });
});
