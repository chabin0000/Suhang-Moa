import { Trash2 } from "lucide-react";
import type { Schedule, SummaryFilter } from "../types";
import { scheduleTypeLabels } from "../types";
import { formatKoreanDate } from "../utils/date";

type ScheduleListProps = {
  schedules: Schedule[];
  activeFilter: SummaryFilter;
  onClearFilter: () => void;
  onDeleteSchedule: (scheduleId: string) => void;
};

const filterLabels: Record<Exclude<SummaryFilter, null>, string> = {
  today: "오늘 마감",
  tomorrow: "내일 마감",
  week: "이번 주 일정",
};

export default function ScheduleList({
  schedules,
  activeFilter,
  onClearFilter,
  onDeleteSchedule,
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

      {schedules.length === 0 ? (
        <div className="empty-state">
          <strong>표시할 일정이 없습니다.</strong>
          <p>오른쪽 아래 + 버튼이나 달력 날짜를 눌러 일정을 추가해 보세요.</p>
        </div>
      ) : (
        <div className="schedule-items">
          {schedules.map((schedule) => (
            <article key={schedule.id} className="schedule-card">
              <div className="schedule-card-main">
                <span className={`type-badge type-${schedule.type}`}>
                  {scheduleTypeLabels[schedule.type]}
                </span>
                <h3>{schedule.title}</h3>
                <dl>
                  <div>
                    <dt>과목</dt>
                    <dd>{schedule.subject || "미입력"}</dd>
                  </div>
                  <div>
                    <dt>마감일</dt>
                    <dd>{formatKoreanDate(schedule.dueDate)}</dd>
                  </div>
                </dl>
                {schedule.description && <p>{schedule.description}</p>}
              </div>

              <button
                type="button"
                className="destructive-button"
                onClick={() => onDeleteSchedule(schedule.id)}
              >
                <Trash2 size={16} aria-hidden="true" />
                삭제
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
