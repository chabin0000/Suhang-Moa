import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonalSchedule, SharedEvent } from "../types";
import { loadSchedules, saveSchedules } from "../utils/storage";
import CalendarMonth from "./CalendarMonth";
import ClassDashboard from "./ClassDashboard";
import ScheduleModal from "./ScheduleModal";

const personalSchedule: PersonalSchedule = {
  source: "personal",
  id: "same-id",
  grade: 1,
  classNo: 2,
  title: "개인 물리 보고서",
  subject: "물리",
  description: "개인 설명",
  type: "performance",
  dueDate: "2026-07-24",
  createdAt: "2026-07-20T00:00:00.000Z",
};

const sharedEvent: SharedEvent = {
  source: "shared",
  id: "same-id",
  classId: "grade-1-class-2",
  title: "반 공통 시험",
  subject: "수학",
  description: "공유 설명",
  type: "exam",
  dueDate: "2026-07-24",
  status: "published",
};

function renderDashboard(
  sharedEvents: SharedEvent[] = [sharedEvent],
  sharedScheduleError:
    | "firebase-disabled"
    | "permission-denied"
    | "network"
    | null = null,
) {
  return render(
    <ClassDashboard
      selectedClass={{ grade: 1, classNo: 2 }}
      sharedEvents={sharedEvents}
      sharedScheduleError={sharedScheduleError}
      onChangeClass={vi.fn()}
    />,
  );
}

function scheduleCard(title: string): HTMLElement {
  const card = screen.getByRole("heading", { name: title }).closest("article");
  if (!card) {
    throw new Error(`${title} 일정 카드를 찾지 못했습니다.`);
  }
  return card;
}

describe("ClassDashboard personal CRUD and shared permissions", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
    saveSchedules([personalSchedule]);
  });

  it("개인 일정과 반 일정을 함께 표시하고 반 일정에는 수정·삭제 버튼을 표시하지 않는다", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { name: "개인 물리 보고서" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "반 공통 시험" })).toBeInTheDocument();

    const personalCard = within(scheduleCard("개인 물리 보고서"));
    expect(personalCard.getByText("내 일정")).toBeInTheDocument();
    expect(personalCard.getByRole("button", { name: "수정" })).toBeInTheDocument();
    expect(personalCard.getByRole("button", { name: "삭제" })).toBeInTheDocument();

    const sharedCard = within(scheduleCard("반 공통 시험"));
    expect(sharedCard.getByText("반 일정")).toBeInTheDocument();
    expect(sharedCard.queryByRole("button", { name: "수정" })).not.toBeInTheDocument();
    expect(sharedCard.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });

  it("공유 일정 네트워크 오류를 작게 알리면서 개인 일정 기능은 유지한다", () => {
    renderDashboard([], "network");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "공유 일정을 불러오지 못했습니다. 네트워크를 확인해 주세요.",
    );
    expect(
      screen.getByRole("heading", { name: "개인 물리 보고서" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "일정 추가" })).toBeEnabled();
  });

  it.each([
    ["permission-denied", "공유 일정 열람 권한이 없습니다."],
    ["firebase-disabled", "공유 일정 연결이 꺼져 있습니다."],
  ] as const)("%s 상태를 간결한 한국어로 표시한다", (error, message) => {
    renderDashboard([], error);

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("개인 일정 생성·수정·삭제를 LocalStorage에 반영하고 공유 원본은 변경하지 않는다", () => {
    const sharedSnapshot = structuredClone(sharedEvent);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: "일정 추가" }));
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "새 개인 일정" },
    });
    fireEvent.change(screen.getByLabelText("과목"), {
      target: { value: "과학" },
    });
    fireEvent.change(screen.getByLabelText("유형"), {
      target: { value: "homework" },
    });
    fireEvent.change(screen.getByLabelText("마감일"), {
      target: { value: "2026-07-26" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    const created = loadSchedules().find((item) => item.title === "새 개인 일정");
    expect(created).toBeDefined();
    expect(created).not.toHaveProperty("updatedAt");

    fireEvent.click(
      within(scheduleCard("개인 물리 보고서")).getByRole("button", {
        name: "수정",
      }),
    );
    expect(screen.getByRole("heading", { name: "내 일정 수정" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "수정된 개인 물리 보고서" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    const edited = loadSchedules().find((item) => item.id === personalSchedule.id);
    expect(edited).toMatchObject({
      title: "수정된 개인 물리 보고서",
      updatedAt: expect.any(String),
    });
    expect(sharedEvent).toEqual(sharedSnapshot);
    expect(screen.getByRole("heading", { name: "반 공통 시험" })).toBeInTheDocument();

    fireEvent.click(
      within(scheduleCard("수정된 개인 물리 보고서")).getByRole("button", {
        name: "삭제",
      }),
    );

    expect(loadSchedules().some((item) => item.id === personalSchedule.id)).toBe(false);
    expect(loadSchedules().some((item) => item.title === "새 개인 일정")).toBe(true);
    expect(sharedEvent).toEqual(sharedSnapshot);
    expect(screen.getByRole("heading", { name: "반 공통 시험" })).toBeInTheDocument();
  });
});

describe("CalendarMonth interactions", () => {
  it("날짜 선택 버튼과 일정 열기 버튼을 분리한다", () => {
    const onSelectDate = vi.fn();
    const onSelectItem = vi.fn();

    render(
      <CalendarMonth
        activeMonth={new Date(2026, 6, 1)}
        items={[personalSchedule, sharedEvent]}
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onSelectDate={onSelectDate}
        onSelectItem={onSelectItem}
      />,
    );

    const eventButton = screen.getByRole("button", {
      name: "2026-07-24 개인 물리 보고서 내 일정 열기",
    });
    const dateButton = screen.getByRole("button", {
      name: "2026-07-24 일정 추가",
    });

    expect(eventButton.parentElement?.closest("button")).toBeNull();
    expect(document.querySelector("button button")).toBeNull();

    fireEvent.click(eventButton);
    expect(onSelectItem).toHaveBeenCalledWith(personalSchedule);
    expect(onSelectDate).not.toHaveBeenCalled();

    fireEvent.click(dateButton);
    expect(onSelectDate).toHaveBeenCalledWith("2026-07-24");
    expect(onSelectItem).toHaveBeenCalledTimes(1);
  });

  it("일정 제목과 좁은 화면용 출처 배지를 함께 렌더링한다", () => {
    render(
      <CalendarMonth
        activeMonth={new Date(2026, 6, 1)}
        items={[personalSchedule, sharedEvent]}
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onSelectDate={vi.fn()}
        onSelectItem={vi.fn()}
      />,
    );

    const personalButton = screen.getByRole("button", {
      name: "2026-07-24 개인 물리 보고서 내 일정 열기",
    });
    const sharedButton = screen.getByRole("button", {
      name: "2026-07-24 반 공통 시험 반 일정 열기",
    });

    expect(within(personalButton).getByText("개인 물리 보고서")).toHaveClass(
      "event-title",
    );
    expect(within(personalButton).getByText("내")).toHaveClass(
      "source-label-compact",
    );
    expect(within(personalButton).getByText("내 일정")).toHaveClass(
      "source-label-full",
    );
    expect(within(sharedButton).getByText("반")).toHaveClass(
      "source-label-compact",
    );
    expect(within(sharedButton).getByText("반 일정")).toHaveClass(
      "source-label-full",
    );
  });

  it("요일 머리글과 6개 주를 각각 일곱 칸의 ARIA 행으로 구성한다", () => {
    render(
      <CalendarMonth
        activeMonth={new Date(2026, 6, 1)}
        items={[]}
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onSelectDate={vi.fn()}
        onSelectItem={vi.fn()}
      />,
    );

    const rows = within(
      screen.getByRole("grid", { name: "월간 캘린더" }),
    ).getAllByRole("row");

    expect(rows).toHaveLength(7);
    expect(within(rows[0]).getAllByRole("columnheader")).toHaveLength(7);
    rows.slice(1).forEach((row) => {
      expect(within(row).getAllByRole("gridcell")).toHaveLength(7);
    });
  });
});

describe("ScheduleModal validation", () => {
  it("빈 제목은 제출하지 않고 한국어 오류를 표시한다", () => {
    const onSubmit = vi.fn();
    render(
      <ScheduleModal
        mode="create"
        defaultDate="2026-07-24"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("유형"), {
      target: { value: "homework" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("제목을 입력해 주세요.");
  });

  it("불가능한 날짜는 제출하지 않고 한국어 오류를 표시한다", () => {
    const onSubmit = vi.fn();
    render(
      <ScheduleModal
        mode="create"
        defaultDate="2026-02-30"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "날짜 검증 일정" },
    });
    fireEvent.change(screen.getByLabelText("유형"), {
      target: { value: "exam" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "유효한 날짜를 입력해 주세요.",
    );
  });
});

afterEach(() => {
  cleanup();
});
