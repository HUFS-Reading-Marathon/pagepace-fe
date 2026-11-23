import {
  sendApplicationEmailVerification,
  confirmApplicationEmailVerification,
} from '../../api/applicationApi';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { changeMyPassword, getMe, updateMe, type MeUpdateRequest } from '../../api/meApi';
import DepartmentSelect from '../../components/forms/DepartmentSelect';
import { useAuth } from '../../auth';
import './account-settings.css';

const EMPTY_FORM: MeUpdateRequest = {
  name: '',
  email: '',
  phone: '',
  affiliationType: 'UNDERGRADUATE',
  department: '',
};

const AFFILIATION_TYPE_OPTIONS = [
  { value: 'UNDERGRADUATE', label: '학부생' },
  { value: 'GRADUATE', label: '대학원생' },
  { value: 'PROFESSOR', label: '교수' },
  { value: 'STAFF', label: '직원' },
  { value: 'OTHER', label: '기타' },
] as const;

function AccountSettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [form, setForm] = useState<MeUpdateRequest>(EMPTY_FORM);
  const [originalEmail, setOriginalEmail] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [code, setCode] = useState('');
  // 인증 코드 발송과 확인이 같은 잠금을 쓰되, 버튼 문구는 진행 중인 작업에만 표시하도록 구분합니다.
  const [verifyingAction, setVerifyingAction] = useState<'send' | 'confirm' | null>(null);
  const verifying = verifyingAction !== null;
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [message, setMessage] = useState('');
  const isEmailChanged = form.email.toLowerCase() !== originalEmail.toLowerCase();

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user) {
          setOriginalEmail(user.email ?? '');

          setForm({
            name: user.name,
            email: user.email ?? '',
            phone: user.phone ?? '',
            affiliationType: user.affiliationType ?? 'UNDERGRADUATE',
            department: user.department ?? '',
          });
        }
      })
      .catch(() => setMessage('내 정보를 불러오지 못했습니다.'));
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();

    try {
      if (
        form.email.toLowerCase() !== originalEmail.toLowerCase() &&
        form.email.toLowerCase() !== verifiedEmail.toLowerCase()
      ) {
        setMessage('변경한 이메일을 먼저 인증해 주세요.');
        return;
      }
      await updateMe({
        ...form,
        verificationToken: isEmailChanged ? form.verificationToken : undefined,
      });
      setOriginalEmail(form.email);
      setVerifiedEmail('');
      setCode('');
      setForm((current) => ({ ...current, verificationToken: undefined }));
      setMessage('내 정보가 저장되었습니다.');
    } catch (error) {
      setMessage(getApiErrorMessage(error, '저장하지 못했습니다.'));
    }
  };

  const change = async (event: FormEvent) => {
    event.preventDefault();

    if (pw.next !== pw.confirm) {
      setMessage('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      await changeMyPassword(pw.current, pw.next);
      logout();
      navigate('/login');
    } catch (error) {
      setMessage(getApiErrorMessage(error, '비밀번호를 변경하지 못했습니다.'));
    }
  };

  return (
    <main className="account-page">
      <header>
        <h1>계정 설정</h1>
      </header>
      {message && <div className="account-message">{message}</div>}
      <div className="account-grid">
        <form onSubmit={save}>
          <h2>내 정보</h2>
          <label>
            이름
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <div className="account-field">
            <label htmlFor="account-email">이메일</label>
            <div className="account-inline">
              <input
                id="account-email"
                type="email"
                value={form.email}
                disabled={verifying}
                onChange={(event) => {
                  setForm({ ...form, email: event.target.value, verificationToken: undefined });
                  setVerifiedEmail('');
                  setCode('');
                }}
              />
              {isEmailChanged && (
                <button
                  type="button"
                  className="account-button account-button--outline account-verify-send"
                  disabled={verifying}
                  aria-busy={verifyingAction === 'send'}
                  onClick={async () => {
                    setVerifyingAction('send');
                    try {
                      await sendApplicationEmailVerification(form.email);
                      setVerifiedEmail('');
                      setCode('');
                      setForm((current) => ({ ...current, verificationToken: undefined }));
                      setMessage('인증 코드를 보냈습니다.');
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : '발송 실패');
                    } finally {
                      setVerifyingAction(null);
                    }
                  }}
                >
                  {verifyingAction === 'send' ? '발송 중...' : '인증 코드 발송'}
                </button>
              )}
            </div>
          </div>
          {isEmailChanged && (
            <div className="account-field">
              <label htmlFor="account-email-code">인증 코드</label>
              <div className="account-inline">
                <input
                  id="account-email-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  type="button"
                  className="account-button account-button--outline"
                  disabled={verifying || !code}
                  aria-busy={verifyingAction === 'confirm'}
                  onClick={async () => {
                    const email = form.email;
                    setVerifyingAction('confirm');
                    try {
                      const verificationToken = await confirmApplicationEmailVerification(
                        email,
                        code,
                      );
                      setForm((current) => ({ ...current, verificationToken }));
                      setVerifiedEmail(email);
                      setMessage('이메일 인증이 완료되었습니다.');
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : '인증 실패');
                    } finally {
                      setVerifyingAction(null);
                    }
                  }}
                >
                  {verifyingAction === 'confirm' ? '확인 중...' : '인증 확인'}
                </button>
              </div>
            </div>
          )}
          <label>
            전화번호
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>
          <label>
            소속 유형
            <select
              value={form.affiliationType}
              onChange={(event) =>
                setForm({
                  ...form,
                  affiliationType: event.target.value,
                  department: '',
                })
              }
            >
              {AFFILIATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <DepartmentSelect
            idPrefix="accountDepartment"
            value={form.department}
            onChange={(department) => setForm((current) => ({ ...current, department }))}
            includeGeneral
            collegeLabel={form.affiliationType === 'UNDERGRADUATE' ? '단과대학' : '소속 구분'}
            departmentLabel="소속"
            fieldClassName="account-field"
          />
          <button className="account-button account-button--primary">정보 저장</button>
        </form>
        <form onSubmit={change}>
          <h2>비밀번호 변경</h2>
          <p>변경 후 모든 기기에서 다시 로그인해야 합니다.</p>
          <label>
            현재 비밀번호
            <input
              type="password"
              value={pw.current}
              onChange={(event) => setPw({ ...pw, current: event.target.value })}
            />
          </label>
          <label>
            새 비밀번호
            <input
              type="password"
              value={pw.next}
              onChange={(event) => setPw({ ...pw, next: event.target.value })}
            />
          </label>
          <label>
            새 비밀번호 확인
            <input
              type="password"
              value={pw.confirm}
              onChange={(event) => setPw({ ...pw, confirm: event.target.value })}
            />
          </label>
          <button className="account-button account-button--primary">비밀번호 변경</button>
        </form>
      </div>
    </main>
  );
}

export default AccountSettingsPage;
