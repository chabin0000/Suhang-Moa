import type {
  CalendarItem,
  PersonalSchedule,
  SelectedClass,
  SharedEvent,
} from "../types";
import { toClassId } from "./classId";

export function isPersonalSchedule(
  item: CalendarItem,
): item is PersonalSchedule {
  return item.source === "personal";
}

export function isSharedEvent(item: CalendarItem): item is SharedEvent {
  return item.source === "shared";
}

export function getCalendarItemsForClass(
  personal: PersonalSchedule[],
  shared: SharedEvent[],
  selectedClass: SelectedClass,
): CalendarItem[] {
  const classId = toClassId(selectedClass);
  const personalForClass = personal.filter(
    (item) =>
      item.grade === selectedClass.grade &&
      item.classNo === selectedClass.classNo,
  );
  const sharedForClass = shared.filter((item) => item.classId === classId);

  return [...personalForClass, ...sharedForClass].sort((left, right) => {
    return (
      left.dueDate.localeCompare(right.dueDate) ||
      left.title.localeCompare(right.title) ||
      `${left.source}:${left.id}`.localeCompare(`${right.source}:${right.id}`)
    );
  });
}
