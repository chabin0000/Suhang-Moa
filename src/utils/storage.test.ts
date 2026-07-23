import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonalSchedule } from "../types";
import { isClassId, parseClassId, toClassId } from "./classId";
import { loadSchedules, saveSchedules } from "./storage";

const SCHEDULES_KEY = "classmap:schedules";

const legacySchedule = {
  id: "legacy-1",
  grade: 2,
  classNo: 7,
  title: "Physics lab",
  subject: "Physics",
  description: "Bring a ruler",
  type: "material" as const,
  dueDate: "2026-07-24",
  createdAt: "2026-07-23T03:00:00.000Z",
};

const personalSchedule: PersonalSchedule = {
  ...legacySchedule,
  source: "personal",
};

describe("schedule storage migration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("adds the personal source to a valid legacy schedule without changing its fields", () => {
    window.localStorage.setItem(SCHEDULES_KEY, JSON.stringify([legacySchedule]));

    expect(loadSchedules()).toEqual([personalSchedule]);
  });

  it("writes a migrated schedule back once in the normalized format", () => {
    window.localStorage.setItem(SCHEDULES_KEY, JSON.stringify([legacySchedule]));
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    loadSchedules();

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(SCHEDULES_KEY, JSON.stringify([personalSchedule]));
  });

  it("round-trips a current personal schedule unchanged", () => {
    saveSchedules([personalSchedule]);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    expect(loadSchedules()).toEqual([personalSchedule]);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("skips invalid array members without dropping valid schedules", () => {
    window.localStorage.setItem(
      SCHEDULES_KEY,
      JSON.stringify([personalSchedule, { id: "missing-fields" }, "not-a-schedule"]),
    );

    expect(loadSchedules()).toEqual([personalSchedule]);
  });
});

describe("class ID conversion", () => {
  it("converts a selected class into a class ID", () => {
    expect(toClassId({ grade: 1, classNo: 2 })).toBe("grade-1-class-2");
  });

  it("parses a valid class ID into the selected class", () => {
    expect(parseClassId("grade-1-class-2")).toEqual({ grade: 1, classNo: 2 });
  });

  it.each([
    "grade-0-class-2",
    "grade-4-class-2",
    "grade-1-class-0",
    "grade-1-class-13",
  ])("rejects an out-of-range class ID: %s", (classId) => {
    expect(parseClassId(classId)).toBeNull();
    expect(isClassId(classId)).toBe(false);
  });
});
