import { CalendarClock, RotateCcw } from "lucide-react";
import type { SummaryFilter } from "../types";

type SummaryWidgetsProps = {
  counts: {
    today: number;
    tomorrow: number;
    week: number;
  };
  activeFilter: SummaryFilter;
  onChangeFilter: (filter: SummaryFilter) => void;
};

const widgetLabels: Array<{
  key: Exclude<SummaryFilter, null>;
  title: string;
  caption: string;
}> = [
  { key: "today", title: "오늘 마감", caption: "오늘까지 끝낼 일정" },
  { key: "tomorrow", title: "내일 마감", caption: "내일까지 준비할 일정" },
  { key: "week", title: "이번 주 일정", caption: "7일 이내 마감 일정" },
];

export default function SummaryWidgets({
  counts,
  activeFilter,
  onChangeFilter,
}: SummaryWidgetsProps) {
  return (
    <section className="summary-widgets" aria-label="일정 요약">
      {widgetLabels.map((widget) => (
        <button
          key={widget.key}
          type="button"
          className={`summary-card ${activeFilter === widget.key ? "is-active" : ""}`}
          onClick={() => onChangeFilter(widget.key)}
          aria-pressed={activeFilter === widget.key}
        >
          <span className="summary-icon" aria-hidden="true">
            <CalendarClock size={18} />
          </span>
          <span>
            <strong>{counts[widget.key]}</strong>
            <span>{widget.title}</span>
          </span>
          <small>{widget.caption}</small>
        </button>
      ))}

      <button
        type="button"
        className="secondary-button filter-reset-button"
        onClick={() => onChangeFilter(null)}
        disabled={!activeFilter}
      >
        <RotateCcw size={16} aria-hidden="true" />
        필터 해제
      </button>
    </section>
  );
}
