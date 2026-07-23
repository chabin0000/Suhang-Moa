import { describe, expect, it } from "vitest";
import type { PersonalSchedule, SharedEvent } from "../types";
import {
  getCalendarItemsForClass,
  isPersonalSchedule,
  isSharedEvent,
} from "./calendarItems";

function personal(
  overrides: Partial<PersonalSchedule> = {},
): PersonalSchedule {
  return {
    source: "personal",
    id: "personal-1",
    grade: 1,
    classNo: 2,
    title: "개인 일정",
    type: "homework",
    dueDate: "2026-07-25",
    createdAt: "2026-07-23T00:00:00.000Z",
    ...overrides,
  };
}

function shared(overrides: Partial<SharedEvent> = {}): SharedEvent {
  return {
    source: "shared",
    id: "shared-1",
    classId: "grade-1-class-2",
    title: "반 일정",
    type: "exam",
    dueDate: "2026-07-25",
    status: "published",
    ...overrides,
  };
}

describe("getCalendarItemsForClass", () => {
  it("선택한 학년과 반의 개인 일정 및 정확히 일치하는 반 일정만 합친다", () => {
    const includedPersonal = personal();
    const includedShared = shared();

    const result = getCalendarItemsForClass(
      [
        includedPersonal,
        personal({ id: "wrong-grade", grade: 2 }),
        personal({ id: "wrong-class", classNo: 3 }),
      ],
      [
        includedShared,
        shared({ id: "wrong-shared-class", classId: "grade-1-class-3" }),
      ],
      { grade: 1, classNo: 2 },
    );

    expect(result).toEqual([includedPersonal, includedShared]);
    expect(result.filter(isPersonalSchedule)).toEqual([includedPersonal]);
    expect(result.filter(isSharedEvent)).toEqual([includedShared]);
  });

  it("마감일, 제목, source:id 순서로 정렬하고 출처가 다른 같은 ID를 유지한다", () => {
    const samePersonal = personal({
      id: "same-id",
      title: "같은 제목",
      dueDate: "2026-07-25",
    });
    const sameShared = shared({
      id: "same-id",
      title: "같은 제목",
      dueDate: "2026-07-25",
    });
    const titleFirst = shared({
      id: "title-first",
      title: "가장 빠른 제목",
      dueDate: "2026-07-25",
    });
    const dateFirst = personal({
      id: "date-first",
      title: "늦은 제목",
      dueDate: "2026-07-24",
    });

    const result = getCalendarItemsForClass(
      [samePersonal, dateFirst],
      [sameShared, titleFirst],
      { grade: 1, classNo: 2 },
    );

    expect(result).toEqual([
      dateFirst,
      titleFirst,
      samePersonal,
      sameShared,
    ]);
    expect(result.filter((item) => item.id === "same-id")).toHaveLength(2);
  });

  it("입력 배열의 순서나 객체를 변경하지 않는다", () => {
    const personalItems = [
      personal({ id: "later", dueDate: "2026-07-26" }),
      personal({ id: "earlier", dueDate: "2026-07-24" }),
    ];
    const sharedItems = [shared()];
    const personalSnapshot = structuredClone(personalItems);
    const sharedSnapshot = structuredClone(sharedItems);

    const result = getCalendarItemsForClass(
      personalItems,
      sharedItems,
      { grade: 1, classNo: 2 },
    );

    expect(personalItems).toEqual(personalSnapshot);
    expect(sharedItems).toEqual(sharedSnapshot);
    expect(result[0]).not.toBe(personalItems[0]);
    expect(result[0]).toBe(personalItems[1]);
  });
});
