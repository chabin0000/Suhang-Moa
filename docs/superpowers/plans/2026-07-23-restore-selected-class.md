# 선택한 반 재접속 복원 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 브라우저에서 다시 접속하거나 새로고침했을 때 저장된 반의 캘린더를 즉시 표시한다.

**Architecture:** 기존 `localStorage` 저장 함수는 유지하고, `App`의 초기 화면 상태만 저장된 반의 존재 여부로 결정한다. 반 변경 버튼은 선택 화면으로 이동시키되 새 반을 선택하기 전까지 기존 저장값은 유지한다.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, 브라우저 `localStorage`, pnpm

## Global Constraints

- `classmap:selectedClass` 저장 키와 기존 유효성 검사를 그대로 사용한다.
- 화면 구성, 일정 저장 방식, 새 라이브러리는 변경하거나 추가하지 않는다.
- 저장값이 없거나 잘못되면 반 선택 화면을 표시한다.
- 저장값이 유효하면 첫 렌더링부터 캘린더를 표시해 선택 화면이 잠깐 보이지 않게 한다.

## 파일 구조

- 수정: `src/App.tsx` - 저장된 반에 따라 앱의 첫 화면을 결정한다.
- 검증만 수행: `src/utils/storage.ts` - 기존 반 저장·조회와 유효성 검사를 재사용하며 수정하지 않는다.

---

### Task 1: 저장된 반으로 첫 화면 결정

**Files:**
- Modify: `src/App.tsx:9-15`
- Verify: `src/utils/storage.ts:56-63`

**Interfaces:**
- Consumes: `getSelectedClass(): SelectedClass | null`
- Produces: 저장값이 있으면 `"dashboard"`, 없으면 `"select"`로 시작하는 `screen` 상태

- [ ] **Step 1: 배포된 버전에서 회귀 동작 재현**

브라우저에서 `https://chabin0000.github.io/Suhang-Moa/`를 열고 개발자 도구 콘솔에서 다음을 실행한다.

```javascript
localStorage.setItem(
  "classmap:selectedClass",
  JSON.stringify({ grade: 2, classNo: 3 }),
);
location.reload();
```

Expected before fix: 저장값이 있어도 반 선택 화면이 표시된다.

- [ ] **Step 2: 최소 구현 적용**

`src/App.tsx`의 상태 초기화 부분을 다음 코드로 교체한다.

```tsx
const [selectedClass, setSelectedClass] = useState<SelectedClass | null>(() =>
  getSelectedClass(),
);
const [screen, setScreen] = useState<Screen>(() =>
  selectedClass ? "dashboard" : "select",
);
```

`selectedClass`를 먼저 복원하고, 그 값을 사용해 첫 화면을 한 번만 결정한다. 기존 `handleEnterClass`와 `onChangeClass`는 변경하지 않는다.

- [ ] **Step 3: 타입 검사와 프로덕션 빌드 확인**

Run:

```powershell
$env:PATH = 'C:\Users\sol2508\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
pnpm build
```

Expected: `tsc --noEmit`과 `vite build`가 오류 없이 끝나고 `dist/assets/app.js`가 생성된다.

- [ ] **Step 4: 로컬 브라우저 회귀 테스트**

Run:

```powershell
$env:PATH = 'C:\Users\sol2508\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
pnpm dev --host 127.0.0.1
```

브라우저 자동화로 다음 순서를 확인한다.

```text
1. classmap:selectedClass 삭제 후 접속 -> 반 선택 화면
2. 2학년 3반 선택 -> 2학년 3반 캘린더
3. 새로고침 -> 선택 화면 없이 2학년 3반 캘린더
4. 반 변경 클릭 -> 반 선택 화면
5. 1학년 2반 선택 후 새로고침 -> 1학년 2반 캘린더
6. 저장값을 잘못된 JSON으로 바꾼 뒤 새로고침 -> 반 선택 화면
7. 브라우저 콘솔 오류 -> 0개
```

Expected: 일곱 항목이 모두 충족된다.

- [ ] **Step 5: 구현 커밋**

```powershell
git add -- src/App.tsx
git commit -m "fix: 선택한 반으로 캘린더 바로 열기"
```

Expected: 설계 문서 커밋과 분리된 구현 커밋이 생성된다.

---

### Task 2: main 배포 및 실제 사이트 확인

**Files:**
- Deploy: `.github/workflows/deploy.yml`의 기존 GitHub Pages 워크플로 사용
- Verify: `https://chabin0000.github.io/Suhang-Moa/`

**Interfaces:**
- Consumes: Task 1의 빌드 성공 커밋
- Produces: 재접속 복원 동작이 반영된 GitHub Pages 사이트

- [ ] **Step 1: 작업 브랜치를 원격에 게시**

```powershell
git push -u origin fix/restore-selected-class
```

Expected: 원격 `fix/restore-selected-class` 브랜치가 생성 또는 갱신된다.

- [ ] **Step 2: main에 빠르게 병합하고 배포 시작**

```powershell
git switch main
git pull --ff-only origin main
git merge --ff-only fix/restore-selected-class
git push origin main
```

Expected: `main`이 구현 커밋까지 이동하고 GitHub Pages 배포 워크플로가 시작된다.

- [ ] **Step 3: 실제 사이트 재접속 확인**

배포 완료 후 브라우저에서 다음을 실행한다.

```javascript
localStorage.setItem(
  "classmap:selectedClass",
  JSON.stringify({ grade: 2, classNo: 3 }),
);
location.reload();
```

Expected: `2학년 3반 ClassMap` 캘린더가 바로 표시되고 콘솔 오류가 없다. `반 변경` 버튼을 누르면 선택 화면으로 이동한다.
