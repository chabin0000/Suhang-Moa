import { Pencil, Trash2 } from "lucide-react";
import type {
  CalendarItem,
  PersonalSchedule,
  SummaryFilter,
} from "../types";
import { scheduleTypeLabels } from "../types";
import { isPersonalSchedule } from "../utils/calendarItems";
import { formatKoreanDate } from "../utils/date";

type ScheduleListProps = {
  items: CalendarItem[];
  activeFilter: SummaryFilter;
  selectedItemKey: string | null;
  onClearFilter: () => void;
  onEditPersonal: (schedule: PersonalSchedule) => void;
  onDeletePersonal: (scheduleId: string) => void;
};

const filterLabels: Record<Exclude<SummaryFilter, null>, string> = {
  today: "오늘 마감",
  tomorrow: "내일 마감",
  week: "이번 주 일정",
};

export default function ScheduleList({
  items,
  activeFilter,
  selectedItemKey,
  onClearFilter,
  onEditPersonal,
  onDeletePersonal,
}: ScheduleListProps) {
  return (
    <section className="schedule-list" aria-labelledby="schedule-list-title">
      <div className="list-header">
        <div>
          <p className="overline">Tasks</p>
          <h2 id="schedule-list-title">일정 목록</h2>
        </div>
        {activeFilter && (
          <button type="button" className="ghost-button" onClick={onClearFilter}>
            {filterLabels[activeFilter]} 필터 해제
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <strong>표시할 일정이 없습니다.</strong>
          <p>오른쪽 아래 + 버튼이나 달력 날짜를 눌러 일정을 추가해 보세요.</p>
        </div>
      ) : (
        <div className="schedule-items">
          {items.map((item) => {
            const itemKey = `${item.source}:${item.id}`;
            const personal = isPersonalSchedule(item);

            return (
              <article
                key={itemKey}
                id={`calendar-item-${itemKey}`}
                className={`schedule-card ${selectedItemKey === itemKey ? "is-selected" : ""}`}
                tabIndex={-1}
              >
                <div className="schedule-card-main">
                  <div className="schedule-badges">
                    <span className={`type-badge type-${item.type}`}>
                      {scheduleTypeLabels[item.type]}
                    </span>
                    <span className={`source-badge source-${item.source}`}>
                      {personal ? "내 일정" : "반 일정"}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <dl>
                    <div>
                      <dt>과목</dt>
                      <dd>{item.subject || "미입력"}</dd>
                    </div>
                    <div>
                      <dt>마감일</dt>
                      <dd>{formatKoreanDate(item.dueDate)}</dd>
                    </div>
                  </dl>
                  {item.description && <p>{item.description}</p>}
                </div>

                {personal && (
                  <div className="schedule-card-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onEditPersonal(item)}
                    >
                      <Pencil size={16} aria-hidden="true" />
                      수정
                    </button>
                    <button
                      type="button"
                      className="destructive-button"
                      onClick={() => onDeletePersonal(item.id)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      삭제
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
