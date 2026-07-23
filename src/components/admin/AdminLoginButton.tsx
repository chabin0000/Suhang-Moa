type AdminLoginButtonProps = {
  onLogin: () => Promise<void>;
};

export default function AdminLoginButton({ onLogin }: AdminLoginButtonProps) {
  return (
    <button className="primary-button" type="button" onClick={() => void onLogin()}>
      Google로 관리자 로그인
    </button>
  );
}
