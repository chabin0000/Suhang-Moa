import { RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SharedScheduleErrorCode } from "../services/sharedScheduleService";
import { loadDefaultProposalBatchSubmitter } from "../services/proposalService";
import type {
  CalendarItem,
  ClassId,
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
import AddScheduleMenu from "./AddScheduleMenu";
import ProposalModal from "./ProposalModal";
import ProposalStatusPanel from "./ProposalStatusPanel";
import ScheduleList from "./ScheduleList";
import ScheduleModal from "./ScheduleModal";
import SummaryWidgets from "./SummaryWidgets";

type ClassDashboardProps = {
  selectedClass: SelectedClass;
  sharedEvents: SharedEvent[];
  sharedScheduleLoading?: boolean;
  sharedScheduleError?: SharedScheduleErrorCode | null;
  onChangeClass: () => void;
};

type ModalState =
  | { mode: "create"; defaultDate: string }
  | { mode: "edit"; schedule: PersonalSchedule }
  | null;

export default function ClassDashboard({
  selectedClass,
  sharedEvents,
  sharedScheduleLoading = false,
  sharedScheduleError = null,
  onChangeClass,
}: ClassDashboardProps) {
  const [personalSchedules, setPersonalSchedules] = useState<PersonalSchedule[]>(
    () => getSchedules(),
  );
  const [activeMonth, setActiveMonth] = useState(() => new Date());
  const [activeFilter, setActiveFilter] = useState<SummaryFilter>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);

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

      {sharedScheduleError ? (
        <p
          className="shared-schedule-notice"
          data-state={sharedScheduleError}
          role={sharedScheduleError === "firebase-disabled" ? "status" : "alert"}
        >
          {
            {
              "firebase-disabled": "공유 일정 연결이 꺼져 있습니다.",
              "permission-denied": "공유 일정 열람 권한이 없습니다.",
              network:
                "공유 일정을 불러오지 못했습니다. 네트워크를 확인해 주세요.",
            }[sharedScheduleError]
          }
        </p>
      ) : sharedScheduleLoading ? (
        <p className="shared-schedule-notice" data-state="loading" role="status">
          반 일정을 불러오는 중입니다.
        </p>
      ) : null}

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

      <ProposalStatusPanel />
      <AddScheduleMenu
        onAddPersonal={() => openCreateModal()}
        onProposeClass={() => setProposalOpen(true)}
      />

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
      {proposalOpen && (
        <ProposalModal
          classId={`grade-${selectedClass.grade as 1 | 2 | 3}-class-${selectedClass.classNo}` as ClassId}
          onCancel={() => setProposalOpen(false)}
          submitBatch={async (classId, drafts) => {
            const submitBatch = await loadDefaultProposalBatchSubmitter();
            return submitBatch(classId, drafts);
          }}
        />
      )}
    </section>
  );
}
