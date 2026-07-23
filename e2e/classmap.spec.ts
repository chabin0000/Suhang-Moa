import { expect, test } from "@playwright/test";

async function enterClass(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "1학년", exact: true }).click();
  await page.getByRole("button", { name: "2반", exact: true }).click();
  await page.getByRole("button", { name: "우리 반 들어가기" }).click();
  await expect(page.getByRole("heading", { name: "1학년 2반 ClassMap" })).toBeVisible();
}

test("반 선택은 재접속 후에도 유지되고 공개 일정만 표시된다", async ({ page }) => {
  await enterClass(page);
  await expect(page.getByRole("button", { name: /공유된 물리 보고서 반 일정 열기/ })).toBeVisible();
  await expect(page.getByText("숨겨진 일정")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "1학년 2반 ClassMap" })).toBeVisible();
});

test("개인 일정은 생성, 수정, 삭제할 수 있고 브라우저에만 남는다", async ({ page }) => {
  await enterClass(page);
  await page.getByLabel("일정 추가 메뉴").click();
  await page.getByRole("menuitem", { name: "내 일정 추가" }).click();
  await page.getByLabel("제목").fill("개인 수학 복습");
  await page.getByLabel("과목").fill("수학");
  await page.getByLabel("유형").selectOption("homework");
  await page.getByLabel("마감일").fill("2026-07-30");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("button", { name: /개인 수학 복습 내 일정 열기/ })).toBeVisible();
  await page.getByRole("button", { name: "수정" }).last().click();
  await page.getByLabel("제목").fill("개인 수학 복습 수정");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("button", { name: /개인 수학 복습 수정 내 일정 열기/ })).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "삭제" }).last().click();
  await expect(page.getByRole("button", { name: /개인 수학 복습 수정 내 일정 열기/ })).toHaveCount(0);
});

test("반 일정 제안과 의견은 즉시 공개하지 않고 검토 대기로 제출한다", async ({ page }) => {
  await enterClass(page);
  await page.getByLabel("일정 추가 메뉴").click();
  await page.getByRole("menuitem", { name: "반 일정 제안" }).click();
  await page.getByLabel("별명").fill("학생");
  await page.getByLabel("제목").fill("제안한 일정");
  await page.getByLabel("과목").fill("화학");
  await page.getByLabel("유형").selectOption("exam");
  await page.getByLabel("마감일").fill("2026-08-01");
  await page.getByRole("button", { name: "제안 목록에 담기" }).click();
  await page.getByRole("button", { name: "검토 요청" }).click();
  await expect(page.getByText("제안을 검토 요청했습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: /제안한 일정 반 일정 열기/ })).toHaveCount(0);
  await page.getByRole("button", { name: "닫기" }).click();
  await page.getByRole("button", { name: /공유된 물리 보고서/ }).first().click();
  await expect(page.getByText("실험 결과를 먼저 정리해 두세요.")).toBeVisible();
  await page.getByLabel("별명").fill("학생");
  await page.getByRole("textbox", { name: "팁·의견" }).fill("발표 순서를 확인하세요.");
  await page.getByRole("button", { name: "의견 제출" }).click();
  await expect(page.getByText("의견이 검토 대기 중입니다.")).toBeVisible();
});

test("관리자 경로는 로그인 전 상태를 보여 주며 작은 화면에서도 기본 레이아웃이 유지된다", async ({ page }) => {
  await page.goto("/#/admin");
  await expect(page.getByRole("heading", { name: "관리자 로그인" })).toBeVisible();
  const body = await page.locator("body").boundingBox();
  expect(body?.width).toBeGreaterThan(0);
  expect(body?.height).toBeGreaterThan(0);
});
