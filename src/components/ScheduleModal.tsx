import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ScheduleDraft, ScheduleType } from "../types";
import { SCHEDULE_TYPES, scheduleTypeLabels } from "../types";

type ScheduleModalProps = {
  isOpen: boolean;
  defaultDueDate: string;
  onClose: () => void;
  onSave: (draft: ScheduleDraft) => void;
};

const emptyForm = {
  title: "",
  subject: "",
  description: "",
  type: "" as ScheduleType | "",
  dueDate: "",
};

export default function ScheduleModal({
  isOpen,
  defaultDueDate,
  onClose,
  onSave,
}: ScheduleModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm({ ...emptyForm, dueDate: defaultDueDate });
      setErrorMessage("");
    }
  }, [defaultDueDate, isOpen]);

  if (!isOpen) {
    return null;
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrorMessage("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim() || !form.type || !form.dueDate) {
      setErrorMessage("제목, 유형, 마감일은 반드시 입력해야 합니다.");
      return;
    }

    onSave({
      title: form.title.trim(),
      subject: form.subject.trim(),
      description: form.description.trim(),
      type: form.type,
      dueDate: form.dueDate,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="schedule-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
      >
        <form onSubmit={handleSubmit}>
          <header className="modal-header">
            <div>
              <p className="overline">New schedule</p>
              <h2 id="schedule-modal-title">일정 추가</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="일정 추가 닫기"
              title="닫기"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <label className="field-label">
            제목
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="예: 물리 수행평가 보고서"
              autoFocus
            />
          </label>

          <label className="field-label">
            과목
            <input
              value={form.subject}
              onChange={(event) => updateField("subject", event.target.value)}
              placeholder="예: 통합과학"
            />
          </label>

          <label className="field-label">
            유형
            <select
              value={form.type}
              onChange={(event) => updateField("type", event.target.value)}
            >
              <option value="">유형 선택</option>
              {SCHEDULE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {scheduleTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            마감일
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) => updateField("dueDate", event.target.value)}
            />
          </label>

          <label className="field-label">
            상세 내용
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="준비물, 제출 방식, 참고할 내용 등을 적어 주세요."
              rows={4}
            />
          </label>

          {errorMessage && <p className="form-error">{errorMessage}</p>}

          <footer className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="primary-button">
              <Save size={17} aria-hidden="true" />
              저장
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
