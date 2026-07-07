export const SCHEDULE_TYPES = [
  "performance",
  "exam",
  "homework",
  "material",
  "etc",
] as const;

export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export type SelectedClass = {
  grade: number;
  classNo: number;
};

export type Schedule = {
  id: string;
  grade: number;
  classNo: number;
  title: string;
  subject?: string;
  description?: string;
  type: ScheduleType;
  dueDate: string;
  createdAt: string;
};

export type ScheduleDraft = {
  title: string;
  subject: string;
  description: string;
  type: ScheduleType;
  dueDate: string;
};

export type SummaryFilter = "today" | "tomorrow" | "week" | null;

export const scheduleTypeLabels: Record<ScheduleType, string> = {
  performance: "수행평가",
  exam: "지필평가",
  homework: "일반과제",
  material: "준비물",
  etc: "기타",
};
