import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarItem } from "../types";
import { getCalendarDays, getMonthLabel } from "../utils/date";

type CalendarMonthProps = {
  activeMonth: Date;
  items: CalendarItem[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (dateKey: string) => void;
  onSelectItem: (item: CalendarItem) => void;
};

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarMonth({
  activeMonth,
  items,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onSelectItem,
}: CalendarMonthProps) {
  const calendarDays = getCalendarDays(activeMonth);
  const calendarWeeks = Array.from({ length: 6 }, (_, index) =>
    calendarDays.slice(index * 7, index * 7 + 7),
  );

  function itemsForDate(dateKey: string) {
    return items.filter((item) => item.dueDate === dateKey);
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
        <div className="calendar-row" role="row">
          {weekdays.map((weekday) => (
            <div key={weekday} className="weekday-cell" role="columnheader">
              {weekday}
            </div>
          ))}
        </div>

        {calendarWeeks.map((week, weekIndex) => (
          <div className="calendar-row" role="row" key={weekIndex}>
            {week.map((day) => {
              const dayItems = itemsForDate(day.dateKey);
              const visibleItems = dayItems.slice(0, 2);

              return (
                <div
                  key={day.dateKey}
                  role="gridcell"
                  className={[
                    "date-cell",
                    day.isCurrentMonth ? "" : "is-muted",
                    day.isToday ? "is-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className="date-number-button"
                    onClick={() => onSelectDate(day.dateKey)}
                    aria-label={`${day.dateKey} 일정 추가`}
                    title={`${day.dateKey} 일정 추가`}
                  >
                    <span className="date-number">{day.dayNumber}</span>
                  </button>
                  <div className="date-events">
                    {visibleItems.map((item) => {
                      const sourceLabel =
                        item.source === "personal" ? "내 일정" : "반 일정";
                      const compactSourceLabel =
                        item.source === "personal" ? "내" : "반";

                      return (
                        <button
                          key={`${item.source}:${item.id}`}
                          type="button"
                          className={`event-pill type-${item.type}`}
                          onClick={() => onSelectItem(item)}
                          aria-label={`${day.dateKey} ${item.title} ${sourceLabel} 열기`}
                          title={`${item.title} · ${sourceLabel}`}
                        >
                          <span className="event-title">{item.title}</span>
                          <small
                            className={`source-badge source-${item.source}`}
                            aria-hidden="true"
                          >
                            <span className="source-label-compact">
                              {compactSourceLabel}
                            </span>
                            <span className="source-label-full">
                              {sourceLabel}
                            </span>
                          </small>
                        </button>
                      );
                    })}
                    {dayItems.length > 2 && (
                      <span className="more-count">
                        +{dayItems.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
