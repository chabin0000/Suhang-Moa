import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { scheduleDraftSchema } from "../schemas/schedule";
import type {
  PersonalSchedule,
  ScheduleDraft,
  ScheduleType,
} from "../types";
import { SCHEDULE_TYPES, scheduleTypeLabels } from "../types";

type ScheduleModalProps = {
  mode: "create" | "edit";
  initialValue?: PersonalSchedule;
  defaultDate?: string;
  onCancel: () => void;
  onSubmit: (draft: ScheduleDraft) => void;
};

const emptyForm = {
  title: "",
  subject: "",
  description: "",
  type: "" as ScheduleType | "",
  dueDate: "",
};

export default function ScheduleModal({
  mode,
  initialValue,
  defaultDate = "",
  onCancel,
  onSubmit,
}: ScheduleModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setForm(
      initialValue
        ? {
            title: initialValue.title,
            subject: initialValue.subject ?? "",
            description: initialValue.description ?? "",
            type: initialValue.type,
            dueDate: initialValue.dueDate,
          }
        : { ...emptyForm, dueDate: defaultDate },
    );
    setErrorMessage("");
  }, [defaultDate, initialValue, mode]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrorMessage("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = scheduleDraftSchema.safeParse(form);

    if (!result.success) {
      setErrorMessage(
        result.error.issues[0]?.message ??
          "입력한 일정 정보를 다시 확인해 주세요.",
      );
      return;
    }

    onSubmit(result.data);
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
              <p className="overline">PERSONAL SCHEDULE</p>
              <h2 id="schedule-modal-title">
                {mode === "create" ? "내 일정 추가" : "내 일정 수정"}
              </h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={onCancel}
              aria-label={`${mode === "create" ? "내 일정 추가" : "내 일정 수정"} 닫기`}
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
            <button type="button" className="secondary-button" onClick={onCancel}>
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
