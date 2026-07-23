# Shared Schedule Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 개인용 수행평가 캘린더를 유지하면서 학생이 반 일정을 여러 개 제안하고, 지정된 관리자가 검토한 일정과 의견만 전체 학생에게 공개되는 실제 Firebase 기반 MVP를 완성한다.

**Architecture:** React/Vite 정적 앱은 GitHub Pages에서 실행하고, 개인 일정은 브라우저 LocalStorage에만 저장한다. 공유 일정, 일정 제안, 의견 제안, 관리자 권한은 Firebase Authentication, Cloud Firestore, App Check로 처리한다. 일반 학생은 제출 순간에만 익명 인증을 사용하고, 관리자는 Google 로그인 후 Firestore Rules가 확인한 반 범위 안에서 트랜잭션으로 승인 또는 반려한다.

**Tech Stack:** React 19, TypeScript 5, Vite 6, Firebase JS SDK 12, Cloud Firestore, Firebase Authentication, App Check reCAPTCHA Enterprise, Zod 4, Vitest 4, Testing Library, Firebase Emulator Suite, Playwright, GitHub Actions, GitHub Pages

## Global Constraints

- 별도 Node.js API 서버, Cloud Functions, Firebase Hosting은 만들지 않는다.
- Google Classroom 연동과 관련된 코드, API, OAuth scope는 이번 구현에 포함하지 않는다.
- 공개 앱 경로와 Vite base는 계속 `/Suhang-Moa/`를 사용한다.
- 일반 조회는 로그인 없이 가능해야 한다.
- 개인 일정은 LocalStorage에만 저장하고 다른 사용자나 기기에 공개하지 않는다.
- 일정 제안과 의견 제안은 바로 공개하지 않고 항상 `pending`으로 저장한다.
- 최고 관리자 이메일은 `chabin0960@gmail.com`이며, Rules에서 `email_verified == true`도 함께 검사한다.
- 반 관리자는 Firebase Console에서 `admins/{uid}` 문서로만 등록한다. 관리자 관리 UI는 만들지 않는다.
- 비밀번호, OAuth 토큰, 서비스 계정 JSON, App Check debug token은 Git 또는 GitHub 변수에 넣지 않는다.
- Firebase Web config와 reCAPTCHA Enterprise site key는 공개 설정값이므로 GitHub Actions repository variables로 주입한다.
- `.superpowers/` 시각 검토 산출물은 커밋하지 않는다.
- 구현은 각 작업의 실패 테스트를 먼저 만들고, 최소 코드로 통과시킨 뒤 전체 회귀 테스트를 실행한다.
- 보안 판단은 클라이언트 UI가 아니라 Firestore Security Rules가 최종 권한을 가진다.
- App Check는 Rules를 대체하지 않는다. 배포 후 Firestore enforcement를 별도로 활성화한다.
- 승인된 설계 문서 `docs/superpowers/specs/2026-07-23-shared-schedule-moderation-design.md`가 범위와 제품 결정의 기준이다.

---

## File Map

### Root and configuration

- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `vite.config.ts`
- Modify: `.github/workflows/deploy.yml`
- Create: `.env.example`
- Create: `vitest.config.ts`
- Create: `vitest.rules.config.ts`
- Create: `playwright.config.ts`
- Create: `firebase.json`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create after the real Firebase project is created: `.firebaserc`
- Modify at final delivery: `README.md`

### Domain, validation, and storage

- Modify: `src/types.ts`
- Modify: `src/utils/storage.ts`
- Create: `src/utils/classId.ts`
- Create: `src/utils/calendarItems.ts`
- Create: `src/schemas/schedule.ts`
- Create: `src/schemas/proposal.ts`
- Create: `src/schemas/opinion.ts`
- Create: `src/schemas/moderation.ts`

### Firebase boundary

- Create: `src/firebase/config.ts`
- Create: `src/firebase/app.ts`
- Create: `src/firebase/auth.ts`
- Create: `src/firebase/appCheck.ts`
- Create: `src/services/sharedScheduleService.ts`
- Create: `src/services/proposalService.ts`
- Create: `src/services/opinionService.ts`
- Create: `src/services/adminService.ts`

### Hooks and UI

- Modify: `src/App.tsx`
- Modify: `src/components/ClassDashboard.tsx`
- Modify: `src/components/CalendarMonth.tsx`
- Modify: `src/components/ScheduleList.tsx`
- Modify: `src/components/ScheduleModal.tsx`
- Modify: `src/components/SummaryWidgets.tsx`
- Modify: `src/index.css`
- Create: `src/hooks/useHashRoute.ts`
- Create: `src/hooks/useSharedSchedules.ts`
- Create: `src/hooks/useMyProposals.ts`
- Create: `src/hooks/useAdminSession.ts`
- Create: `src/hooks/useModerationQueue.ts`
- Create: `src/components/AddScheduleMenu.tsx`
- Create: `src/components/ProposalModal.tsx`
- Create: `src/components/ProposalCart.tsx`
- Create: `src/components/ProposalStatusPanel.tsx`
- Create: `src/components/ScheduleDetails.tsx`
- Create: `src/components/OpinionForm.tsx`
- Create: `src/components/OpinionList.tsx`
- Create: `src/components/admin/AdminLoginButton.tsx`
- Create: `src/components/admin/AdminPage.tsx`
- Create: `src/components/admin/ModerationTabs.tsx`
- Create: `src/components/admin/ProposalReviewPanel.tsx`
- Create: `src/components/admin/OpinionReviewPanel.tsx`
- Create: `src/components/admin/ModerationHistory.tsx`

### Tests

- Create: `src/test/setup.ts`
- Create: `src/test/fixtures.ts`
- Create: `src/test/tooling.test.ts`
- Create: `src/utils/storage.test.ts`
- Create: `src/utils/calendarItems.test.ts`
- Create: `src/firebase/config.test.ts`
- Create: `src/components/ClassDashboard.test.tsx`
- Create: `src/components/ProposalModal.test.tsx`
- Create: `src/components/ScheduleDetails.test.tsx`
- Create: `src/components/admin/AdminPage.test.tsx`
- Create: `src/services/proposalService.test.ts`
- Create: `src/services/opinionService.test.ts`
- Create: `src/services/adminService.test.ts`
- Create: `src/services/sharedScheduleService.test.ts`
- Create: `tests/rules/firestore.rules.test.ts`
- Create: `e2e/global-setup.ts`
- Create: `e2e/classmap.spec.ts`

## Stable Domain Contracts

All later tasks use these contracts. Do not introduce parallel versions of the same model.

```ts
export type ClassId = `grade-${1 | 2 | 3}-class-${number}`;

export const SCHEDULE_TYPES = [
  "performance",
  "exam",
  "homework",
  "material",
  "etc",
] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export interface PersonalSchedule {
  source: "personal";
  id: string;
  grade: number;
  classNo: number;
  title: string;
  subject?: string;
  description?: string;
  type: ScheduleType;
  dueDate: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SharedEvent {
  source: "shared";
  id: string;
  classId: ClassId;
  title: string;
  subject?: string;
  description?: string;
  type: ScheduleType;
  dueDate: string;
  status: "published";
}

export type CalendarItem = PersonalSchedule | SharedEvent;

export interface ScheduleDraft {
  title: string;
  subject: string;
  description: string;
  type: ScheduleType;
  dueDate: string;
}

export interface ProposalDraft extends ScheduleDraft {
  nickname: string;
}

export type ProposalStatus = "pending" | "approved" | "rejected";
export type ModerationRole = "super_admin" | "class_admin";

export interface AdminScope {
  role: ModerationRole;
  classIds: ClassId[];
}
```

Service modules expose functions through narrow interfaces so UI tests can inject fakes without importing Firebase internals.

```ts
export interface SharedScheduleGateway {
  subscribePublished(
    classId: ClassId,
    onNext: (events: SharedEvent[]) => void,
    onError: (error: Error) => void,
  ): () => void;
}

export interface ProposalGateway {
  submitBatch(classId: ClassId, drafts: ProposalDraft[]): Promise<string[]>;
  subscribeMine(
    ownerUid: string,
    onNext: (items: ScheduleProposal[]) => void,
    onError: (error: Error) => void,
  ): () => void;
}

export interface OpinionGateway {
  subscribePublished(
    classId: ClassId,
    eventId: string,
    onNext: (items: PublishedOpinion[]) => void,
    onError: (error: Error) => void,
  ): () => void;
  submit(classId: ClassId, eventId: string, draft: OpinionDraft): Promise<string>;
}
```

---

## Task 1: Add deterministic test and Firebase tooling

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `vitest.config.ts`
- Create: `vitest.rules.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/fixtures.ts`
- Create: `src/test/tooling.test.ts`

- [ ] **Step 1: Confirm the bundled Node runtime and clean worktree scope**

Run:

```powershell
$env:PATH='C:\Users\sol2508\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
node --version
pnpm --version
git status --short
```

Expected:

```text
v24.14.0
11.9.0
?? .superpowers/
```

Do not delete `.superpowers/`; ignore it in the next step.

- [ ] **Step 2: Write a failing Vitest smoke test**

Create `src/test/tooling.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("test tooling", () => {
  it("runs in the jsdom environment", () => {
    expect(document.createElement("div")).toBeInstanceOf(HTMLDivElement);
  });
});
```

Run:

```powershell
pnpm test:run
```

Expected: failure because `test:run` and Vitest are not configured yet.

- [ ] **Step 3: Install exact dependencies**

Run:

```powershell
pnpm add firebase@12.16.0 zod@4.4.3
pnpm add -D vitest@4.1.10 @testing-library/react@16.3.2 @testing-library/jest-dom@7.0.0 jsdom@29.1.1 @firebase/rules-unit-testing@5.0.1 firebase-tools@15.24.0 @playwright/test@1.61.1
```

Expected: `package.json` and `pnpm-lock.yaml` update without peer dependency errors.

- [ ] **Step 4: Configure scripts and test setup**

Set `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "test:rules": "firebase emulators:exec --only firestore \"vitest run --config vitest.rules.config.ts\"",
    "test:e2e": "playwright test",
    "verify": "pnpm test:run && pnpm build"
  }
}
```

Create `vitest.config.ts` with `environment: "jsdom"`, `setupFiles: ["./src/test/setup.ts"]`, CSS enabled, and exclusions for `tests/rules/**` and `e2e/**`.

Create `vitest.rules.config.ts` with `environment: "node"` and only `tests/rules/**/*.test.ts`.

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `src/test/fixtures.ts` with typed factories for `SelectedClass`, `PersonalSchedule`, `SharedEvent`, and proposal records. Factories must accept `Partial<T>` overrides and use fixed dates, never `new Date()` defaults.

Add to `.gitignore`:

```gitignore
.superpowers/
.firebase/
firebase-debug.log
firestore-debug.log
playwright-report/
test-results/
.env.*
!.env.example
```

- [ ] **Step 5: Run the smoke test**

Run:

```powershell
pnpm test:run
```

Expected: one test passes.

- [ ] **Step 6: Commit tooling**

```powershell
git add .gitignore package.json pnpm-lock.yaml vitest.config.ts vitest.rules.config.ts src/test
git commit -m "test: add Firebase-ready test tooling"
```

---

## Task 2: Migrate LocalStorage schedules to explicit personal schedules

**Files:**
- Modify: `src/types.ts`
- Modify: `src/utils/storage.ts`
- Create: `src/utils/classId.ts`
- Create: `src/schemas/schedule.ts`
- Create: `src/utils/storage.test.ts`

- [ ] **Step 1: Write migration and class ID tests**

Cover these cases in `src/utils/storage.test.ts`:

1. A valid legacy schedule without `source` loads as `source: "personal"`.
2. Existing `id`, `grade`, `classNo`, `createdAt`, and text fields are preserved exactly.
3. A migrated value is written back once in the normalized format.
4. A current personal schedule round-trips unchanged.
5. Invalid array members are skipped without dropping valid members.
6. `toClassId({ grade: 1, classNo: 2 })` returns `grade-1-class-2`.
7. `parseClassId("grade-1-class-2")` returns the matching selected class.
8. Grades outside 1–3 and classes outside 1–12 are rejected.

Run:

```powershell
pnpm vitest run src/utils/storage.test.ts
```

Expected: failures because the discriminated model and conversion functions do not exist.

- [ ] **Step 2: Define the domain types and Zod schema**

Replace the old single `Schedule` model with the contracts in “Stable Domain Contracts.” Keep this temporary compatibility alias only until all components are migrated:

```ts
export type Schedule = PersonalSchedule;
```

In `src/schemas/schedule.ts`, define:

```ts
export const scheduleTypeSchema = z.enum(SCHEDULE_TYPES);

export const scheduleDraftSchema = z.object({
  title: z.string().trim().min(1).max(80),
  subject: z.string().trim().max(40),
  description: z.string().trim().max(1000),
  type: scheduleTypeSchema,
  dueDate: z.string().refine(isRealIsoDate, "유효한 날짜를 입력해 주세요."),
});
```

`isRealIsoDate` must validate both `YYYY-MM-DD` format and calendar existence by round-tripping UTC year, month, and day.

- [ ] **Step 3: Implement class ID conversion**

`src/utils/classId.ts` exports:

```ts
export function toClassId(selectedClass: SelectedClass): ClassId;
export function parseClassId(classId: string): SelectedClass | null;
export function isClassId(value: unknown): value is ClassId;
```

Use one anchored regular expression and numeric range checks. Do not parse class IDs with repeated string splitting across services.

- [ ] **Step 4: Implement lossless normalization**

`loadSchedules()` must:

- parse only arrays;
- validate each entry independently;
- add `source: "personal"` when it is absent;
- preserve valid legacy values;
- write the normalized array back only if migration changed at least one item;
- return `PersonalSchedule[]`.

`saveSchedules()` must accept only `PersonalSchedule[]`.

- [ ] **Step 5: Run focused and full tests**

```powershell
pnpm vitest run src/utils/storage.test.ts
pnpm test:run
```

Expected: all tests pass.

- [ ] **Step 6: Commit the migration**

```powershell
git add src/types.ts src/schemas/schedule.ts src/utils/classId.ts src/utils/storage.ts src/utils/storage.test.ts
git commit -m "refactor: model local schedules as personal data"
```

---

## Task 3: Merge personal and shared calendar items without weakening personal CRUD

**Files:**
- Create: `src/utils/calendarItems.ts`
- Create: `src/utils/calendarItems.test.ts`
- Modify: `src/components/ClassDashboard.tsx`
- Modify: `src/components/CalendarMonth.tsx`
- Modify: `src/components/ScheduleList.tsx`
- Modify: `src/components/ScheduleModal.tsx`
- Modify: `src/components/SummaryWidgets.tsx`
- Modify: `src/index.css`
- Create: `src/components/ClassDashboard.test.tsx`

- [ ] **Step 1: Write calendar merge and CRUD tests**

Test:

- filtering personal schedules by `grade` and `classNo`;
- filtering shared events by the exact `classId`;
- deterministic sort by `dueDate`, then `title`, then `source:id`;
- identical IDs from different sources remain separate;
- personal schedule create, edit, and delete update LocalStorage;
- shared entries never render edit/delete controls;
- changing a personal entry does not mutate a shared entry;
- clicking an event is distinct from clicking the date cell.

Run:

```powershell
pnpm vitest run src/utils/calendarItems.test.ts src/components/ClassDashboard.test.tsx
```

Expected: failures for missing `CalendarItem` support and edit behavior.

- [ ] **Step 2: Implement pure merge helpers**

`src/utils/calendarItems.ts` exports:

```ts
export function getCalendarItemsForClass(
  personal: PersonalSchedule[],
  shared: SharedEvent[],
  selectedClass: SelectedClass,
): CalendarItem[];

export function isPersonalSchedule(item: CalendarItem): item is PersonalSchedule;
export function isSharedEvent(item: CalendarItem): item is SharedEvent;
```

The function is pure and never mutates input arrays.

- [ ] **Step 3: Add create/edit mode to the existing schedule modal**

Change `ScheduleModal` props to:

```ts
interface ScheduleModalProps {
  mode: "create" | "edit";
  initialValue?: PersonalSchedule;
  defaultDate?: string;
  onCancel(): void;
  onSubmit(draft: ScheduleDraft): void;
}
```

Use the same visual structure for both modes. The overline/title are:

- create: `PERSONAL SCHEDULE` / `내 일정 추가`
- edit: `PERSONAL SCHEDULE` / `내 일정 수정`

Validate through `scheduleDraftSchema` before calling `onSubmit`.

- [ ] **Step 4: Refactor calendar interaction markup**

The current whole-day button cannot contain event buttons. Change each day cell to a non-button container with:

- one date-number button for selecting the date;
- one button per event for opening details;
- `aria-label` values that include date, title, and source;
- stable CSS dimensions so event labels do not resize the grid.

Render `내 일정` and `반 일정` source badges. Personal entries expose edit/delete only in the list or details action area.

- [ ] **Step 5: Update dashboard state**

`ClassDashboard` owns `PersonalSchedule[]`, receives `SharedEvent[]` as a prop, derives `CalendarItem[]`, and exposes:

```ts
function addPersonalSchedule(draft: ScheduleDraft): void;
function updatePersonalSchedule(id: string, draft: ScheduleDraft): void;
function deletePersonalSchedule(id: string): void;
```

Set `updatedAt` only on edit. Continue using UUID creation from the existing storage utility.
After every component accepts `PersonalSchedule` or `CalendarItem`, remove the temporary `Schedule = PersonalSchedule` compatibility alias from `src/types.ts`.

- [ ] **Step 6: Run tests and build**

```powershell
pnpm vitest run src/utils/calendarItems.test.ts src/components/ClassDashboard.test.tsx
pnpm test:run
pnpm build
```

Expected: tests pass; build emits `dist/assets/app.js` and `dist/assets/main.css`.

- [ ] **Step 7: Commit calendar refactor**

```powershell
git add src/utils/calendarItems.ts src/utils/calendarItems.test.ts src/components src/index.css
git commit -m "feat: separate personal and shared calendar items"
```

---

## Task 4: Add Firebase configuration, authentication, App Check, and emulator boundaries

**Files:**
- Create: `.env.example`
- Create: `firebase.json`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `src/firebase/config.ts`
- Create: `src/firebase/config.test.ts`
- Create: `src/firebase/app.ts`
- Create: `src/firebase/auth.ts`
- Create: `src/firebase/appCheck.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Write configuration guard tests**

Test in `src/firebase/config.test.ts`:

- a complete public Firebase config parses;
- a missing variable returns a disabled backend state in local development;
- `VITE_APPCHECK_DEBUG=true` is rejected when mode is production;
- emulator mode never initializes App Check;
- raw error messages never contain config object serialization.

Run:

```powershell
pnpm vitest run src/firebase/config.test.ts
```

Expected: failure because the config parser does not exist.

- [ ] **Step 2: Add public environment contract**

Create `.env.example`:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=
VITE_USE_FIREBASE_EMULATORS=false
VITE_APPCHECK_DEBUG=false
```

`src/firebase/config.ts` must parse `ImportMetaEnv` through Zod and expose:

```ts
export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  recaptchaEnterpriseSiteKey: string;
  useEmulators: boolean;
  appCheckDebug: boolean;
}

export function readFirebaseConfig(
  env: ImportMetaEnv,
  mode: string,
): { enabled: true; value: FirebasePublicConfig } | { enabled: false };
```

Do not expose an App Check debug token variable.

- [ ] **Step 3: Initialize Firebase exactly once**

`src/firebase/app.ts` exports lazy getters:

```ts
export function getFirebaseApp(): FirebaseApp | null;
export function getFirestoreDb(): Firestore | null;
export function getFirebaseAuth(): Auth | null;
```

Initialization behavior:

- no config: return `null` so personal schedules still work;
- emulator mode: connect Auth to `127.0.0.1:9099` and Firestore to `127.0.0.1:8080` exactly once;
- production: initialize App Check before the first Firestore request.

- [ ] **Step 4: Implement separate student and admin auth commands**

`src/firebase/auth.ts` exports:

```ts
export async function ensureAnonymousStudent(): Promise<User>;
export async function signInAdminWithGoogle(): Promise<User>;
export async function signOutCurrentUser(): Promise<void>;
export function subscribeAuthState(listener: (user: User | null) => void): Unsubscribe;
```

Both modes use `browserLocalPersistence`. `ensureAnonymousStudent()` must reject an existing non-anonymous Google user with a Korean UI-safe error code rather than silently signing that administrator out.

Google login uses `GoogleAuthProvider` and `signInWithPopup`.

- [ ] **Step 5: Initialize App Check safely**

`src/firebase/appCheck.ts` exports `initializeWebAppCheck(app, config)`.

- production: use `ReCaptchaEnterpriseProvider`;
- local explicit debug mode: set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` before initialization;
- emulator mode: skip App Check;
- production with debug enabled: throw before initializing Firebase.

The actual debug token printed by Firebase is registered only in Firebase Console and never written to disk.

- [ ] **Step 6: Add emulator and initial deny-all files**

Create `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

Start with deny-all `firestore.rules`:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Start `firestore.indexes.json` with an empty valid indexes array. Full rules and indexes arrive in Task 11.

- [ ] **Step 7: Add CI-only production environment validation**

In `vite.config.ts`, use `loadEnv`. During `CI=true` production builds, throw with only the missing variable names if any Firebase variable is empty. Local builds remain available in personal-only mode.

- [ ] **Step 8: Run tests and commit**

```powershell
pnpm vitest run src/firebase/config.test.ts
pnpm test:run
git add .env.example firebase.json firestore.rules firestore.indexes.json src/firebase vite.config.ts
git commit -m "feat: add secure Firebase client boundary"
```

---

## Task 5: Subscribe to published shared schedules

**Files:**
- Create: `src/services/sharedScheduleService.ts`
- Create: `src/hooks/useSharedSchedules.ts`
- Create: `src/services/sharedScheduleService.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/ClassDashboard.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write service and hook behavior tests**

Test:

- only documents with `status: "published"` are mapped;
- malformed documents are skipped and reported to the error callback;
- Firestore timestamps do not leak into the UI model;
- changing classes unsubscribes from the previous listener;
- network failure leaves personal schedules usable and displays a compact shared-data error;
- pending proposal records never enter `CalendarItem[]`.

Run:

```powershell
pnpm vitest run src/services/sharedScheduleService.test.ts
```

Expected: failure because the gateway does not exist.

- [ ] **Step 2: Implement strict Firestore conversion**

Define the stored event schema in `src/services/sharedScheduleService.ts`. Convert only:

```ts
{
  source: "shared",
  id: snapshot.id,
  classId,
  title,
  subject,
  description,
  type,
  dueDate,
  status: "published"
}
```

Never cast `snapshot.data()` directly to `SharedEvent`.

- [ ] **Step 3: Implement the published query**

The default Firebase gateway uses:

```ts
query(
  collection(db, "classes", classId, "events"),
  where("status", "==", "published"),
  orderBy("dueDate", "asc"),
);
```

Return the `onSnapshot` unsubscribe function.

- [ ] **Step 4: Add the hook and dashboard integration**

`useSharedSchedules(classId, gateway)` returns:

```ts
{
  events: SharedEvent[];
  loading: boolean;
  error: "firebase-disabled" | "permission-denied" | "network" | null;
}
```

`App` derives the current `classId` from the restored class selection and passes shared events into `ClassDashboard`. The class selection must continue reopening directly on reconnect.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/services/sharedScheduleService.test.ts src/components/ClassDashboard.test.tsx
pnpm test:run
pnpm build
git add src/services/sharedScheduleService.ts src/services/sharedScheduleService.test.ts src/hooks/useSharedSchedules.ts src/App.tsx src/components/ClassDashboard.tsx src/index.css
git commit -m "feat: display published class schedules"
```

---

## Task 6: Build the two-path add flow and multi-item proposal cart

**Files:**
- Create: `src/schemas/proposal.ts`
- Create: `src/services/proposalService.ts`
- Create: `src/services/proposalService.test.ts`
- Create: `src/hooks/useMyProposals.ts`
- Create: `src/components/AddScheduleMenu.tsx`
- Create: `src/components/ProposalModal.tsx`
- Create: `src/components/ProposalCart.tsx`
- Create: `src/components/ProposalStatusPanel.tsx`
- Create: `src/components/ProposalModal.test.tsx`
- Modify: `src/components/ClassDashboard.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write schema, batch, and UI failure tests**

Cover:

- nickname 1–20 characters;
- title 1–80, subject 0–40, description 0–1000;
- a real `YYYY-MM-DD` due date;
- 1–10 proposals per batch;
- the current class is fixed and cannot be edited in the proposal modal;
- “제안 목록에 담기” resets schedule fields but retains nickname;
- remove one item from the cart;
- 11th item is rejected;
- double-clicking submit causes one in-flight write;
- failed batch retains all cart items;
- successful batch clears the cart;
- proposal docs share one `batchId` and each gets its own document ID;
- no current student session triggers anonymous sign-in;
- a Google admin session produces a clear logout-required error;
- the plus action menu contains exactly `내 일정 추가` and `반 일정 제안`.

Run:

```powershell
pnpm vitest run src/services/proposalService.test.ts src/components/ProposalModal.test.tsx
```

Expected: failure for missing schema, service, and components.

- [ ] **Step 2: Define proposal records**

`src/schemas/proposal.ts` must define client and stored models:

```ts
export interface ScheduleProposal {
  id: string;
  batchId: string;
  ownerUid: string;
  classId: ClassId;
  nickname: string;
  title: string;
  subject: string;
  description: string;
  type: ScheduleType;
  dueDate: string;
  status: ProposalStatus;
  createdAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  publishedEventId: string | null;
}
```

The Firestore write shape includes every review field initialized to `null`, `status: "pending"`, and `createdAt: serverTimestamp()`.

- [ ] **Step 3: Implement an atomic batch service**

`proposalService.submitBatch()` must:

1. parse the full array with Zod;
2. call `ensureAnonymousStudent()`;
3. generate one local `batchId`;
4. allocate one Firestore document reference per proposal;
5. add all creates to one `writeBatch`;
6. commit once;
7. return the created document IDs only after success.

Include a hidden honeypot field in the UI and a 30-second LocalStorage cooldown after a successful submission. Treat both as UX abuse reduction, not security guarantees.

- [ ] **Step 4: Implement proposal ownership history**

`useMyProposals` waits for an existing anonymous auth session and subscribes with:

```ts
query(
  collection(db, "scheduleProposals"),
  where("ownerUid", "==", user.uid),
  orderBy("createdAt", "desc"),
  limit(50),
);
```

`ProposalStatusPanel` displays pending, approved, and rejected states plus the rejection reason. It does not expose edit or delete.

- [ ] **Step 5: Build the approved modal interaction**

`AddScheduleMenu` is an icon-triggered menu or mobile bottom sheet, not a pair of permanent text buttons.

`ProposalModal` follows the existing ScheduleModal visual order:

1. `SCHEDULE PROPOSAL` / `반 일정 제안`;
2. current class badge;
3. nickname;
4. title;
5. subject;
6. type;
7. due date;
8. description;
9. `제안 목록에 담기`;
10. cart list with count and remove controls;
11. `검토 요청`.

The cart is capped at 10 and the submit button uses a send icon from `lucide-react`.

- [ ] **Step 6: Connect both add modes**

In `ClassDashboard`:

- `내 일정 추가` opens the existing personal modal and immediately saves locally;
- `반 일정 제안` opens the proposal modal and never adds entries to the visible calendar;
- successful submission shows a confirmation and updates only the status panel.

- [ ] **Step 7: Verify and commit**

```powershell
pnpm vitest run src/services/proposalService.test.ts src/components/ProposalModal.test.tsx src/components/ClassDashboard.test.tsx
pnpm test:run
pnpm build
git add src/schemas/proposal.ts src/services/proposalService.ts src/services/proposalService.test.ts src/hooks/useMyProposals.ts src/components/AddScheduleMenu.tsx src/components/ProposalModal.tsx src/components/ProposalCart.tsx src/components/ProposalStatusPanel.tsx src/components/ProposalModal.test.tsx src/components/ClassDashboard.tsx src/index.css
git commit -m "feat: add moderated class schedule proposals"
```

---

## Task 7: Add in-site schedule details and moderated opinions

**Files:**
- Create: `src/schemas/opinion.ts`
- Create: `src/services/opinionService.ts`
- Create: `src/services/opinionService.test.ts`
- Create: `src/components/ScheduleDetails.tsx`
- Create: `src/components/OpinionForm.tsx`
- Create: `src/components/OpinionList.tsx`
- Create: `src/components/ScheduleDetails.test.tsx`
- Modify: `src/components/ClassDashboard.tsx`
- Modify: `src/components/CalendarMonth.tsx`
- Modify: `src/components/ScheduleList.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write opinion and details tests**

Cover:

- clicking either a calendar pill or list row opens the same details view;
- personal details show personal edit/delete actions and no shared opinion form;
- shared details show approved opinions and a proposal form;
- nickname 1–20 and content 1–500 validation;
- opinion submission signs in anonymously if needed;
- submitted opinion stays out of the public list until approved;
- user content renders as React text, not HTML;
- an archived or missing parent event rejects a new opinion;
- a failed write keeps form text for retry.

Run:

```powershell
pnpm vitest run src/services/opinionService.test.ts src/components/ScheduleDetails.test.tsx
```

Expected: failure because opinion models and details UI do not exist.

- [ ] **Step 2: Define opinion schemas**

Use:

```ts
export interface OpinionDraft {
  nickname: string;
  content: string;
}

export interface PublishedOpinion extends OpinionDraft {
  id: string;
  sourceProposalId: string;
  status: "published";
  approvedAt: Date | null;
}
```

Stored proposal fields mirror the approved specification and initialize moderation fields to `null`.

- [ ] **Step 3: Implement the opinion service boundary**

The public subscription queries:

```ts
query(
  collection(db, "classes", classId, "events", eventId, "opinions"),
  where("status", "==", "published"),
  orderBy("approvedAt", "desc"),
);
```

Submission:

1. validates the stable `{ classId, eventId }` target;
2. ensures anonymous auth;
3. creates only `opinionProposals/{id}`;
4. never writes directly under public event opinions.

Keep all Firestore paths inside `opinionService` so a future board adapter can replace it without changing `ScheduleDetails`.

- [ ] **Step 4: Build details and opinion UI**

`ScheduleDetails` accepts a `CalendarItem` and service callbacks. For shared items it displays:

- title, subject, type, due date, description;
- approved `OpinionList`;
- `OpinionForm` labeled `팁·의견 남기기`;
- pending-review confirmation after submission.

For personal items it displays only local actions. Use a dialog/drawer responsive pattern and preserve focus on close.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/services/opinionService.test.ts src/components/ScheduleDetails.test.tsx
pnpm test:run
pnpm build
git add src/schemas/opinion.ts src/services/opinionService.ts src/services/opinionService.test.ts src/components/ScheduleDetails.tsx src/components/OpinionForm.tsx src/components/OpinionList.tsx src/components/ScheduleDetails.test.tsx src/components/ClassDashboard.tsx src/components/CalendarMonth.tsx src/components/ScheduleList.tsx src/index.css
git commit -m "feat: add moderated schedule opinions"
```

---

## Task 8: Add Google administrator authentication and hash routing

**Files:**
- Create: `src/hooks/useHashRoute.ts`
- Create: `src/hooks/useAdminSession.ts`
- Create: `src/services/adminService.ts`
- Create: `src/services/adminService.test.ts`
- Create: `src/components/admin/AdminLoginButton.tsx`
- Create: `src/components/admin/AdminPage.tsx`
- Create: `src/components/admin/AdminPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write route and authorization tests**

Cover:

- normal URL renders the public calendar;
- `#/admin` renders the admin page without a server request;
- signed-out state renders Google login;
- verified `chabin0960@gmail.com` becomes `super_admin`;
- same email with `email_verified: false` is unauthorized;
- an active `admins/{uid}` class admin receives only declared class IDs;
- inactive, malformed, or missing admin docs are unauthorized;
- unauthorized Google accounts are signed out after an explanatory message;
- returning to the public hash preserves the selected class.

Run:

```powershell
pnpm vitest run src/services/adminService.test.ts src/components/admin/AdminPage.test.tsx
```

Expected: failure for missing route and admin session modules.

- [ ] **Step 2: Implement hash routing without React Router**

`useHashRoute()` listens to `hashchange` and returns:

```ts
type AppRoute = "calendar" | "admin";
```

Only exact `#/admin` maps to admin. Everything else maps to the calendar, which avoids GitHub Pages 404 behavior.

- [ ] **Step 3: Implement client role discovery**

`adminService.getAdminScope(user)`:

1. checks `user.emailVerified` and exact lowercased super-admin email;
2. otherwise reads `admins/{uid}`;
3. validates `role: "class_admin"`, `active: true`, and `classIds`;
4. returns `null` for invalid data.

The client check controls UI only. Every query and write remains protected by Rules.

- [ ] **Step 4: Build the admin session hook and login page**

`useAdminSession` exposes:

```ts
{
  status: "signed-out" | "checking" | "authorized" | "unauthorized";
  user: User | null;
  scope: AdminScope | null;
  login(): Promise<void>;
  logout(): Promise<void>;
}
```

`AdminPage` has compact work-tool styling, not a marketing hero. Include a clear link back to the calendar and a logout icon button.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/services/adminService.test.ts src/components/admin/AdminPage.test.tsx
pnpm test:run
pnpm build
git add src/hooks/useHashRoute.ts src/hooks/useAdminSession.ts src/services/adminService.ts src/services/adminService.test.ts src/components/admin/AdminLoginButton.tsx src/components/admin/AdminPage.tsx src/components/admin/AdminPage.test.tsx src/App.tsx src/index.css
git commit -m "feat: add administrator login and route"
```

---

## Task 9: Implement idempotent moderation transactions

**Files:**
- Modify: `src/services/adminService.ts`
- Modify: `src/services/adminService.test.ts`
- Create: `src/hooks/useModerationQueue.ts`
- Create: `src/schemas/moderation.ts`

- [ ] **Step 1: Write transaction contract tests**

Using a small injected repository adapter, test:

- schedule approval rereads the proposal inside a transaction;
- only `pending` proposals can transition;
- approval creates one public event and records its ID on the proposal;
- a repeated approval returns `already-processed` and creates no second event;
- admin edits are written only to the public event, not the original proposal fields;
- rejection requires a 1–300 character reason and creates no event;
- event archive changes `status` instead of deleting;
- opinion approval creates one public opinion and links its ID;
- repeated opinion approval creates no duplicate;
- class admins cannot call service commands outside their scope even before Rules reject them;
- super admin can operate on all valid class IDs;
- Firestore transaction conflict maps to `already-processed` or `retryable`, never a raw Firebase message.

Run:

```powershell
pnpm vitest run src/services/adminService.test.ts
```

Expected: new transaction cases fail.

- [ ] **Step 2: Define moderation command models**

`src/schemas/moderation.ts` exports:

```ts
export interface PublishScheduleInput extends ScheduleDraft {
  proposalId: string;
  classId: ClassId;
}

export interface ModerationResult {
  status: "approved" | "rejected" | "already-processed";
  publicId?: string;
}
```

Add equivalent opinion command input and rejection reason schema.

- [ ] **Step 3: Implement schedule approval transaction**

Inside one Firestore `runTransaction`:

1. read `scheduleProposals/{proposalId}`;
2. verify it is `pending` and has the requested `classId`;
3. allocate `classes/{classId}/events/{eventId}`;
4. create the event with `source: "approved-proposal"`, `sourceProposalId`, `status: "published"`, server timestamps, and current admin UID;
5. update only moderation fields on the proposal to `approved`, including `publishedEventId`;
6. return the event ID.

Never use client time for audit fields.

- [ ] **Step 4: Implement rejection and opinion transactions**

Rejection updates only status/audit/reason fields.

Opinion approval creates:

```text
classes/{classId}/events/{eventId}/opinions/{opinionId}
```

and updates `opinionProposals/{proposalId}` in the same transaction. The transaction must first verify the parent event remains `published`.

- [ ] **Step 5: Implement scoped queue subscriptions**

`useModerationQueue(scope, selectedClassId, tab)` uses exact Rules-compatible queries:

- super admin: status + createdAt;
- class admin: classId + status + createdAt;
- history: processed status + reviewedAt;
- never fetch all documents and filter unauthorized classes in the browser.

Return loading, empty, permission error, and retry states.

- [ ] **Step 6: Verify and commit**

```powershell
pnpm vitest run src/services/adminService.test.ts
pnpm test:run
git add src/services/adminService.ts src/services/adminService.test.ts src/hooks/useModerationQueue.ts src/schemas/moderation.ts
git commit -m "feat: add idempotent moderation transactions"
```

---

## Task 10: Build the administrator moderation workspace

**Files:**
- Create: `src/components/admin/ModerationTabs.tsx`
- Create: `src/components/admin/ProposalReviewPanel.tsx`
- Create: `src/components/admin/OpinionReviewPanel.tsx`
- Create: `src/components/admin/ModerationHistory.tsx`
- Modify: `src/components/admin/AdminPage.tsx`
- Modify: `src/components/admin/AdminPage.test.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write administrator workflow tests**

Cover:

- tabs `일정 제안`, `팁·의견`, `처리 내역`;
- class admin sees only assigned class selector options;
- super admin can choose grades 1–3 and classes 1–12;
- selecting an item shows details without losing list context;
- schedule proposal fields can be corrected before publishing;
- approve and reject buttons lock during an in-flight transaction;
- rejection dialog requires a reason;
- processed item disappears from pending and appears in history;
- transaction conflict refreshes the queue;
- mobile layout opens the selected item as a details screen;
- empty, loading, offline, and permission-denied states are distinct.

Run:

```powershell
pnpm vitest run src/components/admin/AdminPage.test.tsx
```

Expected: failures for missing moderation components.

- [ ] **Step 2: Build the shared moderation shell**

Use a compact full-width work surface:

- sticky header with current account and logout;
- tab bar;
- class filter;
- queue list;
- details/editor panel;
- no nested decorative cards;
- buttons use `Check`, `X`, `Archive`, `LogOut`, and `RefreshCw` Lucide icons with tooltips.

- [ ] **Step 3: Build schedule review**

`ProposalReviewPanel` initializes an editable `ScheduleDraft` from the immutable proposal. `승인하고 게시` passes the edited draft to the transaction. It never updates the proposal’s original title, subject, description, type, or date.

- [ ] **Step 4: Build opinion review and history**

Opinions are approved verbatim or rejected; no edit control is provided. History shows action, reviewer UID/email display, reviewed time, class, and rejection reason, with no restore command in this MVP.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/components/admin/AdminPage.test.tsx
pnpm test:run
pnpm build
git add src/components/admin src/index.css
git commit -m "feat: add administrator moderation workspace"
```

---

## Task 11: Enforce access with Firestore Rules and indexes

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Create: `tests/rules/firestore.rules.test.ts`

- [ ] **Step 1: Confirm or install Java 21**

Run:

```powershell
java -version
```

Expected: Java 21 or newer. If the command is missing or older, run:

```powershell
winget install --id EclipseAdoptium.Temurin.21.JDK --exact --accept-package-agreements --accept-source-agreements
```

Open a new shell, restore the bundled Node path, and confirm:

```powershell
java -version
pnpm exec firebase --version
```

Expected: Java 21+ and Firebase CLI `15.24.0`.

- [ ] **Step 2: Write failing emulator tests first**

`tests/rules/firestore.rules.test.ts` must initialize these contexts:

- unauthenticated public;
- anonymous student A;
- anonymous student B;
- verified super admin `chabin0960@gmail.com`;
- unverified user with the same email;
- active class admin for `grade-1-class-2`;
- active class admin for another class;
- inactive class admin.

Seed documents with `withSecurityRulesDisabled`.

Test all of the following:

1. public can query only `published` events;
2. public cannot read archived events;
3. public can query only published opinions under a published event;
4. anonymous A can create a valid pending schedule proposal owned by A;
5. anonymous A cannot set approved status, audit fields, another owner, extra fields, or invalid lengths;
6. anonymous A can read A’s own proposals with an owner-constrained query;
7. anonymous B cannot read A’s proposal;
8. students cannot update or delete proposals;
9. opinions require an existing published parent event in the same class;
10. unverified super-admin email has no admin access;
11. class admin can read and process only assigned class proposals;
12. class admin cannot query a mixed or unscoped proposal set;
13. verified super admin can process all classes;
14. approval requires a matching public event created in the same atomic operation;
15. rejection cannot create or link a public event;
16. original proposal fields are immutable during review;
17. admin documents cannot be written by clients;
18. a user can read only their own admin document; super admin can read all;
19. public/admin query shapes used by services are accepted;
20. deliberately broader queries are rejected.

Run against deny-all rules:

```powershell
pnpm test:rules
```

Expected: permission tests that should allow access fail.

- [ ] **Step 3: Implement exact authorization helpers**

The final `firestore.rules` must include these helpers:

```text
function isSignedIn() {
  return request.auth != null;
}

function isAnonymousStudent() {
  return isSignedIn()
    && request.auth.token.firebase.sign_in_provider == "anonymous";
}

function isSuperAdmin() {
  return isSignedIn()
    && request.auth.token.email_verified == true
    && request.auth.token.email == "chabin0960@gmail.com";
}

function adminPath() {
  return /databases/$(database)/documents/admins/$(request.auth.uid);
}

function isClassAdmin(classId) {
  return isSignedIn()
    && exists(adminPath())
    && get(adminPath()).data.active == true
    && get(adminPath()).data.role == "class_admin"
    && classId in get(adminPath()).data.classIds;
}

function canModerate(classId) {
  return isSuperAdmin() || isClassAdmin(classId);
}
```

Add reusable validation helpers for class IDs, real allowed enum values, string sizes, document field allowlists, and `YYYY-MM-DD` shape. Rules validate date shape; Zod validates calendar existence.

- [ ] **Step 4: Implement collection rules**

Rules behavior must be:

```text
classes/{classId}
  public read
  super admin create/update
  client delete denied

classes/{classId}/events/{eventId}
  public read only when status == "published"
  create/update only canModerate(classId)
  "approved-proposal" create must match the linked approved proposal through getAfter()
  "admin" create must have sourceProposalId == null
  delete denied

classes/{classId}/events/{eventId}/opinions/{opinionId}
  public read only when opinion and parent event are published
  create/update only canModerate(classId)
  create must match the linked approved opinion proposal through getAfter()
  delete denied

scheduleProposals/{proposalId}
  anonymous create only as own pending proposal with allowed fields
  read only owner or moderator for its class
  review update only canModerate(classId), pending -> approved/rejected once
  original fields immutable
  delete denied

opinionProposals/{proposalId}
  same ownership and moderation rules
  create only when referenced parent event is published

admins/{uid}
  read only self or super admin
  all client writes denied
```

For approvals, use `existsAfter()` and `getAfter()` to require a matching public document in the same transaction:

```text
function approvedEventMatches(proposalId) {
  let eventPath = /databases/$(database)/documents/classes/$(request.resource.data.classId)/events/$(request.resource.data.publishedEventId);
  return existsAfter(eventPath)
    && getAfter(eventPath).data.sourceProposalId == proposalId
    && getAfter(eventPath).data.status == "published";
}
```

Implement the equivalent opinion check. Require `createdAt`, `reviewedAt`, `publishedAt`, `approvedAt`, and `updatedAt` server timestamps to equal `request.time` when written.

- [ ] **Step 5: Add required indexes**

`firestore.indexes.json` must include:

- class event collection: `status ASC`, `dueDate ASC`;
- event opinion collection `opinions` with collection query scope: `status ASC`, `approvedAt DESC`;
- schedule proposals: `ownerUid ASC`, `createdAt DESC`;
- schedule proposals: `status ASC`, `createdAt ASC`;
- schedule proposals: `classId ASC`, `status ASC`, `createdAt ASC`;
- schedule proposals history: `classId ASC`, `status ASC`, `reviewedAt DESC`;
- opinion proposals: the same owner, pending, scoped pending, and history combinations.

Use explicit collection group and query scope values generated in Firestore’s documented JSON format.

- [ ] **Step 6: Run security and application tests**

```powershell
pnpm test:rules
pnpm test:run
pnpm build
```

Expected: all Rules tests, unit/component tests, and TypeScript build pass.

- [ ] **Step 7: Commit security policy**

```powershell
git add firestore.rules firestore.indexes.json tests/rules/firestore.rules.test.ts
git commit -m "security: enforce class moderation rules"
```

---

## Task 12: Add end-to-end tests and responsive visual verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/global-setup.ts`
- Create: `e2e/classmap.spec.ts`
- Modify: `package.json`
- Modify: `src/index.css`

- [ ] **Step 1: Write emulator seed setup**

`e2e/global-setup.ts` uses `@firebase/rules-unit-testing` with security disabled to seed:

- class `grade-1-class-2`;
- one published shared event;
- one archived event that must stay hidden;
- one published opinion under the visible event;
- clean proposal collections.

It must clear Firestore between runs and never contact production.

- [ ] **Step 2: Configure Playwright**

`playwright.config.ts`:

- uses Chromium;
- starts Vite on an available fixed test port;
- injects `VITE_USE_FIREBASE_EMULATORS=true` and a deterministic emulator Firebase config;
- uses base URL `http://127.0.0.1:4173/Suhang-Moa/`;
- records screenshots only on failure;
- runs `e2e/global-setup.ts`;
- tests desktop `1440x900` and mobile `390x844`.

Change `test:e2e` to:

```json
"test:e2e": "firebase emulators:exec --only auth,firestore \"playwright test\""
```

- [ ] **Step 3: Write end-to-end flows**

`e2e/classmap.spec.ts` covers:

1. choose grade 1/class 2, reload, and reopen directly on the calendar;
2. create, edit, and delete a personal schedule;
3. confirm personal data stays after reload;
4. confirm the seeded shared event appears and archived event does not;
5. open add menu and submit two schedule proposals in one batch;
6. confirm proposals do not immediately appear in the calendar;
7. open a shared event, view an approved opinion, and submit a new pending opinion;
8. navigate to `#/admin` and see the signed-out administrator screen;
9. verify dialogs, calendar grid, buttons, and text do not overlap on desktop or mobile.

Admin Google popup and production App Check are verified manually in Task 13 because emulators cannot prove the real provider/domain configuration.

- [ ] **Step 4: Run browser tests and inspect screenshots**

Install the browser once:

```powershell
pnpm exec playwright install chromium
```

Run:

```powershell
pnpm test:e2e
```

Expected: both desktop and mobile projects pass.

Use Playwright screenshots plus the in-app browser to inspect:

- calendar event label clipping;
- modal overflow and focus;
- proposal cart at 10 items;
- admin list/details layout;
- visible next content on mobile;
- absence of blank white screens and asset 404s.

Fix only demonstrated layout defects, then rerun the affected test and full suite.

- [ ] **Step 5: Run complete local verification**

```powershell
pnpm test:run
pnpm test:rules
pnpm test:e2e
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit browser coverage**

```powershell
git add playwright.config.ts e2e package.json pnpm-lock.yaml src/index.css
git commit -m "test: cover moderated calendar workflows"
```

---

## Task 13: Create the real Firebase project and deploy the working site

**Files:**
- Create: `.firebaserc`
- Modify: `.github/workflows/deploy.yml`
- Modify: `README.md`
- Modify only if live verification finds a reproducible defect: affected source/test files

- [ ] **Step 1: Create the Firebase project with the signed-in owner account**

Use the user’s existing signed-in Chrome session and Firebase Console:

1. create a project for Suhang-Moa;
2. do not enable paid billing or attach a billing account;
3. create Firestore in Native mode, region `asia-northeast3`;
4. register a Web App;
5. copy the exact generated public Web config;
6. enable Authentication providers `Anonymous` and `Google`;
7. set the Google support email to the project owner account;
8. add `chabin0000.github.io` to Authentication authorized domains;
9. keep `localhost` only for development;
10. create a reCAPTCHA Enterprise site key for `chabin0000.github.io`;
11. register the Web App with App Check using that key.

If the console requires billing for a selected option, stop before accepting it and use the no-billing alternative where available. Never choose a paid plan without a new explicit user approval.

- [ ] **Step 2: Bind the local repository to the exact project**

Authenticate Firebase CLI through the same Google account:

```powershell
pnpm exec firebase login
pnpm exec firebase use --add
```

Choose the newly created project and alias it `default`. This generates `.firebaserc`; verify that its project ID exactly matches Firebase Console.

- [ ] **Step 3: Deploy Rules and indexes before the frontend**

Run:

```powershell
pnpm exec firebase deploy --only firestore:rules,firestore:indexes
```

Expected: deployment succeeds and no Firebase Hosting resource is created.

- [ ] **Step 4: Seed authorization records**

First sign into `#/admin` with `chabin0960@gmail.com`. Confirm:

- Google account email is exactly `chabin0960@gmail.com`;
- Firebase Auth shows `emailVerified: true`;
- the client identifies it as `super_admin`;
- Rules allow its moderator queries.

For each future class administrator:

1. have the account sign in once so Firebase creates its UID;
2. create `admins/{uid}` in Firestore Console;
3. set `role: "class_admin"`;
4. set `classIds` to exact strings such as `grade-1-class-2`;
5. set `active: true`;
6. set `createdAt` to a server timestamp.

No client-side role writer is added.

- [ ] **Step 5: Add GitHub Actions public variables**

Use GitHub repository variables, not secrets, for:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
```

Update `.github/workflows/deploy.yml` build step:

```yaml
env:
  VITE_FIREBASE_API_KEY: ${{ vars.VITE_FIREBASE_API_KEY }}
  VITE_FIREBASE_AUTH_DOMAIN: ${{ vars.VITE_FIREBASE_AUTH_DOMAIN }}
  VITE_FIREBASE_PROJECT_ID: ${{ vars.VITE_FIREBASE_PROJECT_ID }}
  VITE_FIREBASE_STORAGE_BUCKET: ${{ vars.VITE_FIREBASE_STORAGE_BUCKET }}
  VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ vars.VITE_FIREBASE_MESSAGING_SENDER_ID }}
  VITE_FIREBASE_APP_ID: ${{ vars.VITE_FIREBASE_APP_ID }}
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: ${{ vars.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY }}
  VITE_USE_FIREBASE_EMULATORS: "false"
  VITE_APPCHECK_DEBUG: "false"
```

Do not store a debug token in GitHub.

- [ ] **Step 6: Enable App Check enforcement carefully**

In Firebase Console:

1. deploy the frontend first with App Check initialized;
2. inspect App Check metrics for valid requests from GitHub Pages;
3. verify public event reads, anonymous proposal writes, and admin queries;
4. enable enforcement for Cloud Firestore only after valid traffic appears;
5. re-run all three live roles after enforcement.

- [ ] **Step 7: Write final README**

`README.md` must document:

- product purpose and student/admin workflows;
- architecture and why personal schedules stay local;
- local development with the bundled Node PATH fallback;
- `.env.example` fields and which values are public;
- Firebase Emulator and Java 21 requirement;
- test commands;
- Firebase Console setup and administrator document shape;
- deployment commands and GitHub Pages URL;
- security limitations: anonymous identity is not verified, no server-side IP rate limit, LocalStorage does not sync;
- explicit warning never to commit service account JSON, OAuth tokens, or App Check debug tokens.

- [ ] **Step 8: Commit and push**

Run the full verification again:

```powershell
pnpm test:run
pnpm test:rules
pnpm test:e2e
pnpm build
git status --short
```

Expected: only intended files are modified and `.superpowers/` is absent from status.

Commit the final configuration on the feature branch:

```powershell
git add .firebaserc .github/workflows/deploy.yml README.md
git commit -m "docs: add Firebase setup and deployment guide"
git push origin feature/google-classroom-integration
```

The Pages workflow deploys only `main`, so merge the verified feature branch non-destructively:

```powershell
git checkout main
git pull --ff-only origin main
git merge --no-ff feature/google-classroom-integration -m "feat: launch moderated shared calendar"
pnpm test:run
pnpm build
git push origin main
```

Expected: the merge has no unresolved conflicts, the tests/build still pass on `main`, and the push starts the Pages workflow. Never force-push. If `main` changed and a merge conflict occurs, resolve only the conflicting implementation files, rerun the complete verification suite, and then continue.

- [ ] **Step 9: Verify GitHub Pages production**

Wait for the Pages workflow to complete, then test:

```text
https://chabin0000.github.io/Suhang-Moa/
https://chabin0000.github.io/Suhang-Moa/#/admin
```

Verify in the real browser:

- no blank page and no asset 404;
- selected class reopens after refresh;
- published class schedules are publicly readable;
- personal schedules remain browser-local;
- a two-item proposal batch stays pending;
- a pending opinion stays private;
- super admin approves both record types;
- approved schedule/opinion becomes public;
- wrong Google account is denied;
- App Check enforcement remains on;
- GitHub repository contains only the intentionally public highest-admin email and no credentials.

- [ ] **Step 10: Final verification commit only when needed**

If live verification exposes a defect, reproduce it with a failing automated test, fix it on `main`, and rerun the relevant local and live checks. Inspect the exact changed paths before staging:

```powershell
git diff --name-only
git ls-files --others --exclude-standard
```

Stage only the source and test paths shown by those commands, then run:

```powershell
git commit -m "fix: correct production Firebase integration"
git push origin main
```

Do not create an empty “verification” commit.

---

## Completion Gate

Implementation is complete only when all conditions below are true:

- [ ] Class selection persists and reload opens the calendar directly.
- [ ] Personal schedules support create, edit, delete and never leave LocalStorage.
- [ ] Published shared schedules merge into the selected class calendar.
- [ ] Student proposal batches contain 1–10 items and remain hidden until approved.
- [ ] Approved opinions alone appear in shared event details.
- [ ] Verified `chabin0960@gmail.com` has all-class authority.
- [ ] Class admins are limited to their Firestore-declared classes.
- [ ] Approval and rejection transactions are idempotent.
- [ ] Firestore Rules Emulator proves owner, role, class, field, and transition constraints.
- [ ] App Check enforcement is enabled for Firestore after production traffic verification.
- [ ] Unit, component, Rules, end-to-end, and production smoke tests pass.
- [ ] GitHub Pages runs at `/Suhang-Moa/` with no white screen or asset errors.
- [ ] No credentials, service account JSON, OAuth tokens, or debug tokens are committed.
