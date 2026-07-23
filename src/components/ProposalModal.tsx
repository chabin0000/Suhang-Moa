import { Send, X } from "lucide-react";
import { useState } from "react";
import { proposalDraftSchema } from "../schemas/proposal";
import type { ClassId, ProposalDraft, ScheduleType } from "../types";
import { SCHEDULE_TYPES, scheduleTypeLabels } from "../types";
import ProposalCart from "./ProposalCart";

type ProposalModalProps = {
  classId: ClassId;
  onCancel: () => void;
  submitBatch: (classId: ClassId, drafts: ProposalDraft[]) => Promise<string[]>;
  onSubmitted?: () => void;
};

const emptySchedule = { title: "", subject: "", description: "", type: "" as ScheduleType | "", dueDate: "" };

function classLabel(classId: ClassId): string {
  const match = /^grade-(\d)-class-(\d+)$/.exec(classId);
  return match ? `${match[1]}학년 ${match[2]}반` : classId;
}

function isProposalSubmitError(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "validation" ||
      error.code === "logout-required" ||
      error.code === "submission-failed") &&
    "message" in error &&
    typeof error.message === "string"
  );
}

export default function ProposalModal({ classId, onCancel, submitBatch, onSubmitted }: ProposalModalProps) {
  const [nickname, setNickname] = useState("");
  const [schedule, setSchedule] = useState(emptySchedule);
  const [cart, setCart] = useState<ProposalDraft[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [website, setWebsite] = useState("");

  function update(field: keyof typeof schedule, value: string) {
    setSchedule((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function addToCart() {
    if (cart.length >= 10) { setError("제안은 최대 10개까지 담을 수 있습니다."); return; }
    const parsed = proposalDraftSchema.safeParse({ nickname, ...schedule });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "제안 내용을 확인해 주세요."); return; }
    setCart((current) => [...current, parsed.data]);
    setSchedule(emptySchedule);
    setError("");
  }

  async function requestReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (website) return;
    const cooldownUntil = Number(window.localStorage.getItem("classmap-proposal-cooldown") ?? "0");
    if (cooldownUntil > Date.now()) { setError("잠시 후 다시 검토 요청해 주세요."); return; }
    if (cart.length === 0) { setError("검토 요청할 제안을 목록에 담아 주세요."); return; }
    setSubmitting(true); setError("");
    try {
      await submitBatch(classId, cart);
      setCart([]); setSuccess("제안을 검토 요청했습니다.");
      window.localStorage.setItem("classmap-proposal-cooldown", String(Date.now() + 30_000));
      onSubmitted?.();
    } catch (submitError) {
      setError(isProposalSubmitError(submitError) ? submitError.message : "검토 요청에 실패했습니다. 다시 시도해 주세요.");
    } finally { setSubmitting(false); }
  }

  return <div className="modal-backdrop" role="presentation"><section className="schedule-modal proposal-modal" role="dialog" aria-modal="true" aria-labelledby="proposal-modal-title"><form onSubmit={requestReview}>
    <header className="modal-header"><div><p className="overline">SCHEDULE PROPOSAL</p><h2 id="proposal-modal-title">반 일정 제안</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="닫기" title="닫기"><X size={18} aria-hidden="true" /></button></header>
    <p className="class-badge">{classLabel(classId)}</p>
    <label className="field-label">별명<input value={nickname} onChange={(event) => { setNickname(event.target.value); setError(""); }} maxLength={20} autoFocus /></label>
    <label className="field-label">제목<input value={schedule.title} onChange={(event) => update("title", event.target.value)} maxLength={80} /></label>
    <label className="field-label">과목<input value={schedule.subject} onChange={(event) => update("subject", event.target.value)} maxLength={40} /></label>
    <label className="field-label">유형<select value={schedule.type} onChange={(event) => update("type", event.target.value)}><option value="">유형 선택</option>{SCHEDULE_TYPES.map((type) => <option key={type} value={type}>{scheduleTypeLabels[type]}</option>)}</select></label>
    <label className="field-label">마감일<input type="date" value={schedule.dueDate} onChange={(event) => update("dueDate", event.target.value)} /></label>
    <label className="field-label">설명<textarea value={schedule.description} onChange={(event) => update("description", event.target.value)} maxLength={1000} rows={3} /></label>
    <input className="honeypot" name="website" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />
    {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="proposal-success" role="status">{success}</p>}
    <button type="button" className="secondary-button" onClick={addToCart}>제안 목록에 담기</button>
    <ProposalCart items={cart} onRemove={(index) => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
    <footer className="modal-actions"><button type="button" className="ghost-button" onClick={onCancel}>취소</button><button type="submit" className="primary-button" disabled={submitting || cart.length === 0}><Send size={17} aria-hidden="true" /> 검토 요청</button></footer>
  </form></section></div>;
}
