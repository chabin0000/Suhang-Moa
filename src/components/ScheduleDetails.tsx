import { Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublishedOpinion } from "../schemas/opinion";
import type { OpinionGateway } from "../services/opinionService";
import type { CalendarItem, PersonalSchedule } from "../types";
import { scheduleTypeLabels } from "../types";
import { isPersonalSchedule } from "../utils/calendarItems";
import { formatKoreanDate } from "../utils/date";
import OpinionForm from "./OpinionForm";
import OpinionList from "./OpinionList";

type ScheduleDetailsProps = {
  item: CalendarItem;
  onClose: () => void;
  onEditPersonal: (schedule: PersonalSchedule) => void;
  onDeletePersonal: (schedule: PersonalSchedule) => void;
  opinionGateway?: OpinionGateway;
};

export default function ScheduleDetails({ item, onClose, onEditPersonal, onDeletePersonal, opinionGateway }: ScheduleDetailsProps) {
  const [gateway, setGateway] = useState<OpinionGateway | null>(opinionGateway ?? null);
  const [opinions, setOpinions] = useState<PublishedOpinion[]>([]);
  const previousFocus = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const personal = isPersonalSchedule(item);

  useEffect(() => { closeButton.current?.focus(); }, []);
  useEffect(() => {
    if (opinionGateway || personal) return;
    let active = true;
    import("../services/opinionService").then(({ loadDefaultOpinionGateway }) => loadDefaultOpinionGateway()).then((loaded) => {
      if (active) setGateway(loaded);
    }).catch(() => { if (active) setGateway(null); });
    return () => { active = false; };
  }, [opinionGateway, personal]);
  useEffect(() => {
    if (personal || !gateway || item.source !== "shared") return;
    return gateway.subscribePublished(item.classId, item.id, setOpinions, () => setOpinions([]));
  }, [gateway, item, personal]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function close(restoreFocus = true) {
    onClose();
    if (restoreFocus) queueMicrotask(() => previousFocus.current?.focus());
  }

  return (
    <div className="modal-backdrop details-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} className="schedule-modal schedule-details" role="dialog" aria-modal="true" aria-labelledby="schedule-details-title">
        <header className="modal-header">
          <div><p className="overline">{personal ? "PERSONAL SCHEDULE" : "SHARED SCHEDULE"}</p><h2 id="schedule-details-title">{item.title}</h2></div>
          <button ref={closeButton} type="button" className="icon-button" onClick={() => close()} aria-label="상세 닫기" title="닫기"><X size={18} aria-hidden="true" /></button>
        </header>
        <dl className="details-meta">
          <div><dt>과목</dt><dd>{item.subject || "미입력"}</dd></div>
          <div><dt>유형</dt><dd>{scheduleTypeLabels[item.type]}</dd></div>
          <div><dt>마감일</dt><dd>{formatKoreanDate(item.dueDate)}</dd></div>
        </dl>
        {item.description && <p className="details-description">{item.description}</p>}
        {personal ? <div className="schedule-card-actions">
          <button type="button" className="secondary-button" aria-label="개인 일정 수정" onClick={() => { onEditPersonal(item); close(false); }}><Pencil size={16} aria-hidden="true" />수정</button>
          <button type="button" className="destructive-button" aria-label="개인 일정 삭제" onClick={() => { onDeletePersonal(item); close(); }}><Trash2 size={16} aria-hidden="true" />삭제</button>
        </div> : <>
          <OpinionList opinions={opinions} />
          {gateway && <OpinionForm onSubmit={async (draft) => { await gateway.submit(item.classId, item.id, draft); }} />}
        </>}
      </section>
    </div>
  );
}
