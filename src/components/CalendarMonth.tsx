import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Schedule } from "../types";
import { scheduleTypeLabels } from "../types";
import { getCalendarDays, getMonthLabel } from "../utils/date";

type CalendarMonthProps = {
  activeMonth: Date;
  schedules: Schedule[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (dateKey: string) => void;
};

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarMonth({
  activeMonth,
  schedules,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: CalendarMonthProps) {
  const calendarDays = getCalendarDays(activeMonth);

  function schedulesForDate(dateKey: string) {
    return schedules.filter((schedule) => schedule.dueDate === dateKey);
  }

  return (
    <section className="calendar-section" aria-labelledby="calendar-title">
      <div className="calendar-toolbar">
        <button type="button" className="secondary-button" onClick={onPrevMonth}>
          <ChevronLeft size={18} aria-hidden="true" />
          이전 달
        </button>
        <h2 id="calendar-title">{getMonthLabel(activeMonth)}</h2>
        <button type="button" className="secondary-button" onClick={onNextMonth}>
          다음 달
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="calendar-grid" role="grid" aria-label="월간 캘린더">
        {weekdays.map((weekday) => (
          <div key={weekday} className="weekday-cell" role="columnheader">
            {weekday}
          </div>
        ))}

        {calendarDays.map((day) => {
          const daySchedules = schedulesForDate(day.dateKey);
          const visibleSchedules = daySchedules.slice(0, 2);

          return (
            <button
              key={day.dateKey}
              type="button"
              className={[
                "date-cell",
                day.isCurrentMonth ? "" : "is-muted",
                day.isToday ? "is-today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDate(day.dateKey)}
              title={`${day.dateKey} 일정 추가`}
            >
              <span className="date-number">{day.dayNumber}</span>
              <span className="date-events">
                {visibleSchedules.map((schedule) => (
                  <span key={schedule.id} className={`event-pill type-${schedule.type}`}>
                    {schedule.title}
                    <small>{scheduleTypeLabels[schedule.type]}</small>
                  </span>
                ))}
                {daySchedules.length > 2 && (
                  <span className="more-count">+{daySchedules.length - 2}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
