import { LogOut } from "lucide-react";
import { useAdminSession } from "../../hooks/useAdminSession";
import AdminLoginButton from "./AdminLoginButton";

export default function AdminPage() {
  const session = useAdminSession();

  function handleLogout() {
    void session.logout().catch(() => undefined);
  }

  return (
    <section className="admin-page" aria-label="관리자 작업 공간">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">CLASSMAP ADMIN</p>
          <h1>관리자 작업 공간</h1>
        </div>
        <div className="admin-header-actions">
          <a className="secondary-button" href="#/">캘린더로 돌아가기</a>
          {session.status === "authorized" && (
            <button
              className="icon-button"
              type="button"
              aria-label="로그아웃"
              title="로그아웃"
              onClick={handleLogout}
            >
              <LogOut aria-hidden="true" size={18} />
            </button>
          )}
        </div>
      </header>

      <section className="admin-work-area" aria-live="polite">
        {session.status === "signed-out" && (
          <div className="admin-state">
            <h2>관리자 로그인</h2>
            <p>권한이 있는 Google 계정으로 로그인하세요.</p>
            {session.message && <p className="admin-session-message">{session.message}</p>}
            <AdminLoginButton onLogin={session.login} />
          </div>
        )}
        {session.status === "checking" && (
          <div className="admin-state"><h2>권한 확인 중</h2><p>관리자 범위를 확인하고 있습니다.</p></div>
        )}
        {session.status === "unauthorized" && (
          <div className="admin-state admin-state-error">
            <h2>접근 권한 없음</h2>
            <p>{session.message}</p>
            <AdminLoginButton onLogin={session.login} />
            <button className="secondary-button" type="button" onClick={handleLogout}>
              로그아웃 다시 시도
            </button>
          </div>
        )}
        {session.status === "authorized" && session.scope && (
          <div className="admin-authorized">
            <div>
              <p className="admin-scope-label">{session.scope.role === "super_admin" ? "최고 관리자" : "반 관리자"}</p>
              <h2>{session.scope.role === "super_admin" ? "전체 반 권한" : "담당 반 권한"}</h2>
              <p>{session.scope.role === "super_admin" ? "모든 반의 공유 일정 관리 권한이 있습니다." : session.scope.classIds.join(", ")}</p>
              {session.message && <p className="admin-session-message">{session.message}</p>}
            </div>
            <div className="admin-empty-work">검토할 작업은 아직 없습니다.</div>
          </div>
        )}
      </section>
    </section>
  );
}
