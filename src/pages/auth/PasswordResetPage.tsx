import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { confirmPasswordReset, sendPasswordResetCode } from '../../api/authApi';
import './auth.css';

function PasswordResetPage() {
  const [studentNo, setStudentNo] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [completed, setCompleted] = useState(false);

  const normalizedStudentNo = studentNo.trim();
  const normalizedEmail = email.trim();

  const handleSend = async () => {
    if (!normalizedStudentNo || !normalizedEmail) {
      setIsError(true);
      setMessage('학번/교번/사번과 계정에 등록된 이메일을 입력해 주세요.');
      return;
    }

    setIsSending(true);
    setMessage('');
    try {
      await sendPasswordResetCode(normalizedStudentNo, normalizedEmail);
      setCodeSent(true);
      setIsError(false);
      setMessage('인증번호를 발송했습니다. 이메일에서 6자리 번호를 확인해 주세요.');
    } catch (error) {
      setIsError(true);
      setMessage(getApiErrorMessage(error, '인증번호를 발송하지 못했습니다.'));
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setIsError(true);
      setMessage('이메일로 받은 6자리 인증번호를 입력해 주세요.');
      return;
    }

    setIsConfirming(true);
    setMessage('');
    try {
      await confirmPasswordReset(normalizedStudentNo, normalizedEmail, code);
      setCompleted(true);
      setIsError(false);
      setMessage('비밀번호가 아이디와 동일한 값으로 초기화되었습니다.');
    } catch (error) {
      setIsError(true);
      setMessage(getApiErrorMessage(error, '비밀번호를 초기화하지 못했습니다.'));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-watermark" aria-hidden="true">
        <img src="/minerva-owl.png" alt="" />
      </div>
      <section className="auth-shell auth-shell-reset" aria-label="비밀번호 찾기 영역">
        <div className="auth-heading">
          <p className="auth-kicker">ACCOUNT RECOVERY</p>
          <h1>비밀번호 찾기</h1>
          <p className="auth-description">계정에 등록된 이메일로 본인 확인을 진행합니다.</p>
        </div>

        <form className="auth-form" onSubmit={handleConfirm}>
          <div className="auth-reset-guide">
            <strong>인증이 완료되면</strong>
            <span>비밀번호가 학번/교번/사번과 동일한 값으로 초기화됩니다.</span>
          </div>
          <div className="auth-form-group">
            <label htmlFor="resetStudentNo">아이디</label>
            <input
              id="resetStudentNo"
              value={studentNo}
              onChange={(event) => setStudentNo(event.target.value)}
              placeholder="학번/교번/사번"
              autoComplete="username"
              disabled={codeSent || completed}
            />
          </div>
          <div className="auth-form-group">
            <label htmlFor="resetEmail">등록 이메일</label>
            <div className="auth-email-verification__row">
              <input
                id="resetEmail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@hufs.ac.kr"
                autoComplete="email"
                disabled={codeSent || completed}
              />
              <button
                type="button"
                className="auth-email-verification__button"
                onClick={handleSend}
                disabled={isSending || completed}
              >
                {isSending ? '발송 중' : codeSent ? '재발송' : '인증번호 발송'}
              </button>
            </div>
          </div>
          {codeSent && !completed && (
            <div className="auth-form-group">
              <label htmlFor="resetCode">인증번호</label>
              <input
                id="resetCode"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                placeholder="6자리 숫자"
                autoComplete="one-time-code"
              />
            </div>
          )}
          {message && (
            <p className={isError ? 'auth-error' : 'auth-success'} role="status">
              {message}
            </p>
          )}
          {codeSent && !completed && (
            <button type="submit" className="auth-submit-button" disabled={isConfirming}>
              {isConfirming ? '확인 중...' : '인증하고 비밀번호 초기화'}
            </button>
          )}
          {completed && (
            <Link to="/login" className="auth-submit-button auth-submit-link">
              초기화된 비밀번호로 로그인
            </Link>
          )}
        </form>
        <div className="auth-divider" />
        <div className="auth-footer-info">
          <Link to="/login" className="auth-back-link">
            ← 로그인으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}

export default PasswordResetPage;
