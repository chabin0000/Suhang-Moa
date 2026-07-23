type AdminLoginButtonProps = {
  onLogin: () => Promise<void>;
};

export default function AdminLoginButton({ onLogin }: AdminLoginButtonProps) {
  function handleLogin() {
    void onLogin().catch(() => undefined);
  }

  return (
    <button className="primary-button" type="button" onClick={handleLogin}>
      Google로 관리자 로그인
    </button>
  );
}
