import { Check, X } from "lucide-react";
import type { ModerationOpinionQueueRow } from "../../services/adminService";

export default function OpinionReviewPanel({ proposal, disabled, onApprove, onReject }: { proposal: ModerationOpinionQueueRow; disabled: boolean; onApprove: () => void; onReject: () => void }) {
  return <section className="moderation-detail" aria-label="의견 검토"><p className="overline">제안자 {proposal.nickname}</p><h2>의견 검토</h2><dl className="details-meta"><div><dt>반</dt><dd>{proposal.classId}</dd></div><div><dt>일정</dt><dd>{proposal.eventId}</dd></div></dl><p className="moderation-content">{proposal.content}</p><div className="moderation-actions"><button type="button" className="secondary-button" disabled={disabled} onClick={onReject}><X size={16} aria-hidden="true" />반려</button><button type="button" className="primary-button" disabled={disabled} onClick={onApprove}><Check size={16} aria-hidden="true" />승인</button></div></section>;
}
