export const SCHEDULE_TYPES = [
  "performance",
  "exam",
  "homework",
  "material",
  "etc",
] as const;

export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export type ClassId = `grade-${1 | 2 | 3}-class-${number}`;

export type SelectedClass = {
  grade: number;
  classNo: number;
};

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

export type CalendarItem = PersonalSchedule | SharedEvent;

// Task 3에서 화면 컴포넌트를 PersonalSchedule로 직접 전환할 때 제거한다.
export type Schedule = PersonalSchedule;

export interface ScheduleDraft {
  title: string;
  subject: string;
  description: string;
  type: ScheduleType;
  dueDate: string;
}

export interface ProposalDraft extends ScheduleDraft {
  nickname: string;
}

export type ProposalStatus = "pending" | "approved" | "rejected";
export type ModerationRole = "super_admin" | "class_admin";

export interface AdminScope {
  role: ModerationRole;
  classIds: ClassId[];
}

export type SummaryFilter = "today" | "tomorrow" | "week" | null;

export const scheduleTypeLabels: Record<ScheduleType, string> = {
  performance: "수행평가",
  exam: "지필평가",
  homework: "일반과제",
  material: "준비물",
  etc: "기타",
};
