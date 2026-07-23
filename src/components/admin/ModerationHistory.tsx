import { Archive } from "lucide-react";
import type { ModerationQueueRow } from "../../services/adminService";

export default function ModerationHistory({ row, disabled, onArchive }: { row: ModerationQueueRow; disabled: boolean; onArchive: () => void }) {
  const canArchive = row.kind === "schedule" && row.status === "approved" && Boolean(row.publishedEventId);
  return <section className="moderation-detail" aria-label="처리 이력 상세"><h2>처리 이력</h2><dl className="details-meta"><div><dt>종류</dt><dd>{row.kind === "schedule" ? "일정" : "의견"}</dd></div><div><dt>상태</dt><dd>{row.status}</dd></div><div><dt>반</dt><dd>{row.classId}</dd></div><div><dt>검토자</dt><dd>{row.reviewedBy ?? "-"}</dd></div><div><dt>검토 시각</dt><dd>{row.reviewedAt?.toLocaleString() ?? "기록 없음"}</dd></div></dl>{row.rejectionReason && <p className="form-error">반려 사유: {row.rejectionReason}</p>}{canArchive && <div className="moderation-actions"><button type="button" className="secondary-button" disabled={disabled} onClick={onArchive}><Archive size={16} aria-hidden="true" />일정 보관</button></div>}</section>;
}
