import type { ClassId, SelectedClass } from "../types";

const CLASS_ID_PATTERN = /^grade-(\d+)-class-(\d+)$/;

export function toClassId(selectedClass: SelectedClass): ClassId {
  const classId = `grade-${selectedClass.grade}-class-${selectedClass.classNo}`;

  if (!isClassId(classId)) {
    throw new RangeError("grade must be 1-3 and classNo must be 1-12");
  }

  return classId;
}

export function parseClassId(classId: string): SelectedClass | null {
  const match = CLASS_ID_PATTERN.exec(classId);

  if (!match) {
    return null;
  }

  const grade = Number(match[1]);
  const classNo = Number(match[2]);

  if (grade < 1 || grade > 3 || classNo < 1 || classNo > 12) {
    return null;
  }

  return { grade, classNo };
}

export function isClassId(value: unknown): value is ClassId {
  return typeof value === "string" && parseClassId(value) !== null;
}
