import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassId, ProposalDraft } from "../types";
import AddScheduleMenu from "./AddScheduleMenu";
import ProposalModal from "./ProposalModal";

const classId = "grade-1-class-2" as ClassId;
const submitBatch = vi.fn<
  (classId: ClassId, drafts: ProposalDraft[]) => Promise<string[]>
>();

function fillProposal(title = "Physics report") {
  fireEvent.change(screen.getByLabelText("별명"), { target: { value: "Kim" } });
  fireEvent.change(screen.getByLabelText("제목"), { target: { value: title } });
  fireEvent.change(screen.getByLabelText("유형"), { target: { value: "performance" } });
  fireEvent.change(screen.getByLabelText("마감일"), { target: { value: "2026-07-30" } });
}

describe("ProposalModal", () => {
  beforeEach(() => {
    submitBatch.mockReset();
    window.localStorage.clear();
  });

  it("shows exactly the two add commands", () => {
    render(<AddScheduleMenu onAddPersonal={vi.fn()} onProposeClass={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "일정 추가 메뉴" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent?.trim())).toEqual([
      "내 일정 추가",
      "반 일정 제안",
    ]);
  });

  it("keeps the current class fixed and retains nickname after adding to the cart", () => {
    render(<ProposalModal classId={classId} onCancel={vi.fn()} submitBatch={submitBatch} />);

    expect(screen.getByText("1학년 2반")).toBeInTheDocument();
    expect(screen.queryByLabelText("반")).not.toBeInTheDocument();
    fillProposal();
    fireEvent.click(screen.getByRole("button", { name: "제안 목록에 담기" }));

    expect(screen.getByText("Physics report")).toBeInTheDocument();
    expect(screen.getByLabelText("별명")).toHaveValue("Kim");
    expect(screen.getByLabelText("제목")).toHaveValue("");
  });

  it("removes a cart item and rejects an eleventh item", () => {
    render(<ProposalModal classId={classId} onCancel={vi.fn()} submitBatch={submitBatch} />);

    for (let index = 1; index <= 10; index += 1) {
      fillProposal(`Proposal ${index}`);
      fireEvent.click(screen.getByRole("button", { name: "제안 목록에 담기" }));
    }
    expect(screen.getByText("10 / 10")).toBeInTheDocument();
    fillProposal("Proposal 11");
    fireEvent.click(screen.getByRole("button", { name: "제안 목록에 담기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("최대 10개");

    fireEvent.click(screen.getByRole("button", { name: "Proposal 1 제거" }));
    expect(screen.queryByText("Proposal 1")).not.toBeInTheDocument();
    expect(screen.getByText("9 / 10")).toBeInTheDocument();
  });

  it("submits once on double click, retains cart on failure, and clears it after success", async () => {
    let resolveSubmit: ((value: string[]) => void) | undefined;
    submitBatch.mockImplementationOnce(
      () => new Promise((resolve) => { resolveSubmit = resolve; }),
    );
    const { rerender } = render(
      <ProposalModal classId={classId} onCancel={vi.fn()} submitBatch={submitBatch} />,
    );
    fillProposal();
    fireEvent.click(screen.getByRole("button", { name: "제안 목록에 담기" }));
    const submit = screen.getByRole("button", { name: "검토 요청" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(submitBatch).toHaveBeenCalledTimes(1);
    resolveSubmit?.(["doc-1"]);
    await waitFor(() => expect(screen.getByText("제안을 검토 요청했습니다.")).toBeInTheDocument());
    expect(screen.queryByText("Physics report")).not.toBeInTheDocument();

    window.localStorage.clear();
    submitBatch.mockRejectedValueOnce(new Error("network"));
    rerender(<ProposalModal classId={classId} onCancel={vi.fn()} submitBatch={submitBatch} />);
    fillProposal("Retry proposal");
    fireEvent.click(screen.getByRole("button", { name: "제안 목록에 담기" }));
    fireEvent.click(screen.getByRole("button", { name: "검토 요청" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("검토 요청에 실패했습니다"));
    expect(screen.getByText("Retry proposal")).toBeInTheDocument();
  });
});

afterEach(() => {
  cleanup();
});
