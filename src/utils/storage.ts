import type { PersonalSchedule, ScheduleType, SelectedClass } from "../types";
import { SCHEDULE_TYPES } from "../types";

const SELECTED_CLASS_KEY = "classmap:selectedClass";
const SCHEDULES_KEY = "classmap:schedules";

function readJson<T>(key: string, fallback: T): T {
  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    // 저장값이 깨졌을 때 앱 전체가 멈추지 않도록 기본값으로 복구한다.
    return fallback;
  }
}

function isSelectedClass(value: unknown): value is SelectedClass {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as SelectedClass;
  return (
    Number.isInteger(candidate.grade) &&
    candidate.grade >= 1 &&
    candidate.grade <= 3 &&
    Number.isInteger(candidate.classNo) &&
    candidate.classNo >= 1 &&
    candidate.classNo <= 12
  );
}

function isScheduleType(value: unknown): value is ScheduleType {
  return typeof value === "string" && SCHEDULE_TYPES.includes(value as ScheduleType);
}

function isPersonalSchedule(value: unknown): value is PersonalSchedule {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    Number.isInteger(candidate.grade) &&
    Number.isInteger(candidate.classNo) &&
    typeof candidate.title === "string" &&
    isScheduleType(candidate.type) &&
    typeof candidate.dueDate === "string" &&
    typeof candidate.createdAt === "string" &&
    candidate.source === "personal" &&
    (candidate.subject === undefined || typeof candidate.subject === "string") &&
    (candidate.description === undefined || typeof candidate.description === "string") &&
    (candidate.updatedAt === undefined || typeof candidate.updatedAt === "string")
  );
}

function isLegacySchedule(value: unknown): value is Omit<PersonalSchedule, "source"> {
  if (!value || typeof value !== "object" || "source" in value) {
    return false;
  }

  return isPersonalSchedule({ ...value, source: "personal" });
}

export function getSelectedClass(): SelectedClass | null {
  const savedClass = readJson<unknown>(SELECTED_CLASS_KEY, null);
  return isSelectedClass(savedClass) ? savedClass : null;
}

export function saveSelectedClass(selectedClass: SelectedClass): void {
  window.localStorage.setItem(SELECTED_CLASS_KEY, JSON.stringify(selectedClass));
}

export function loadSchedules(): PersonalSchedule[] {
  const savedSchedules = readJson<unknown>(SCHEDULES_KEY, []);

  if (!Array.isArray(savedSchedules)) {
    return [];
  }

  let didMigrate = false;
  const schedules = savedSchedules.flatMap((value): PersonalSchedule[] => {
    if (isPersonalSchedule(value)) {
      return [value];
    }

    if (isLegacySchedule(value)) {
      didMigrate = true;
      return [{ ...value, source: "personal" }];
    }

    return [];
  });

  if (didMigrate) {
    window.localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
  }

  return schedules;
}

export function getSchedules(): PersonalSchedule[] {
  return loadSchedules();
}

export function saveSchedules(schedules: PersonalSchedule[]): void {
  window.localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
}

export function createScheduleId(): string {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
