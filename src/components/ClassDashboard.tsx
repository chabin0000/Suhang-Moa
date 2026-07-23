import { CalendarPlus, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  CalendarItem,
  PersonalSchedule,
  ScheduleDraft,
  SelectedClass,
  SharedEvent,
  SummaryFilter,
} from "../types";
import { getCalendarItemsForClass } from "../utils/calendarItems";
import { getTodayKey, getTomorrowKey, isWithinNextDays, moveMonth } from "../utils/date";
import { createScheduleId, getSchedules, saveSchedules } from "../utils/storage";
import CalendarMonth from "./CalendarMonth";
import ScheduleList from "./ScheduleList";
import ScheduleModal from "./ScheduleModal";
import SummaryWidgets from "./SummaryWidgets";

type ClassDashboardProps = {
  selectedClass: SelectedClass;
  sharedEvents: SharedEvent[];
  onChangeClass: () => void;
};

type ModalState =
  | { mode: "create"; defaultDate: string }
  | { mode: "edit"; schedule: PersonalSchedule }
  | null;

export default function ClassDashboard({
  selectedClass,
  sharedEvents,
  onChangeClass,
}: ClassDashboardProps) {
  const [personalSchedules, setPersonalSchedules] = useState<PersonalSchedule[]>(
    () => getSchedules(),
  );
  const [activeMonth, setActiveMonth] = useState(() => new Date());
  const [activeFilter, setActiveFilter] = useState<SummaryFilter>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);

  const calendarItems = useMemo(
    () =>
      getCalendarItemsForClass(
        personalSchedules,
        sharedEvents,
        selectedClass,
      ),
    [personalSchedules, selectedClass, sharedEvents],
  );

  const summaryCounts = useMemo(() => {
    const todayKey = getTodayKey();
    const tomorrowKey = getTomorrowKey();

    return {
      today: calendarItems.filter((item) => item.dueDate === todayKey).length,
      tomorrow: calendarItems.filter((item) => item.dueDate === tomorrowKey)
        .length,
      week: calendarItems.filter((item) => isWithinNextDays(item.dueDate, 7))
        .length,
    };
  }, [calendarItems]);

  const filteredItems = useMemo(() => {
    const todayKey = getTodayKey();
    const tomorrowKey = getTomorrowKey();

    if (activeFilter === "today") {
      return calendarItems.filter((item) => item.dueDate === todayKey);
    }

    if (activeFilter === "tomorrow") {
      return calendarItems.filter((item) => item.dueDate === tomorrowKey);
    }

    if (activeFilter === "week") {
      return calendarItems.filter((item) => isWithinNextDays(item.dueDate, 7));
    }

    return calendarItems;
  }, [activeFilter, calendarItems]);

  useEffect(() => {
    if (!selectedItemKey) {
      return;
    }

    const card = document.getElementById(`calendar-item-${selectedItemKey}`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    card?.focus({ preventScroll: true });
  }, [filteredItems, selectedItemKey]);

  function openCreateModal(defaultDate = getTodayKey()) {
    setModalState({ mode: "create", defaultDate });
  }

  function openEditModal(schedule: PersonalSchedule) {
    setModalState({ mode: "edit", schedule });
  }

  function closeScheduleModal() {
    setModalState(null);
  }

  function addPersonalSchedule(draft: ScheduleDraft): void {
    const nextSchedule: PersonalSchedule = {
      ...draft,
      source: "personal",
      id: createScheduleId(),
      grade: selectedClass.grade,
      classNo: selectedClass.classNo,
      createdAt: new Date().toISOString(),
    };

    const nextSchedules = [...personalSchedules, nextSchedule];
    setPersonalSchedules(nextSchedules);
    saveSchedules(nextSchedules);
    closeScheduleModal();
  }

  function updatePersonalSchedule(id: string, draft: ScheduleDraft): void {
    const nextSchedules = personalSchedules.map((schedule) =>
      schedule.id === id
        ? {
            ...schedule,
            ...draft,
            updatedAt: new Date().toISOString(),
          }
        : schedule,
    );

    setPersonalSchedules(nextSchedules);
    saveSchedules(nextSchedules);
    closeScheduleModal();
  }

  function deletePersonalSchedule(id: string): void {
    const shouldDelete = window.confirm("이 일정을 삭제할까요?");

    if (!shouldDelete) {
      return;
    }

    const nextSchedules = personalSchedules.filter((schedule) => schedule.id !== id);
    setPersonalSchedules(nextSchedules);
    saveSchedules(nextSchedules);
  }

  function openCalendarItem(item: CalendarItem): void {
    setActiveFilter(null);
    setSelectedItemKey(`${item.source}:${item.id}`);
  }

  function submitModal(draft: ScheduleDraft): void {
    if (modalState?.mode === "edit") {
      updatePersonalSchedule(modalState.schedule.id, draft);
      return;
    }

    addPersonalSchedule(draft);
  }

  return (
    <section className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="overline">ClassMap board</p>
          <h1>
            {selectedClass.grade}학년 {selectedClass.classNo}반 ClassMap
          </h1>
        </div>
        <button type="button" className="secondary-button" onClick={onChangeClass}>
          <RefreshCcw size={17} aria-hidden="true" />
          반 변경
        </button>
      </header>

      <SummaryWidgets
        counts={summaryCounts}
        activeFilter={activeFilter}
        onChangeFilter={setActiveFilter}
      />

      <CalendarMonth
        activeMonth={activeMonth}
        items={calendarItems}
        onPrevMonth={() => setActiveMonth((current) => moveMonth(current, -1))}
        onNextMonth={() => setActiveMonth((current) => moveMonth(current, 1))}
        onSelectDate={openCreateModal}
        onSelectItem={openCalendarItem}
      />

      <ScheduleList
        items={filteredItems}
        activeFilter={activeFilter}
        selectedItemKey={selectedItemKey}
        onClearFilter={() => setActiveFilter(null)}
        onEditPersonal={openEditModal}
        onDeletePersonal={deletePersonalSchedule}
      />

      <button
        type="button"
        className="floating-add-button"
        onClick={() => openCreateModal()}
        aria-label="일정 추가"
        title="일정 추가"
      >
        <CalendarPlus size={21} aria-hidden="true" />
        일정 추가
      </button>

      {modalState && (
        <ScheduleModal
          mode={modalState.mode}
          initialValue={
            modalState.mode === "edit" ? modalState.schedule : undefined
          }
          defaultDate={
            modalState.mode === "create" ? modalState.defaultDate : undefined
          }
          onCancel={closeScheduleModal}
          onSubmit={submitModal}
        />
      )}
    </section>
  );
}
