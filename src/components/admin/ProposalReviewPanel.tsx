import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { scheduleDraftSchema } from "../../schemas/schedule";
import type { ModerationScheduleQueueRow } from "../../services/adminService";
import { SCHEDULE_TYPES, scheduleTypeLabels, type ScheduleDraft } from "../../types";

export default function ProposalReviewPanel({ proposal, disabled, onApprove, onReject }: { proposal: ModerationScheduleQueueRow; disabled: boolean; onApprove: (draft: ScheduleDraft) => void; onReject: () => void }) {
  const [draft, setDraft] = useState<ScheduleDraft>({ title: proposal.title, subject: proposal.subject, description: proposal.description, type: proposal.type, dueDate: proposal.dueDate });
  const [error, setError] = useState("");
  useEffect(() => { setDraft({ title: proposal.title, subject: proposal.subject, description: proposal.description, type: proposal.type, dueDate: proposal.dueDate }); setError(""); }, [proposal]);
  function approve() { const parsed = scheduleDraftSchema.safeParse(draft); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "입력값을 확인하세요."); return; } onApprove(parsed.data); }
  return <section className="moderation-detail" aria-label="일정 제안 검토"><p className="overline">제안자 {proposal.nickname}</p><h2>일정 제안 검토</h2>
    <p className="moderation-original">원본: {proposal.title} · {proposal.classId}</p>
    <label className="field-label">제목<input value={draft.title} disabled={disabled} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
    <label className="field-label">과목<input value={draft.subject} disabled={disabled} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
    <label className="field-label">유형<select value={draft.type} disabled={disabled} onChange={(e) => setDraft({ ...draft, type: e.target.value as ScheduleDraft["type"] })}>{SCHEDULE_TYPES.map((type) => <option key={type} value={type}>{scheduleTypeLabels[type]}</option>)}</select></label>
    <label className="field-label">마감일<input type="date" value={draft.dueDate} disabled={disabled} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></label>
    <label className="field-label">상세 내용<textarea rows={5} value={draft.description} disabled={disabled} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="moderation-actions"><button type="button" className="secondary-button" disabled={disabled} onClick={onReject}><X size={16} aria-hidden="true" />반려</button><button type="button" className="primary-button" disabled={disabled} onClick={approve}><Check size={16} aria-hidden="true" />확인하고 게시</button></div>
  </section>;
}
