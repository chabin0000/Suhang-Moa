import type { ModerationQueueTab } from "../../services/adminService";

const tabs: Array<{ id: ModerationQueueTab; label: string }> = [
  { id: "schedules", label: "일정 제안" },
  { id: "opinions", label: "의견" },
  { id: "history", label: "처리 이력" },
];

export default function ModerationTabs({ value, onChange }: { value: ModerationQueueTab; onChange: (tab: ModerationQueueTab) => void }) {
  return <div className="moderation-tabs" role="tablist" aria-label="관리 탭">
    {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} className={value === tab.id ? "is-active" : ""} onClick={() => onChange(tab.id)}>{tab.label}</button>)}
  </div>;
}
