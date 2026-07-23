# Google Classroom 자동 연동 설계

## 1. 목표와 범위

기존 ClassMap의 학년·반 선택, LocalStorage 수동 일정, 일정 추가·삭제, 월 이동, 요약 위젯, GitHub Pages 배포를 유지하면서 학생 개인의 Google Classroom 과제를 같은 캘린더에 표시한다.

이번 변경은 다음 다섯 단계로 나눈다.

1. 기존 일정 데이터 모델 마이그레이션과 공통 캘린더 날짜 계산
2. Firebase 프로젝트, 인증, 서버 세션 경계와 비밀정보 저장
3. Google Classroom 과제 동기화와 Firestore 저장
4. 계정 UI, 날짜 미지정 과제, 드래그앤드롭과 계획일 관리
5. 자동 테스트, 실제 OAuth 테스트, 배포와 설정 문서

각 단계는 기존 수동 일정 기능이 동작하는 상태로 끝나야 한다. 실제 Google 자격 증명이 없어도 개발용 Mock으로 UI를 검증할 수 있지만, Mock은 실제 API 구현을 대체하지 않는다.

## 2. 선택한 아키텍처

```text
GitHub Pages React 앱
  ├─ Google Identity Services 팝업 코드 요청
  ├─ Firebase Authentication ID token
  └─ HTTPS API 호출
          ↓
Firebase Cloud Functions 2세대의 단일 Express API
  ├─ Google OAuth authorization code 교환
  ├─ Google Classroom API 호출
  ├─ Firebase ID token 검증
  └─ AES-256-GCM refresh token 암호화
          ↓
Cloud Firestore
```

백엔드는 Firebase Cloud Functions 2세대를 사용한다. Cloud Run 기반이면서 Firebase Admin SDK, Firestore, Secret Manager, 로컬 Emulator를 한 도구 체계로 구성할 수 있어 현재 작은 저장소에 직접 Cloud Run 컨테이너를 추가하는 것보다 설정이 적다.

함수와 Firestore의 기본 리전은 서울 `asia-northeast3`으로 맞춘다. Firebase 프로젝트 표시 이름은 `Suhang Moa`로 하고, 프로젝트 ID는 먼저 `suhang-moa-classmap`을 시도한다. 이미 사용 중이면 Firebase가 허용하는 고유 접미사를 붙인다.

## 3. 검토한 대안

### Firebase Functions + Firebase Auth

선택한 방식이다. GIS 코드 흐름으로 Google 권한을 얻고, 백엔드가 Firebase custom token을 발급한다. 프런트는 Firebase SDK가 관리하는 짧은 Firebase ID token으로 API를 호출한다. Google access token과 refresh token은 브라우저에 전달하지 않는다.

### Firebase Functions + 교차 출처 HttpOnly 쿠키

코드는 더 짧지만 GitHub Pages와 Cloud Functions가 서로 다른 사이트이므로 `SameSite=None` 쿠키와 브라우저의 제3자 쿠키 정책에 의존한다. 재접속 안정성이 낮아 선택하지 않는다.

### Cloud Run + Firestore + 자체 세션

컨테이너, 세션 저장소, 배포 설정을 더 자유롭게 제어할 수 있지만 현재 트래픽과 기능 규모에는 운영 복잡성이 크다. 장시간 작업이나 별도 도메인이 필요해질 때 이전 후보로 남긴다.

## 4. Google 인증과 Classroom 승인 흐름

사용자에게는 `Google 학교 계정으로 연결` 버튼 하나만 표시한다. 내부 흐름은 인증과 승인을 분리한다.

1. 프런트가 Google Identity Services의 `google.accounts.oauth2.initCodeClient`를 팝업 모드로 초기화한다.
2. 다음 범위만 요청한다.
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
3. 팝업 콜백이 받은 일회용 authorization code를 `POST /api/auth/google/code`로 보낸다.
4. 프런트는 `X-Requested-With: XmlHttpRequest`를 전송하고 서버는 정확한 `Origin`과 해당 헤더를 검사한다.
5. 백엔드는 Google OAuth Client Secret으로 코드를 access token, refresh token, ID token으로 교환한다.
6. 백엔드는 Google ID token의 서명, `aud`, `iss`, 만료를 검증하고 안정적인 Google `sub`를 얻는다.
7. Firebase UID는 `google:<sub>` 형태로 결정한다. 요청 body의 `userId`는 신뢰하지 않는다.
8. refresh token은 AES-256-GCM으로 암호화해 Firestore의 서버 전용 문서에 저장한다.
9. 백엔드는 Firebase custom token을 한 번 발급한다. 프런트는 `signInWithCustomToken`으로 로그인한다.
10. 이후 모든 보호 API는 `Authorization: Bearer <Firebase ID token>`을 받고 Firebase Admin SDK로 검증한다.

Google은 최초 승인 이후의 code 교환에서 refresh token을 다시 주지 않을 수 있다. 새 refresh token이 없는 재로그인에서는 기존 암호화 refresh token을 절대로 null로 덮어쓰지 않는다. 연결 해제 또는 `invalid_grant` 뒤의 명시적 재연결에서만 다시 동의를 요청한다.

Google custom token과 Firebase ID token은 Google Classroom 토큰이 아니다. Firebase SDK의 로컬 인증 지속성을 사용하되 Google access token이나 refresh token을 LocalStorage, sessionStorage, URL에 저장하지 않는다.

### 로그아웃과 연결 해제

- `POST /api/auth/logout`: Firebase refresh token을 폐기하고 프런트에서 `signOut`한다. 보호 API는 `verifyIdToken(token, true)`로 폐기 여부까지 확인한다. 암호화된 Google 연결과 과제 데이터는 유지하므로 다시 로그인하면 기존 계획일을 불러올 수 있다.
- `POST /api/auth/disconnect`: Google 토큰을 revoke하고 암호화 토큰 문서를 삭제한다. 개인정보 최소화를 위해 해당 사용자의 Classroom 과제 문서도 삭제한다. 이 동작은 확인 대화상자를 거친다.
- Google refresh token이 철회되거나 만료되면 연결 상태를 `reauth-required`로 바꾸고 재연결 버튼을 표시한다.

## 5. Google Cloud와 Firebase 설정

다음 리소스를 같은 Google Cloud/Firebase 프로젝트에 만든다.

- Firebase Web App
- Firebase Authentication
- Cloud Firestore Native mode
- Cloud Functions 2세대
- Secret Manager
- Google Classroom API
- Identity Toolkit API와 Firebase custom token 발급에 필요한 서비스 계정 권한
- OAuth 동의 화면: 우선 External / Testing
- OAuth 2.0 Web Client

OAuth Web Client에는 다음 JavaScript origin을 등록한다.

- `https://chabin0000.github.io`
- `http://localhost:5173`
- Emulator에서 실제 사용하는 로컬 origin

팝업 코드 흐름의 token 교환에는 코드를 요청한 정확한 origin을 `redirect_uri`로 사용한다. 서버는 허용 목록에 있는 origin만 token 교환에 사용한다.

현재 로그인된 Google 계정을 OAuth 테스트 사용자로 등록한다. 학교 계정이 관리 정책으로 외부 앱을 차단하면 정책을 우회하지 않고 관리자 승인 안내를 표시한다.

`github.io`는 공유 도메인이므로 테스트 모드의 GitHub Pages origin은 사용할 수 있어도 공개 OAuth 검증 과정에서 도메인 소유권과 개인정보처리방침 URL 요구를 충족하지 못할 수 있다. 공개 서비스 전환 시 사용자가 소유하고 Search Console에서 검증할 수 있는 custom domain을 GitHub Pages에 연결하는 단계를 별도 승인 항목으로 둔다.

Firebase Functions 배포에 Billing 계정 연결이나 유료 요금제 전환이 요구되면 자동 동의하지 않는다. 프로젝트와 무료 설정은 진행하되, 결제 수단 연결 직전에 사용자 확인을 받는다.

## 6. 서버 환경 변수와 비밀정보

### 프런트 공개 환경 변수

```env
VITE_API_BASE_URL=
VITE_GOOGLE_CLIENT_ID=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_USE_CLASSROOM_MOCK=false
```

Firebase Web App 설정과 OAuth Client ID는 공개 식별자이며 비밀값으로 취급하지 않는다. 그래도 환경별 값을 분리하기 위해 Vite 환경 변수로 둔다.

### 백엔드 일반 환경 설정

```env
FRONTEND_ORIGINS=https://chabin0000.github.io,http://localhost:5173
GOOGLE_REDIRECT_ORIGINS=https://chabin0000.github.io,http://localhost:5173
CLASSROOM_SYNC_CACHE_MINUTES=10
```

### Secret Manager 비밀값

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TOKEN_ENCRYPTION_KEY=
```

`TOKEN_ENCRYPTION_KEY`는 32바이트 난수의 base64 문자열이다. Firebase Authentication이 세션 서명과 갱신을 담당하므로 별도 `SESSION_SECRET`은 사용하지 않는다.

실제 `.env`, 서비스 계정 JSON, Client Secret은 Git에 커밋하지 않는다. 저장소에는 프런트와 Functions용 `.env.example`만 둔다.

## 7. Firestore 데이터 모델

프런트는 Firestore에 직접 접근하지 않는다. 모든 읽기와 쓰기는 Admin SDK를 사용하는 API를 통하며 Firestore 보안 규칙은 클라이언트 접근을 거부한다.

```text
users/{uid}
  googleSub
  displayName
  email
  photoUrl
  connectionStatus
  lastClassroomSyncAt
  createdAt
  updatedAt

users/{uid}/private/googleConnection
  encryptedRefreshToken
  iv
  authTag
  keyVersion
  grantedScopes
  connectedAt
  updatedAt

users/{uid}/classroomAssignments/{externalId}
  source
  externalId
  courseId
  courseName
  courseWorkId
  title
  description
  workType
  alternateLink
  officialDueDate
  officialDueTime
  officialDueAt
  plannedDate
  creationTime
  updateTime
  syncStatus
  missingSince
  lastSyncedAt

rateLimits/{uid_action_window}
  count
  expiresAt
```

`externalId`는 `${courseId}:${courseWorkId}`이다. Firestore 문서 ID에 사용할 때 안전한 문자열인지 확인하고, 허용되지 않는 값이 있으면 base64url 인코딩을 적용한다.

`officialDueDate`는 캘린더에 표시할 `Asia/Seoul` 기준 `YYYY-MM-DD`이고, `officialDueAt`은 원본 UTC 날짜와 시간이 모두 있을 때 만든 ISO timestamp다. `officialDueTime`은 Google이 반환한 UTC 시각을 보존한다.

## 8. 프런트 데이터 모델과 기존 데이터 마이그레이션

```ts
type ManualSchedule = {
  source: "manual";
  id: string;
  grade: number;
  classNo: number;
  title: string;
  subject?: string;
  description?: string;
  type: ScheduleType;
  dueDate: string;
  createdAt: string;
};

type ClassroomAssignment = {
  source: "google-classroom";
  externalId: string;
  courseId: string;
  courseName: string;
  courseWorkId: string;
  title: string;
  description?: string;
  workType?: string;
  alternateLink?: string;
  officialDueDate: string | null;
  officialDueTime?: string | null;
  officialDueAt?: string | null;
  plannedDate: string | null;
  syncStatus: "active" | "archived";
  creationTime?: string;
  updateTime?: string;
  lastSyncedAt: string;
};

type CalendarItem = ManualSchedule | ClassroomAssignment;
```

기존 `classmap:schedules` 항목은 `source`가 없어도 기존 검증을 통과하면 읽는 시점에 `source: "manual"`을 추가한다. 다음 저장 때 새 형식으로 기록하며 id, 학년, 반, 제목, 날짜는 변경하지 않는다.

Classroom 과제는 학생 개인 데이터이므로 현재 선택한 학년·반에 관계없이 대시보드에 표시한다. 수동 일정만 기존처럼 선택한 학년·반으로 필터링한다.

캘린더, 요약 위젯, 일정 목록은 다음 공통 헬퍼만 사용해 날짜를 결정한다.

```ts
function getCalendarDate(item: CalendarItem): string | null {
  if (item.source === "manual") {
    return item.dueDate;
  }

  return item.officialDueDate ?? item.plannedDate;
}
```

## 9. Classroom 동기화

`POST /api/classroom/sync`는 다음 순서로 실행한다.

1. Firebase ID token 검증
2. 사용자별 sync 속도 제한과 중복 실행 잠금
3. 암호화된 refresh token 복호화
4. Google client library로 access token 자동 갱신
5. `courses.list(studentId="me", courseStates=["ACTIVE"])`
6. 모든 `nextPageToken` 처리
7. 최대 동시성 3으로 각 course의 `courses.courseWork.list` 실행
8. `PUBLISHED` 과제만 수집하고 모든 과제 페이지 처리
9. 원본 필드 검증과 ClassMap 형식 변환
10. `externalId` 기준 Firestore batch upsert
11. 기존 `plannedDate` 보존
12. 성공한 course에서 더 이상 보이지 않는 기존 과제만 `syncStatus: "archived"` 처리
13. `lastClassroomSyncAt` 갱신과 부분 실패 메타데이터 응답

한 course의 요청이 실패하면 다른 course 결과는 저장한다. 실패한 course의 기존 과제는 archived로 바꾸지 않는다. archived 과제가 다시 나타나면 active로 복원하고 기존 plannedDate를 유지한다. 과제를 즉시 영구 삭제하지 않는다.

동기화 응답은 성공 course 수, 실패 course 수, upsert 수, archived 수, 마지막 동기화 시각을 반환한다. 개별 Google 오류 본문이나 token은 응답과 로그에 포함하지 않는다.

## 10. UTC 마감일 변환

Google의 `dueDate`와 `dueTime`을 UTC 값으로 조합한 뒤 `Asia/Seoul` 날짜를 계산한다.

- 날짜와 시각이 모두 있으면 `Date.UTC`로 instant를 만든 뒤 `Intl.DateTimeFormat`의 `timeZone: "Asia/Seoul"`로 날짜 부분을 얻는다.
- 방어적으로 dueTime이 없으면 Google의 dueDate를 날짜 키로 사용하고 임의 시각을 덧붙이지 않는다.
- 윤년, 월말, 연말, UTC 15:00 이후로 한국 날짜가 다음 날이 되는 경우를 단위 테스트한다.
- 공식 마감일이 나중에 추가되면 officialDueDate가 plannedDate보다 우선한다. plannedDate 자체는 삭제하지 않아 교사가 공식 날짜를 제거해도 학생 계획을 복구할 수 있다.

## 11. API 계약

```text
POST   /api/auth/google/code
GET    /api/auth/session
POST   /api/auth/logout
POST   /api/auth/disconnect

POST   /api/classroom/sync
GET    /api/classroom/assignments
PATCH  /api/classroom/assignments/:externalId/planned-date
DELETE /api/classroom/assignments/:externalId/planned-date
```

일관된 응답 형식은 다음과 같다.

```ts
type ApiSuccess<T> = { data: T; error: null; meta?: Record<string, unknown> };
type ApiFailure = {
  data: null;
  error: { code: string; message: string };
};
```

`planned-date` PATCH body는 `{ plannedDate: "YYYY-MM-DD" }`만 허용한다. officialDueDate가 있는 과제의 계획일 변경과 해제 요청은 `409 Conflict`로 거부한다. assignment 문서는 인증된 UID의 하위 경로에서만 조회하므로 다른 사용자 문서를 지정할 수 없다.

인증 실패는 401, 권한·관리자 차단은 403, 잘못된 입력은 400, 상태 충돌은 409, 속도 제한은 429, 내부 오류는 일반화된 500을 사용한다.

## 12. 프런트 상태와 컴포넌트 경계

`ClassDashboard`에 Google 인증과 네트워크 로직을 직접 추가하지 않는다. 다음 경계로 분리한다.

```text
src/classroom/api.ts
  API 요청, Firebase ID token 첨부, 응답 파싱

src/classroom/auth.ts
  GIS 로딩, code 요청, Firebase custom token 로그인

src/classroom/mock.ts
  개발 전용 세션과 과제 응답

src/hooks/useClassroomConnection.ts
  연결 상태, 로그인, 로그아웃, 연결 해제, 동기화

src/hooks/useClassroomAssignments.ts
  조회, optimistic plannedDate 변경, 롤백

src/components/ClassroomAccountPanel.tsx
  계정과 동기화 상태 UI

src/components/UndatedAssignments.tsx
  날짜 미지정 과제 카드 목록

src/components/ClassroomAssignmentDetails.tsx
  원본 링크, 계획일 해제, 출처와 날짜 설명
```

`ClassDashboard`는 수동 일정과 hook이 제공한 Classroom 과제를 합쳐 `CalendarItem[]`을 만든다. 요약 위젯과 목록 필터는 `getCalendarDate`가 null이 아닌 항목만 계산한다.

현재 `CalendarMonth`는 전체 날짜 셀이 하나의 `<button>`이다. 과제 pill을 링크·버튼·draggable로 만들면 대화형 요소가 중첩되므로 날짜 셀은 `role="gridcell"`인 컨테이너로 바꾼다. 날짜 숫자와 빈 영역의 명시적 일정 추가 버튼은 기존 `onSelectDate`를 호출하고, 과제 pill은 형제 요소로 렌더링해 상세 열기와 drag가 일정 추가 click으로 전파되지 않게 한다. 시각적 크기와 7열 배치는 유지한다.

## 13. 드래그앤드롭

`@dnd-kit/core`와 `@dnd-kit/sortable`을 사용한다. `DndContext`는 대시보드 범위에 한 번만 둔다.

- 날짜 없는 과제 카드와 plannedDate가 있는 Classroom 과제 pill은 draggable이다.
- officialDueDate가 있는 과제는 draggable이 아니다.
- 캘린더의 42개 날짜 셀은 droppable이다. 앞·뒤 달 날짜 셀도 실제 dateKey로 드롭을 받는다.
- PointerSensor는 터치 스크롤과 충돌하지 않도록 짧은 hold 지연과 이동 허용치를 사용한다.
- KeyboardSensor와 좌표 getter, 라이브 영역 안내로 키보드 배치를 지원한다.
- DragOverlay에 현재 과제 미리보기를 표시한다.
- hover 날짜 셀에는 기존 색상 체계 안에서 테두리와 배경 강조를 추가한다.
- drag start 이후 발생한 click은 소비해 기존 일정 추가 모달이 열리지 않게 한다.

드롭 시 프런트 상태에서 plannedDate를 즉시 변경하고 미지정 목록에서 제거한다. PATCH 실패 시 이전 plannedDate로 되돌리고 한국어 오류 배너를 표시한다.

plannedDate가 있는 과제는 다른 날짜로 다시 드래그할 수 있다. 상세 메뉴의 `계획일 해제`는 DELETE API를 호출하고 성공하면 미지정 목록으로 돌려보낸다.

## 14. UI 설계

기존 Genesis 색상, 6~12px 모서리, 캘린더 크기와 7열 구조를 유지한다.

- 헤더 오른쪽에 계정 패널을 추가하고 `반 변경` 버튼은 유지한다.
- 모바일에서는 제목, 계정 정보, 명령 버튼이 자연스럽게 줄바꿈한다.
- 연결 전에는 `Google 학교 계정으로 연결` 버튼 하나를 표시한다.
- 연결 후에는 작은 프로필 이미지, 이름, 학교 이메일, `과제 동기화`, `연결 해제`를 표시한다.
- 마지막 동기화 시각과 연결 상태는 헤더 아래 한 줄 상태 영역에 표시한다.
- `날짜 미지정 과제`는 캘린더 바로 아래, 일정 목록 위에 둔다.
- 카드에는 Grip 아이콘, Google Classroom 출처, 제목, courseName, `마감일 없음`, 검증된 원본 링크를 표시한다.
- Classroom 공식 일정 pill에는 `Classroom`, 개인 계획일 pill에는 `계획` 짧은 배지를 표시한다.
- 일정 상세에서는 공식 마감일과 개인 계획일을 다른 레이블로 설명한다.

지원 상태는 연결 전, 로그인 진행 중, 승인 대기, 불러오는 중, 완료, 부분 실패, 권한 없음, 관리자 차단, 네트워크 오류, 재로그인 필요로 구분한다. 오류 원문 대신 각 상태에 맞는 한국어 안내와 재시도 명령을 제공한다.

GIS의 팝업 닫힘·차단은 `login-cancelled` 또는 `popup-blocked`, OAuth `access_denied`는 `consent-denied`, 조직 정책 관련 응답은 `admin-blocked`, token 교환의 `invalid_grant`는 `reauth-required`로 정규화한다. 사용자가 취할 수 있는 조치와 무관한 내부 오류 코드는 표시하지 않는다.

## 15. 링크와 출력 보안

- Classroom title과 description은 React 텍스트 노드로만 렌더링하고 `dangerouslySetInnerHTML`을 사용하지 않는다.
- alternateLink는 `https:`이면서 hostname이 `classroom.google.com` 또는 공식 허용 Google hostname인지 URL API로 검증한다.
- 새 탭 링크에 `target="_blank" rel="noopener noreferrer"`를 사용한다.
- CORS는 정확한 origin 허용 목록만 사용하고 `*`를 사용하지 않는다.
- Functions 로그는 uid의 비가역 축약값, 오류 code, request ID만 기록한다. 이메일, token, authorization code, description은 기록하지 않는다.
- AES-GCM 저장값은 ciphertext, IV, auth tag, key version을 분리한다. key rotation이 가능하도록 버전을 저장한다.
- Firestore client 규칙은 기본 거부다. Admin SDK만 데이터에 접근한다.
- sync와 인증 code 교환에는 Firestore 기반 고정 구간 속도 제한을 둔다.

## 16. 동기화 정책과 캐시

- 연결 직후에는 반드시 sync한다.
- 로그인된 사용자가 대시보드에 처음 진입하면 cached assignment를 먼저 가져온다.
- 마지막 성공 sync가 10분보다 오래됐을 때만 백그라운드 sync를 한 번 시작한다.
- 사용자가 `과제 동기화`를 누르면 강제 sync한다.
- hook은 같은 대시보드 mount에서 자동 sync를 한 번만 요청한다.
- sync 중 버튼을 비활성화하고 동일 UID의 동시 sync를 서버에서 거부한다.

## 17. 개발 Mock 모드

`VITE_USE_CLASSROOM_MOCK=true`일 때만 실제 Firebase/GIS 대신 같은 hook 인터페이스를 구현한 mock adapter를 사용한다.

Mock에는 공식 마감일 과제 2개, 미지정 과제 3개, 긴 제목, 설명 없는 과제, plannedDate 과제를 포함한다. 계획일 변경은 별도 개발용 LocalStorage 키에 저장해 새로고침 테스트를 지원한다.

Vite production build에서 `VITE_USE_CLASSROOM_MOCK=true`이면 빌드를 실패시켜 Mock이 공개 사이트에 배포되지 않게 한다.

## 18. 테스트 전략

### 프런트 단위·컴포넌트 테스트

- 기존 LocalStorage Schedule을 ManualSchedule로 마이그레이션
- `getCalendarDate` 우선순위
- 수동 일정과 Classroom 일정 요약 개수
- 미지정 과제 제외
- 공식 마감 과제 drag 금지
- optimistic plannedDate 변경과 API 실패 롤백
- 링크 hostname 검증
- 모든 연결·오류 상태 렌더링

Vitest, React Testing Library, jsdom을 사용한다.

### 백엔드 단위·통합 테스트

- OAuth code 입력과 origin/header 검증
- token 암호화·복호화와 로그 마스킹
- 재로그인 code 교환에 refresh token이 없을 때 기존 암호문 보존
- Firebase ID token 기반 소유권
- logout 뒤 폐기된 Firebase ID token 거부
- course와 courseWork의 모든 nextPageToken 처리
- 동시성 3 제한
- PUBLISHED 필터
- externalId 중복 방지와 plannedDate 보존
- 일부 course 실패 시 안전한 archive 처리
- token 만료 refresh와 invalid_grant 재연결 전환
- Firestore Emulator에서 사용자 격리와 rate limit

Google API 호출은 실제 응답 구조의 fixture와 HTTP mock으로 테스트하며, 실제 OAuth 테스트를 가짜 로그인으로 대체하지 않는다.

### 날짜 테스트

- UTC에서 Asia/Seoul로 같은 날과 다음 날 변환
- UTC 자정 전후
- 월말, 연말, 윤년
- dueTime 방어적 누락
- 나중에 officialDueDate가 추가되거나 제거된 경우

### 브라우저 테스트

- 기존 학년·반, 재접속, 수동 일정 추가·삭제, 월 이동, 날짜 클릭, 요약 필터
- 마우스, 터치 viewport, 키보드 drag
- hover, 다른 달 셀 drop, 이동, 해제, 롤백
- GitHub Pages `/Suhang-Moa/` 경로와 콘솔 오류

### 실제 Google 테스트

OAuth 테스트 사용자로 로그인 성공, 취소, 권한 거부, 활성 수업, 실제 과제, 수동 sync, 로그아웃, 재로그인, 연결 해제를 확인한다. 학교 관리자 차단은 실제 정책 계정에서 재현 가능할 때 확인하고, 재현할 수 없으면 공식 오류 code mapping 단위 테스트와 사용자 확인 절차를 기록한다.

## 19. 배포

Functions는 TypeScript typecheck, lint, unit test, build가 성공한 뒤 Firebase CLI로 배포한다. 비밀값은 `firebase functions:secrets:set` 또는 Secret Manager로 등록한다.

프런트는 환경별 공개 설정을 GitHub Actions Variables/Secrets에서 Vite build에 주입한다. `/Suhang-Moa/` base는 변경하지 않는다.

현재 저장소는 Pages artifact workflow와 루트 `assets`가 함께 존재해 이전 번들이 제공된 이력이 있다. GitHub Pages Source를 `GitHub Actions`로 확정하고 artifact 배포만 사용한다. 설정 변경 권한이 없으면 배포마다 `dist/assets`를 루트 `assets`와 동기화하는 검증된 fallback을 유지한다.

## 20. 완료 기준과 사용자 작업

다음이 모두 충족되어야 완료로 보고한다.

- 프런트와 백엔드 install, lint, typecheck, test, build 성공
- 기존 기능 회귀 테스트 성공
- Mock에서 모든 UI와 drag 흐름 성공
- 실제 OAuth 테스트 사용자로 code 교환과 Classroom sync 성공
- GitHub Pages에서 실제 API 호출, 재접속, plannedDate 유지 성공
- Client Secret과 refresh token이 프런트 bundle, Git, 브라우저 저장소에 없음을 확인
- README와 `.env.example`에 재현 가능한 설정 절차 작성

사용자가 직접 확인해야 하는 항목은 결제 계정 연결 승인, OAuth 약관·브랜딩의 법적 확인, 학교 Google Workspace 관리자 승인이다. OAuth 테스트 모드에서는 테스트 사용자 제한과 refresh token 만료 정책이 적용될 수 있으며, 공개 사용자 제공 전에는 Google OAuth 검증이 필요할 수 있다.

## 21. 공식 참고 문서

- Google Identity Services Code Model: https://developers.google.com/identity/oauth2/web/guides/use-code-model
- OAuth Web Server Flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Classroom courses.list: https://developers.google.com/workspace/classroom/reference/rest/v1/courses/list
- Classroom CourseWork: https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork
- Classroom scopes: https://developers.google.com/workspace/classroom/guides/auth
- Firebase Functions 2세대: https://firebase.google.com/docs/functions/version-comparison
- Firebase HTTP CORS: https://firebase.google.com/docs/functions/http-events
- Firebase Functions secrets: https://firebase.google.com/docs/functions/config-env
