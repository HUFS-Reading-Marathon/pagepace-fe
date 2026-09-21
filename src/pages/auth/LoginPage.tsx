import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { isAdminRole, useAuth } from '../../auth';
import './auth.css';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, login } = useAuth();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    const studentNo = loginId.trim();

    if (!studentNo || !password) {
      setErrorMessage('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setErrorMessage('');

    try {
      const authenticatedUser = await login({ studentNo, password });
      const returnPath =
        typeof location.state === 'object' &&
        location.state !== null &&
        'from' in location.state &&
        typeof location.state.from === 'string'
          ? location.state.from
          : isAdminRole(authenticatedUser.role)
            ? '/admin'
            : '/';
      navigate(returnPath, { replace: true });
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'),
      );
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-watermark" aria-hidden="true">
        <img src="/minerva-owl.png" alt="" />
      </div>

      <section className="auth-shell" aria-label="로그인 영역">
        <div className="auth-heading">
          <h1>로그인</h1>
          <p className="auth-description">로그인 후 나의 현황과 독서일지를 확인할 수 있습니다.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <label htmlFor="loginId">아이디</label>
            <input
              id="loginId"
              type="text"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              placeholder="학번/교번/사번"
              autoComplete="username"
              disabled={isLoading}
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <div className="auth-options">
            <label className="auth-check">
              <input
                type="checkbox"
                checked={isSaved}
                onChange={(event) => setIsSaved(event.target.checked)}
              />
              <span>아이디 저장</span>
            </label>

            <Link to="/password-reset" className="auth-text-link">
              비밀번호 찾기
            </Link>
          </div>

          {errorMessage && <p className="auth-error">{errorMessage}</p>}

          <button
            type="submit"
            className="auth-submit-button"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="auth-divider" />

        <div className="auth-footer-info">
          <p className="auth-note">
            참가 신청을 완료한 사용자는 로그인 후 독서일지 작성과 나의 현황 확인을 이용할 수
            있습니다.
          </p>

          <Link to="/" className="auth-back-link">
            ← 행사 안내로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
