import { ArrowLeft, LogOut, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useModerationQueue } from "../../hooks/useModerationQueue";
import { useAdminSession, type AdminSession } from "../../hooks/useAdminSession";
import type { ModerationQueueGateway, ModerationQueueRow, ModerationQueueTab } from "../../services/adminService";
import type { AdminScope, ClassId, ScheduleDraft } from "../../types";
import AdminLoginButton from "./AdminLoginButton";
import ModerationHistory from "./ModerationHistory";
import ModerationTabs from "./ModerationTabs";
import OpinionReviewPanel from "./OpinionReviewPanel";
import ProposalReviewPanel from "./ProposalReviewPanel";

type Commands = { approveSchedule: (scope: AdminScope, uid: string, input: ScheduleDraft & { proposalId: string; classId: ClassId }) => Promise<{ status: string }>; rejectSchedule: (scope: AdminScope, uid: string, input: { proposalId: string; classId: ClassId; reason: string }) => Promise<{ status: string }>; approveOpinion: (scope: AdminScope, uid: string, input: { proposalId: string; classId: ClassId; eventId: string }) => Promise<{ status: string }>; rejectOpinion: (scope: AdminScope, uid: string, input: { proposalId: string; classId: ClassId; reason: string }) => Promise<{ status: string }>; archiveEvent: (scope: AdminScope, uid: string, input: { classId: ClassId; eventId: string }) => Promise<{ status: string }> };
type ActionError = "permission" | "network" | "conflict" | "unauthenticated";

export async function loadModerationCommands(): Promise<Commands> { return import("../../services/adminService"); }
const classes = Array.from({ length: 3 }, (_, grade) => Array.from({ length: 12 }, (_, index) => `grade-${grade + 1}-class-${index + 1}` as ClassId)).flat();
const classLabel = (value: ClassId) => { const [, grade, , classNo] = value.split("-"); return `${grade}학년 ${classNo}반`; };
const actionErrorText: Record<ActionError, string> = { permission: "권한이 없어 이 작업을 처리할 수 없습니다.", network: "네트워크 연결을 확인한 뒤 다시 시도하세요.", conflict: "다른 관리자가 먼저 처리했습니다. 목록을 새로고침했습니다.", unauthenticated: "로그인 상태를 확인한 뒤 다시 시도하세요." };

export default function AdminPage({ sessionOverride, queueGateway, commands: commandsOverride }: { sessionOverride?: AdminSession; queueGateway?: ModerationQueueGateway; commands?: Commands }) {
  const realSession = useAdminSession();
  const session = sessionOverride ?? realSession;
  const [tab, setTab] = useState<ModerationQueueTab>("schedules");
  const [selectedClassId, setSelectedClassId] = useState<ClassId | null>(null);
  const [selected, setSelected] = useState<ModerationQueueRow | null>(null);
  const [commands, setCommands] = useState<Commands | null>(commandsOverride ?? null);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const priorFocus = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLElement | null>(null);
  const queue = useModerationQueue(session.status === "authorized" ? session.scope : null, selectedClassId, tab, queueGateway);

  useEffect(() => { if (session.scope?.role === "class_admin") setSelectedClassId(session.scope.classIds[0] ?? null); }, [session.scope]);
  useEffect(() => { if (selected && !queue.rows.some((row) => row.id === selected.id && row.kind === selected.kind)) setSelected(null); }, [queue.rows, selected]);
  useEffect(() => { if (!commandsOverride && session.status === "authorized") void loadModerationCommands().then(setCommands).catch(() => setCommands(null)); }, [commandsOverride, session.status]);

  function mapActionError(error: unknown): ActionError { const code = (error as { code?: string }).code; if (code === "permission-denied" || code === "unauthorized") return "permission"; if (code === "unauthenticated") return "unauthenticated"; if (code === "retryable") return "conflict"; return "network"; }
  function logout() { void session.logout().catch(() => undefined); }
  async function run(action: (loaded: Commands) => Promise<{ status: string }>): Promise<boolean> { if (processingRef.current || !commands) return false; processingRef.current = true; setProcessing(true); setActionError(null); try { await action(commands); setSelected(null); queue.refresh(); return true; } catch (error) { const next = mapActionError(error); setActionError(next); if (next === "conflict") queue.refresh(); return false; } finally { processingRef.current = false; setProcessing(false); } }
  function openReject() { priorFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setReason(""); setReasonError(""); setReasonOpen(true); }
  function closeReject() { setReasonOpen(false); queueMicrotask(() => priorFocus.current?.focus()); }
  function trapDialogFocus(event: React.KeyboardEvent<HTMLElement>) { if (event.key === "Escape") { closeReject(); return; } if (event.key !== "Tab") return; const focusable = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'); if (!focusable?.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
  function submitReject() { const trimmed = reason.trim(); if (trimmed.length < 1 || trimmed.length > 300) { setReasonError("반려 사유는 1~300자로 입력하세요."); return; } if (!selected) return; const row = selected; void run((loaded) => row.kind === "schedule" ? loaded.rejectSchedule(session.scope!, session.user!.uid, { proposalId: row.id, classId: row.classId, reason: trimmed }) : loaded.rejectOpinion(session.scope!, session.user!.uid, { proposalId: row.id, classId: row.classId, reason: trimmed })).then((success) => { if (success) closeReject(); }); }
  const scopeClasses = session.scope?.role === "super_admin" ? classes : session.scope?.classIds ?? [];
  const queueErrorText = queue.error === "permission-denied" || queue.error === "unauthorized" ? "목록을 볼 권한이 없습니다." : queue.error === "network" ? "네트워크 연결을 확인하세요." : "처리 충돌이 발생했습니다. 다시 확인하세요.";

  const selectedPanel = selected && (tab === "history" ? <ModerationHistory row={selected} disabled={processing} onArchive={() => { if (selected.kind === "schedule" && selected.publishedEventId) void run((loaded) => loaded.archiveEvent(session.scope!, session.user!.uid, { classId: selected.classId, eventId: selected.publishedEventId! })); }} /> : selected.kind === "schedule" ? <ProposalReviewPanel proposal={selected} disabled={processing} onReject={openReject} onApprove={(draft) => void run((loaded) => loaded.approveSchedule(session.scope!, session.user!.uid, { ...draft, proposalId: selected.id, classId: selected.classId }))} /> : <OpinionReviewPanel proposal={selected} disabled={processing} onReject={openReject} onApprove={() => void run((loaded) => loaded.approveOpinion(session.scope!, session.user!.uid, { proposalId: selected.id, classId: selected.classId, eventId: selected.eventId }))} />);
  return <section className="admin-page" aria-label="관리자 작업 공간"><header className="admin-header"><div><p className="admin-eyebrow">CLASSMAP ADMIN</p><h1>관리자 작업 공간</h1></div><div className="admin-header-actions"><a className="secondary-button" href="#/">캘린더로 돌아가기</a>{session.status === "authorized" && <button className="icon-button" type="button" aria-label="로그아웃" title="로그아웃" onClick={logout}><LogOut size={18} /></button>}</div></header><section className="admin-work-area" aria-live="polite">
    {session.status === "signed-out" && <div className="admin-state"><h2>관리자 로그인</h2><p>권한이 있는 Google 계정으로 로그인하세요.</p>{session.message && <p>{session.message}</p>}<AdminLoginButton onLogin={session.login} /></div>}
    {session.status === "checking" && <div className="admin-state"><h2>권한 확인 중</h2><p>관리자 범위를 확인하고 있습니다.</p></div>}
    {session.status === "unauthorized" && <div className="admin-state admin-state-error"><h2>접근 권한 없음</h2><p>{session.message}</p><AdminLoginButton onLogin={session.login} /><button className="secondary-button" type="button" onClick={logout}>로그아웃 다시 시도</button></div>}
    {session.status === "authorized" && session.scope && <div className="admin-authorized"><p className="admin-scope-label">{session.scope.role === "super_admin" ? "최고 관리자" : "반 관리자"}</p><h2>{session.scope.role === "super_admin" ? "전체 반 권한" : "해당 반 권한"}</h2><p>{session.scope.role === "super_admin" ? "모든 반" : session.scope.classIds.join(", ")}</p>{actionError && <p className="form-error" role="alert">{actionErrorText[actionError]}</p>}<div className="admin-controls"><ModerationTabs value={tab} onChange={(next) => { setTab(next); setSelected(null); }} /><label className="admin-class-select">반 선택<select value={selectedClassId ?? ""} onChange={(event) => { setSelectedClassId((event.target.value || null) as ClassId | null); setSelected(null); }}><option value="">전체</option>{scopeClasses.map((classId) => <option key={classId} value={classId}>{classLabel(classId)}</option>)}</select></label></div><div className="moderation-grid"><aside className="moderation-queue" aria-label="검토 대기 목록">{queue.loading && <p role="status">목록을 불러오는 중입니다.</p>}{queue.error && <div role={queue.error === "permission-denied" || queue.error === "unauthorized" ? "alert" : "status"}><p>{queueErrorText}</p>{queue.error !== "permission-denied" && queue.error !== "unauthorized" && <button className="icon-button" type="button" title="새로고침" aria-label="새로고침" onClick={queue.refresh}><RefreshCw size={17} /></button>}</div>}{queue.empty && !queue.error && <p role="status">처리할 항목이 없습니다.</p>}{queue.rows.map((row) => <button key={`${row.kind}-${row.id}`} type="button" className="moderation-row" onClick={() => setSelected(row)}><strong>{row.kind === "schedule" ? row.title : row.nickname}</strong><span>{classLabel(row.classId)}</span></button>)}</aside><main className={`moderation-details ${selected ? "is-open" : ""}`}>{selected ? <div><button type="button" className="mobile-back" aria-label="Back to queue" onClick={() => setSelected(null)}><ArrowLeft size={16} aria-hidden="true" />목록</button>{selectedPanel}</div> : <p className="moderation-placeholder">목록에서 항목을 선택하세요.</p>}</main></div></div>}
  </section>{reasonOpen && <div className="modal-backdrop" role="presentation"><section ref={dialog} className="schedule-modal rejection-dialog" role="dialog" aria-modal="true" aria-labelledby="rejection-title" onKeyDown={trapDialogFocus}><header className="modal-header"><h2 id="rejection-title">반려 사유</h2><button type="button" className="icon-button" aria-label="닫기" title="닫기" onClick={closeReject}><X size={18} /></button></header><label className="field-label">반려 사유<textarea autoFocus value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} /></label>{reasonError && <p className="form-error" role="alert">{reasonError}</p>}<div className="moderation-actions"><button type="button" className="secondary-button" onClick={closeReject}>취소</button><button type="button" className="destructive-button" disabled={processing} onClick={submitReject}>반려 확정</button></div></section></div>}</section>;
}
