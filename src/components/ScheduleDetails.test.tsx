import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalendarItem, PersonalSchedule, SharedEvent } from "../types";
import ScheduleDetails from "./ScheduleDetails";

const personal: PersonalSchedule = {
  source: "personal", id: "personal-1", grade: 1, classNo: 2, title: "Personal task",
  subject: "Physics", description: "Private notes", type: "homework", dueDate: "2026-07-25", createdAt: "2026-07-20T00:00:00Z",
};
const shared: SharedEvent = {
  source: "shared", id: "shared-1", classId: "grade-1-class-2", title: "Shared task",
  subject: "Math", description: "Class notes", type: "exam", dueDate: "2026-07-25", status: "published",
};

function renderDetails(item: CalendarItem = shared, submit = vi.fn().mockResolvedValue("proposal-1")) {
  const trigger = document.createElement("button");
  trigger.textContent = "open details";
  document.body.append(trigger);
  trigger.focus();
  return {
    trigger,
    submit,
    ...render(<ScheduleDetails item={item} onClose={vi.fn()} onEditPersonal={vi.fn()} onDeletePersonal={vi.fn()} opinionGateway={{
      subscribePublished: (_classId, _eventId, onNext) => { onNext([{ id: "opinion-1", nickname: "Kim", content: "Use <strong>text</strong>", sourceProposalId: "proposal-old", status: "published", approvedAt: new Date("2026-07-20") }]); return vi.fn(); },
      submit,
    }} />),
  };
}

describe("ScheduleDetails", () => {
  it("shows only personal edit and delete actions for a personal schedule", () => {
    renderDetails(personal);
    expect(screen.getByRole("dialog")).toHaveTextContent("Personal task");
    expect(screen.getByRole("button", { name: "개인 일정 수정" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "개인 일정 삭제" })).toBeInTheDocument();
    expect(screen.queryByLabelText("별명")).not.toBeInTheDocument();
  });

  it("shows approved opinions as text and keeps a submitted opinion pending", async () => {
    const { submit } = renderDetails();
    expect(screen.getByText("Use <strong>text</strong>")).toBeInTheDocument();
    expect(screen.getByText("Use <strong>text</strong>").querySelector("strong")).toBeNull();
    fireEvent.change(screen.getByLabelText("별명"), { target: { value: "Lee" } });
    fireEvent.change(screen.getByLabelText("팁·의견"), { target: { value: "Check units" } });
    fireEvent.click(screen.getByRole("button", { name: "의견 제출" }));
    await waitFor(() => expect(screen.getByText("의견이 검토 대기 중입니다.")).toBeInTheDocument());
    expect(submit).toHaveBeenCalledWith("grade-1-class-2", "shared-1", { nickname: "Lee", content: "Check units" });
    expect(screen.queryByText("Check units")).not.toBeInTheDocument();
  });

  it("validates input, retains text after a failed submission, and restores focus on close", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("network"));
    const { trigger } = renderDetails(shared, submit);
    fireEvent.click(screen.getByRole("button", { name: "의견 제출" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("별명"), { target: { value: "Kim" } });
    fireEvent.change(screen.getByLabelText("팁·의견"), { target: { value: "Retry text" } });
    fireEvent.click(screen.getByRole("button", { name: "의견 제출" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("network"));
    expect(screen.getByLabelText("별명")).toHaveValue("Kim");
    expect(screen.getByLabelText("팁·의견")).toHaveValue("Retry text");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});
