import { useState } from "react";
import { opinionDraftSchema } from "../schemas/opinion";
import type { OpinionDraft } from "../schemas/opinion";

type OpinionFormProps = {
  onSubmit: (draft: OpinionDraft) => Promise<void>;
};

export default function OpinionForm({ onSubmit }: OpinionFormProps) {
  const [form, setForm] = useState<OpinionDraft>({ nickname: "", content: "" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = opinionDraftSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await onSubmit(parsed.data);
      setForm({ nickname: "", content: "" });
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "의견 제출에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="opinion-form" onSubmit={submit}>
      <h3>팁·의견 남기기</h3>
      <label className="field-label">별명
        <input aria-label="별명" value={form.nickname} maxLength={20} onChange={(event) => { setForm({ ...form, nickname: event.target.value }); setError(""); }} />
      </label>
      <label className="field-label">팁·의견
        <textarea aria-label="팁·의견" value={form.content} maxLength={500} rows={4} onChange={(event) => { setForm({ ...form, content: event.target.value }); setError(""); }} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {submitted && <p className="proposal-success" role="status">의견이 검토 대기 중입니다.</p>}
      <button className="primary-button" type="submit" disabled={pending}>의견 제출</button>
    </form>
  );
}
