import { CalendarPlus, RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";
import type { Schedule, ScheduleDraft, SelectedClass, SummaryFilter } from "../types";
import { getTodayKey, getTomorrowKey, isWithinNextDays, moveMonth } from "../utils/date";
import { createScheduleId, getSchedules, saveSchedules } from "../utils/storage";
import CalendarMonth from "./CalendarMonth";
import ScheduleList from "./ScheduleList";
import ScheduleModal from "./ScheduleModal";
import SummaryWidgets from "./SummaryWidgets";

type ClassDashboardProps = {
  selectedClass: SelectedClass;
  onChangeClass: () => void;
};

type ModalState = {
  isOpen: boolean;
  dueDate: string;
};

export default function ClassDashboard({
  selectedClass,
  onChangeClass,
}: ClassDashboardProps) {
  const [allSchedules, setAllSchedules] = useState<Schedule[]>(() => getSchedules());
  const [activeMonth, setActiveMonth] = useState(() => new Date());
  const [activeFilter, setActiveFilter] = useState<SummaryFilter>(null);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    dueDate: getTodayKey(),
  });

  const classSchedules = useMemo(() => {
    return allSchedules
      .filter(
        (schedule) =>
          schedule.grade === selectedClass.grade &&
          schedule.classNo === selectedClass.classNo,
      )
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  }, [allSchedules, selectedClass.classNo, selectedClass.grade]);

  const summaryCounts = useMemo(() => {
    const todayKey = getTodayKey();
    const tomorrowKey = getTomorrowKey();

    return {
      today: classSchedules.filter((schedule) => schedule.dueDate === todayKey).length,
      tomorrow: classSchedules.filter((schedule) => schedule.dueDate === tomorrowKey)
        .length,
      week: classSchedules.filter((schedule) => isWithinNextDays(schedule.dueDate, 7))
        .length,
    };
  }, [classSchedules]);

  const filteredSchedules = useMemo(() => {
    const todayKey = getTodayKey();
    const tomorrowKey = getTomorrowKey();

    if (activeFilter === "today") {
      return classSchedules.filter((schedule) => schedule.dueDate === todayKey);
    }

    if (activeFilter === "tomorrow") {
      return classSchedules.filter((schedule) => schedule.dueDate === tomorrowKey);
    }

    if (activeFilter === "week") {
      return classSchedules.filter((schedule) => isWithinNextDays(schedule.dueDate, 7));
    }

    return classSchedules;
  }, [activeFilter, classSchedules]);

  function openScheduleModal(dueDate = getTodayKey()) {
    setModalState({ isOpen: true, dueDate });
  }

  function closeScheduleModal() {
    setModalState((current) => ({ ...current, isOpen: false }));
  }

  function handleSaveSchedule(draft: ScheduleDraft) {
    const nextSchedule: Schedule = {
      ...draft,
      id: createScheduleId(),
      grade: selectedClass.grade,
      classNo: selectedClass.classNo,
      createdAt: new Date().toISOString(),
    };

    const nextSchedules = [...allSchedules, nextSchedule];
    setAllSchedules(nextSchedules);
    saveSchedules(nextSchedules);
    closeScheduleModal();
  }

  function handleDeleteSchedule(scheduleId: string) {
    const shouldDelete = window.confirm("이 일정을 삭제할까요?");

    if (!shouldDelete) {
      return;
    }

    const nextSchedules = allSchedules.filter((schedule) => schedule.id !== scheduleId);
    setAllSchedules(nextSchedules);
    saveSchedules(nextSchedules);
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
        schedules={classSchedules}
        onPrevMonth={() => setActiveMonth((current) => moveMonth(current, -1))}
        onNextMonth={() => setActiveMonth((current) => moveMonth(current, 1))}
        onSelectDate={openScheduleModal}
      />

      <ScheduleList
        schedules={filteredSchedules}
        activeFilter={activeFilter}
        onClearFilter={() => setActiveFilter(null)}
        onDeleteSchedule={handleDeleteSchedule}
      />

      <button
        type="button"
        className="floating-add-button"
        onClick={() => openScheduleModal()}
        aria-label="일정 추가"
        title="일정 추가"
      >
        <CalendarPlus size={21} aria-hidden="true" />
        일정 추가
      </button>

      <ScheduleModal
        isOpen={modalState.isOpen}
        defaultDueDate={modalState.dueDate}
        onClose={closeScheduleModal}
        onSave={handleSaveSchedule}
      />
    </section>
  );
}
