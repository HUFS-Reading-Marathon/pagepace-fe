import { Link, useLocation } from 'react-router-dom';
import './auth.css';

type ApplyPendingLocationState = {
  email?: string;
};

function ApplyPendingPage() {
  const location = useLocation();
  const email = (location.state as ApplyPendingLocationState | null)?.email;

  return (
    <main className="auth-page auth-page-pending">
      <div className="auth-watermark" aria-hidden="true">
        <img src="/minerva-owl.png" alt="" />
      </div>

      <section className="auth-shell auth-shell-pending">
        <div className="auth-pending-logo" aria-hidden="true">
          <img src="/hufs-symbol.gif" alt="" />
        </div>

        <div className="auth-heading">
          <h1>참가신청이 접수되었습니다</h1>
          <p className="auth-description">
            관리자 확인 후 참가 승인이 완료됩니다.
          </p>
        </div>

        <div className="auth-pending-content">
          <p>
            {email
              ? `${email}로 승인 안내가 발송될 예정입니다.`
              : '승인 결과와 로그인 안내는 입력한 학교 이메일로 발송될 예정입니다.'}
          </p>
          <p>승인 후 초기 비밀번호와 비밀번호 변경 안내를 확인해 주세요.</p>
        </div>

        <Link to="/" className="auth-submit-button auth-pending-button">
          행사 안내로 돌아가기
        </Link>
      </section>
    </main>
  );
}

export default ApplyPendingPage;
