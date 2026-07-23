import type { ScheduleType, SelectedClass } from "../types";

type ClassId = `grade-${1 | 2 | 3}-class-${number}`;
type ProposalStatus = "pending" | "approved" | "rejected";

export interface PersonalSchedule {
  source: "personal";
  id: string;
  grade: number;
  classNo: number;
  title: string;
  subject?: string;
  description?: string;
  type: ScheduleType;
  dueDate: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SharedEvent {
  source: "shared";
  id: string;
  classId: ClassId;
  title: string;
  subject?: string;
  description?: string;
  type: ScheduleType;
  dueDate: string;
  status: "published";
}

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

export function createSelectedClass(
  overrides: Partial<SelectedClass> = {},
): SelectedClass {
  return { grade: 1, classNo: 1, ...overrides };
}

export function createPersonalSchedule(
  overrides: Partial<PersonalSchedule> = {},
): PersonalSchedule {
  return {
    source: "personal",
    id: "personal-schedule-1",
    grade: 1,
    classNo: 1,
    title: "Fixed personal schedule",
    subject: "Math",
    description: "Deterministic test fixture",
    type: "performance",
    dueDate: "2026-03-02",
    createdAt: "2026-03-01T09:00:00.000Z",
    ...overrides,
  };
}

export function createSharedEvent(
  overrides: Partial<SharedEvent> = {},
): SharedEvent {
  return {
    source: "shared",
    id: "shared-event-1",
    classId: "grade-1-class-1",
    title: "Fixed shared event",
    subject: "Science",
    description: "Deterministic test fixture",
    type: "exam",
    dueDate: "2026-03-03",
    status: "published",
    ...overrides,
  };
}

export function createScheduleProposal(
  overrides: Partial<ScheduleProposal> = {},
): ScheduleProposal {
  return {
    id: "schedule-proposal-1",
    batchId: "batch-1",
    ownerUid: "student-uid-1",
    classId: "grade-1-class-1",
    nickname: "Student",
    title: "Fixed proposed schedule",
    subject: "Korean",
    description: "Deterministic test fixture",
    type: "homework",
    dueDate: "2026-03-04",
    status: "pending",
    createdAt: new Date("2026-03-01T09:00:00.000Z"),
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    publishedEventId: null,
    ...overrides,
  };
}
