# 공유 일정 제안·승인 시스템 설계

## 1. 목표

기존 ClassMap의 학년·반 선택, 선택한 반 복원, 월간 캘린더, 요약 위젯과 LocalStorage 일정 기능을 유지하면서 다음 흐름을 추가한다.

1. 학생은 로그인 없이 개인 일정을 자기 브라우저에 추가한다.
2. 학생은 반 전체에 필요한 일정을 관리자에게 제안한다.
3. 학생은 게시된 일정에 팁·의견을 제안한다.
4. 최고 관리자 또는 해당 반 관리자가 제안 내용을 검토한다.
5. 승인된 일정과 의견만 반 전체에 공개한다.

Google Classroom 자동 연동은 이번 범위에서 완전히 제외한다.

## 2. 확정된 제품 원칙

- 일반 학생은 로그인하지 않는다.
- 개인 일정은 LocalStorage에 저장하며 해당 브라우저에서만 보인다.
- 반 일정 제안과 의견 제출 시에만 Firebase 익명 세션을 만든다.
- 익명 제출은 바로 공개하지 않고 반드시 관리자 검토를 거친다.
- 관리자는 Firebase Google 로그인만 사용한다.
- 최고 관리자 이메일은 사용자 요청에 따라 공개 GitHub 저장소의 Firestore Rules에 명시한다.
- 최고 관리자는 모든 반을 관리하고, 반 관리자는 지정된 반만 관리한다.
- 반 관리자 계정은 초기에는 Firebase Console에서 직접 등록한다.
- 별도 Node.js 또는 Cloud Functions API 서버는 만들지 않는다.
- Firestore, Firebase Authentication, App Check와 Security Rules가 실제 클라우드 백엔드 역할을 한다.
- 기존 Vite base인 `/Suhang-Moa/`와 GitHub Pages 배포를 유지한다.

## 3. 현재 코드와 변경 경계

현재 앱은 `ClassDashboard`가 LocalStorage 수동 일정 상태를 소유하고, 선택한 학년·반으로 일정을 필터링한다. `ScheduleModal`은 제목, 과목, 유형, 마감일, 상세 내용을 입력받고 `CalendarMonth`, `ScheduleList`, `SummaryWidgets`가 같은 배열을 사용한다.

변경 후에도 개인 일정 흐름은 이 구조를 최대한 유지한다. 공유 일정과 검토 데이터만 별도 service와 hooks로 분리해 `ClassDashboard`가 Firebase 인증·쿼리 세부사항을 직접 다루지 않게 한다.

```text
src/firebase/
  app.ts
  auth.ts
  appCheck.ts

src/services/
  sharedScheduleService.ts
  proposalService.ts
  opinionService.ts
  adminService.ts

src/hooks/
  useSharedSchedules.ts
  useProposalSubmission.ts
  useAdminSession.ts
  useModerationQueue.ts
```

## 4. 선택한 아키텍처

```text
GitHub Pages React 앱
  ├─ 공개 일정·승인 의견 읽기
  ├─ LocalStorage 개인 일정
  ├─ 필요할 때 Firebase 익명 인증
  └─ 관리자 Firebase Google 로그인
             ↓
Firebase App Check + Firestore Security Rules
             ↓
Cloud Firestore
  ├─ 공개 반 일정
  ├─ 검토 대기 일정 제안
  ├─ 검토 대기 의견
  └─ 관리자 역할
```

공개 일정 조회에는 로그인을 요구하지 않는다. 학생이 제안이나 의견을 제출하려 할 때만 `signInAnonymously`를 호출하고 `browserLocalPersistence`를 명시해 같은 브라우저에서는 제출 상태를 다시 확인할 수 있게 한다. 관리자는 별도의 `관리자 로그인` 명령으로 Google provider에 로그인한다.

App Check는 reCAPTCHA Enterprise provider를 사용하고 Firestore enforcement를 활성화한다. App Check는 등록된 웹앱에서 발생한 요청인지 판단하는 방어 계층이며 사용자 인증이나 완전한 스팸 차단을 대신하지 않는다.

## 5. 역할과 관리자 인증

### 최고 관리자

Firestore Rules는 Firebase가 서명한 Google 로그인 token의 이메일과 검증 상태를 확인한다.

```text
email == "chabin0960@gmail.com"
email_verified == true
```

이 이메일은 공개 저장소에 포함된다. 이메일 자체는 비밀번호가 아니지만 누구나 수집할 수 있다는 개인정보 노출을 사용자가 명시적으로 승인했다. 비밀번호, OAuth token, 서비스 계정 JSON은 어떤 경우에도 저장소에 넣지 않는다.

### 반 관리자

Firebase Console에서 다음 문서를 직접 만든다.

```text
admins/{firebaseUid}
  role: "class_admin"
  classIds: ["grade-1-class-2"]
  active: true
  createdAt
```

반 관리자는 한 개 이상의 반을 담당할 수 있다. 관리자 관리 UI는 이번 범위에서 만들지 않는다.

### 일반 학생

일반 학생에게 로그인 UI를 표시하지 않는다. 익명 Firebase UID는 제안 소유권 확인에만 사용하고 학생의 실제 신원으로 취급하지 않는다. 닉네임은 검증되지 않은 표시 이름이다.

## 6. 데이터 모델

### 공개 반 일정

```text
classes/{classId}
  grade
  classNo
  displayName

classes/{classId}/events/{eventId}
  source: "admin" | "approved-proposal"
  sourceProposalId: string | null
  title
  subject
  description
  type
  dueDate
  status: "published" | "archived"
  createdAt
  updatedAt
  publishedAt
  publishedBy
  updatedBy
```

`eventId`는 일정별 의견과 향후 별도 게시판 연결에 사용하는 안정적인 식별자다. 공개 쿼리는 반드시 `status == "published"` 조건을 포함한다.

### 일정 제안

```text
scheduleProposals/{proposalId}
  batchId
  ownerUid
  classId
  nickname
  title
  subject
  description
  type
  dueDate
  status: "pending" | "approved" | "rejected"
  createdAt
  reviewedAt
  reviewedBy
  rejectionReason
  publishedEventId
```

학생이 여러 일정을 제출하면 각 일정을 별도 문서로 저장하고 같은 `batchId`를 부여한다. UI는 한 번에 최대 10개까지 담을 수 있다. Firestore `writeBatch`를 사용해 같은 제출 묶음이 전부 저장되거나 전부 실패하게 한다.

원본 제안 필드는 승인 후에도 유지한다. 관리자가 내용을 고쳐 승인하면 수정된 값은 공개 event에 기록하고 원본 제안은 감사 기록으로 남긴다.

### 의견 제안과 공개 의견

```text
opinionProposals/{proposalId}
  ownerUid
  classId
  eventId
  nickname
  content
  status: "pending" | "approved" | "rejected"
  createdAt
  reviewedAt
  reviewedBy
  rejectionReason
  publishedOpinionId

classes/{classId}/events/{eventId}/opinions/{opinionId}
  sourceProposalId
  nickname
  content
  status: "published" | "archived"
  approvedAt
  approvedBy
```

공개 의견은 승인된 collection에 따로 복사해 공개 쿼리가 검토 대기 문서를 읽지 않게 한다.

### 개인 일정

기존 `classmap:schedules` LocalStorage key를 유지한다. 기존 source 없는 일정은 읽을 때 개인 일정으로 정규화한다.

```ts
type PersonalSchedule = {
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
};
```

개인 일정은 추가, 수정, 삭제할 수 있다. 공유 일정의 날짜 이동이나 숨김 기능은 이번 범위에 포함하지 않는다.

캘린더와 요약에는 다음 판별 union을 전달한다.

```ts
type SharedEvent = {
  source: "shared";
  id: string;
  classId: string;
  title: string;
  subject?: string;
  description?: string;
  type: ScheduleType;
  dueDate: string;
  status: "published";
};

type CalendarItem = PersonalSchedule | SharedEvent;
```

날짜 계산은 두 source 모두 `dueDate`를 사용하지만 삭제·수정 권한과 badge는 `source`로 구분한다.

## 7. 주요 사용자 흐름

### 개인 일정

```text
+ 버튼
→ 내 일정 추가
→ 기존 ScheduleModal 형식 작성
→ LocalStorage 저장
→ 캘린더·목록·요약에 즉시 반영
```

개인 일정은 다른 학생이나 관리자에게 전달되지 않는다.

### 반 일정 제안

```text
+ 버튼
→ 반 일정 제안
→ 현재 선택한 학년·반 자동 지정
→ 제목·과목·유형·마감일·상세·닉네임 작성
→ 제안 목록에 담기
→ 최대 10개 검토 요청
→ 익명 인증 및 App Check 확인
→ Firestore pending 문서 생성
```

학생은 현재 익명 UID로 제출한 제안의 처리 상태만 볼 수 있다. 브라우저 저장소를 지우거나 기기를 바꾸면 익명 UID가 달라져 이전 제출 상태를 다시 확인할 수 없다.

### 일정 검토

관리자는 `#/admin` hash route에서 검토함을 연다. Hash route를 사용해 GitHub Pages 새로고침 404를 피한다.

```text
Google 관리자 로그인
→ 최고 관리자 또는 반 관리자 권한 확인
→ 일정 제안 탭
→ 내용 검토·필요 시 공개 event 값 수정
→ 승인 또는 반려
```

승인은 Firestore transaction으로 proposal의 현재 상태를 다시 읽고, 공개 event를 만든 뒤 proposal을 `approved`로 변경한다. 이미 처리된 proposal이면 transaction을 중단한다. proposal의 학생 작성 원문은 수정하지 않고, 관리자가 고친 공개 값은 event에만 기록한다.

공유 일정 삭제는 영구 삭제 대신 `archived`로 바꾼다. 연결된 의견도 공개 쿼리에서 제외한다.

### 의견 제출과 검토

학생은 게시된 일정 상세에서 `팁·의견 남기기`를 누른다. 닉네임과 내용을 제출하면 `opinionProposals`에 pending으로 저장된다.

관리자는 `팁·의견` 탭에서 승인 또는 반려한다. 승인 transaction은 공개 opinion 문서를 생성하고 proposal 상태를 변경한다. 의견 수정 기능은 제공하지 않으며 부적절하거나 의미가 달라질 수 있는 내용은 반려한다.

## 8. UI 설계

기존 Genesis 색상, 캘린더 크기, 7열 배치와 ScheduleModal의 입력 순서를 유지한다.

### 학생 화면

- 헤더의 `반 변경` 유지
- 기존 추가 버튼을 누르면 `내 일정 추가`와 `반 일정 제안` 두 명령 표시
- 개인 일정 모달 overline은 `PERSONAL SCHEDULE`, 제목은 `내 일정 추가`
- 제안 모달 overline은 `SCHEDULE PROPOSAL`, 제목은 `반 일정 제안`
- 제안 모달에 현재 반 badge와 닉네임 필드 추가
- `저장` 대신 `제안 목록에 담기`
- 하단에 제안 목록, 개수, 제거, `하나 더 추가`, `검토 요청` 표시
- 개인 일정과 공유 일정 pill에 `내 일정`, `반 일정` 짧은 badge 표시
- pending 제안은 캘린더와 일반 일정 목록에 표시하지 않음

### 일정 상세와 의견

- 일정 제목, 과목, 유형, 마감일, 상세 내용 표시
- `팁·의견` 목록은 승인된 항목만 표시
- `팁·의견 남기기`에서 닉네임과 내용을 입력
- 링크나 HTML을 직접 렌더링하지 않고 React text node로 출력

### 관리자 화면

- `일정 제안`, `팁·의견`, `처리 내역` tabs
- 최고 관리자는 학년·반 filter 사용 가능
- 반 관리자는 담당 반만 선택 가능
- 대기 목록과 선택한 제안 상세를 나란히 표시
- 일정 제안은 `내용 수정`, `승인하고 게시`, `반려`
- 의견은 `승인`, `반려`
- 승인·반려 중 버튼 비활성화
- 모바일에서는 목록을 먼저 보여주고 항목 선택 시 상세 화면으로 이동

## 9. Firestore Security Rules

Rules는 다음 helper 경계를 사용한다.

```text
isSignedIn()
isAnonymousStudent()
isSuperAdmin()
isClassAdmin(classId)
canModerate(classId)
hasOnlyAllowedFields()
```

핵심 규칙은 다음과 같다.

- 공개 class와 published event·opinion만 읽기 허용
- 익명 사용자는 ownerUid가 자기 UID이고 status가 pending인 proposal create만 허용
- 학생 proposal update와 delete 거부
- 학생은 자기 proposal만 읽기 허용
- 반 관리자는 담당 classId proposal만 읽고 검토 가능
- 최고 관리자는 모든 classId 검토 가능
- event와 공개 opinion 생성·변경은 `canModerate(classId)`만 허용
- opinion proposal create는 대상 event가 같은 classId 아래의 published event일 때만 허용
- 공개 opinion read는 부모 event가 published 상태일 때만 허용
- proposal 검토 update는 pending에서 approved 또는 rejected로 한 번만 전환하고 원본 필드는 유지
- admin role 문서는 본인 역할 확인과 최고 관리자 조회만 허용
- admin role 문서는 클라이언트 쓰기 전부 거부
- 허용 field 이름, 문자열 길이, enum, 학년·반 범위, timestamp를 Rules에서 검증
- 공개 collection query는 Rules가 기대하는 status와 class 범위를 포함

Security Rules는 필터가 아니므로 클라이언트 query가 허용 가능한 전체 결과만 요청하도록 설계한다.

## 10. 입력 제한과 스팸 방어

기본 제한은 다음과 같다.

```text
한 제출 묶음: 최대 10개
닉네임: 1~20자
제목: 1~80자
과목: 0~40자
상세 내용: 0~1000자
의견: 1~500자
학년: 1~3
반: 1~12
```

클라이언트 Zod schema와 Firestore Rules가 각 문서의 필드와 길이를 각각 검증한다. `createdAt`은 server timestamp를 사용한다. 마감일은 Rules에서 `YYYY-MM-DD` 형식을 검사하고 클라이언트에서 실제 존재하는 날짜인지 추가 검증한다.

`한 묶음 최대 10개`는 정상 UI에 적용하는 제한이다. Security Rules는 개별 proposal을 검증하지만 악성 클라이언트가 여러 묶음을 반복 생성하는 것까지 신뢰성 있게 제한하지 못하므로 10개 제한을 보안 경계로 취급하지 않는다.

추가 방어는 App Check enforcement, 익명 인증 provider, 숨은 honeypot field, 제출 버튼 잠금, 짧은 클라이언트 cooldown, Firebase quota·사용량 alert로 구성한다.

별도 서버가 없으므로 신뢰할 수 있는 IP 기반 rate limit은 제공하지 못한다. 악의적인 사용자가 익명 계정을 반복 생성해 pending 데이터를 많이 쓸 가능성은 남는다. pending 데이터는 공개되지 않지만 Firestore 비용을 발생시킬 수 있으므로 사용량 경보와 관리자의 일괄 반려·삭제 절차를 문서화한다.

## 11. 오류 처리

- 오프라인에서도 개인 일정은 LocalStorage에 저장한다.
- 반 일정과 의견 제출은 온라인 연결이 없으면 시작하지 않고 재시도 안내를 표시한다.
- 익명 인증 실패와 App Check 실패를 구분하되 내부 오류 원문은 표시하지 않는다.
- Firestore permission denied는 일반 학생, 권한 없는 관리자, 잘못된 query 상황으로 나눠 한국어 안내한다.
- 제출 writeBatch가 실패하면 목록을 유지해 다시 제출할 수 있게 한다.
- 승인 transaction 충돌은 `이미 처리된 제안입니다`로 표시하고 queue를 새로고침한다.
- 관리자 session 만료 시 다시 로그인하고 작성 중인 공개 event 수정값은 sessionStorage에 임시 보관한다.
- rejected proposal은 사유와 처리 시각을 자기 익명 UID에서만 볼 수 있다.
- archived event는 공개 캘린더와 의견 query에서 제외한다.

## 12. 기존 데이터 처리

기존 LocalStorage 일정은 모두 개인 일정으로 보존한다. source가 없는 기존 값은 `source: "personal"`로 정규화하며 id, 학년, 반, 날짜를 바꾸지 않는다.

기존 데이터를 자동으로 Firestore 공유 일정에 올리지 않는다. 최고 관리자가 공유 일정으로 만들고 싶은 경우 새 관리자 일정으로 별도 등록한다. 개인 정보가 의도치 않게 반 전체에 공개되는 것을 방지하기 위한 결정이다.

## 13. 테스트 전략

### 단위·컴포넌트

- 기존 LocalStorage 마이그레이션과 개인 일정 추가·수정·삭제
- 개인 일정과 공유 일정 병합, 학년·반 filter, 요약 개수
- 추가 동작에서 두 기능 선택
- 최대 10개 제안 목록 추가·제거
- 제안·의견 schema와 길이 제한
- 관리자 tabs, loading, empty, error 상태
- 승인 전 proposal이 캘린더에 나타나지 않음
- 승인된 의견만 상세에 표시

### Security Rules Emulator

- 공개 사용자는 published event·opinion만 읽기
- 익명 UID가 pending proposal create 가능
- 승인 상태 위조와 허용되지 않은 field 거부
- 다른 익명 UID proposal 읽기 거부
- 학생 update·delete 거부
- 반 관리자 교차 반 접근 거부
- 반 관리자의 담당 반 승인 허용
- 최고 관리자 이메일 token의 전체 반 권한 허용
- email_verified가 false인 같은 문자열 이메일 거부
- admin 문서 클라이언트 쓰기 거부

### 통합·브라우저

- 학년·반 선택과 재접속 시 선택 반 복원
- 개인 일정 전체 회귀
- 익명 인증 후 여러 제안 writeBatch
- 자기 제출 상태 확인
- 관리자 Google 로그인 성공·권한 없음
- 제안 승인·반려와 transaction 중복 방지
- 의견 승인·반려
- 모바일 모달과 관리자 상세 전환
- GitHub Pages `/Suhang-Moa/`에서 Firebase Auth, App Check, Firestore 실제 호출

## 14. 배포

1. Firebase 프로젝트 생성
2. Firestore Native mode를 `asia-northeast3`에 생성
3. Firebase Authentication에서 Anonymous와 Google provider 활성화
4. `chabin0000.github.io`와 localhost를 Authorized domains에 등록
5. Firebase Web App 생성
6. App Check reCAPTCHA Enterprise provider 등록
7. Firestore App Check enforcement는 metrics 확인 후 활성화
8. `firestore.rules`와 `firestore.indexes.json` 배포
9. 최고 관리자 Google 로그인 후 권한 검증
10. 반 관리자 UID를 Firebase Console에서 `admins`에 등록
11. Firebase 공개 Web config를 GitHub Actions build 변수로 주입
12. GitHub Pages 재배포와 실제 제출·승인 테스트

Firebase Web config와 App Check site key는 공개 식별자다. 서비스 계정, 비밀번호, debug token은 Git에 커밋하지 않는다.

## 15. 완료 기준

- 기존 반 선택·복원, 월 이동, 날짜 클릭, 요약과 개인 일정 기능이 유지됨
- 개인 일정이 다른 브라우저에 공개되지 않음
- 학생이 일정 여러 개와 일정별 의견을 제출할 수 있음
- pending 데이터가 승인 전 공개 query에 나타나지 않음
- 최고 관리자와 반 관리자의 권한 범위가 Rules 테스트로 검증됨
- 승인·반려와 중복 방지 transaction이 동작함
- App Check와 Firestore Rules가 실제 배포됨
- GitHub Pages에서 실제 Firebase backend를 사용함
- 공개 저장소에 최고 관리자 이메일 외의 비밀정보가 없음

## 16. 제한사항과 향후 확장

- 별도 API 서버가 없어 IP 기반 rate limit과 서버 측 CAPTCHA 판정은 제공하지 않는다.
- 로그인하지 않는 학생의 제출 이력은 익명 세션이 사라지면 복구할 수 없다.
- 개인 일정은 브라우저 간 동기화되지 않는다.
- 관리자 역할 변경은 Firebase Console에서 수행한다.
- Google Classroom 연동은 구현하지 않는다.
- 의견 기능은 안정적인 `eventId`와 별도 service 경계를 사용한다. 향후 게시판 사이트를 만들면 UI가 Firestore 세부 경로를 직접 알지 않도록 `opinionService` 구현을 외부 게시판 adapter로 교체할 수 있다.

## 17. 공식 참고 문서

- [Firebase 익명 인증](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Firebase App Check reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Firestore 역할 기반 접근](https://firebase.google.com/docs/firestore/solutions/role-based-access)
- [Firestore Security Rules 조건](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firestore transaction과 batched write](https://firebase.google.com/docs/firestore/manage-data/transactions)
