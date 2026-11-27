import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, getApiErrorMessage } from '../../api/apiClient';
import { changeMyPassword, getMe, updateMe, type MeUpdateRequest } from '../../api/meApi';
import { useAuth } from '../../auth';
import { getAccessToken } from '../../auth/authStorage';
import type { AuthUser } from '../../auth/authTypes';
import DepartmentSelect from '../../components/forms/DepartmentSelect';
import SlidingUnderlineTabs from '../../components/forms/SlidingUnderlineTabs';
import { useLeaveGuard } from '../../hooks/useLeaveGuard';
import { getPhoneInputError } from '../../utils/applyForm';
import '../auth/apply.css';
import './account-settings.css';

const EMPTY_FORM: MeUpdateRequest = {
  name: '',
  email: '',
  phone: '',
  affiliationType: 'UNDERGRADUATE',
  department: '',
};
const AFFILIATIONS = [
  { value: 'UNDERGRADUATE', label: '학부생' },
  { value: 'GRADUATE', label: '대학원생' },
  { value: 'PROFESSOR', label: '교수' },
  { value: 'OTHER', label: '강사·기타' },
  { value: 'STAFF', label: '직원(연구원 포함)' },
] as const;
const TABS = [
  { value: 'profile', label: '내 정보' },
  { value: 'password', label: '비밀번호 변경' },
] as const;
type Tab = (typeof TABS)[number]['value'];
type Message = { text: string; error?: boolean };
type Action = 'save' | 'password';

function profileFromUser(user: AuthUser): MeUpdateRequest {
  return {
    name: user.name,
    email: user.email ?? '',
    phone: user.phone ?? '',
    affiliationType: user.affiliationType ?? 'UNDERGRADUATE',
    department: user.department ?? '',
  };
}
function profileValue(form: MeUpdateRequest) {
  return JSON.stringify([
    form.name.trim(),
    form.phone.trim(),
    form.affiliationType,
    form.department.trim(),
  ]);
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="account-field">
      <label htmlFor={id}>{label}</label>
      <div className="account-password">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="account-password-toggle"
          aria-label={`${label} ${visible ? '숨기기' : '보기'}`}
          aria-controls={id}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </div>
    </div>
  );
}

function AccountSettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [form, setForm] = useState<MeUpdateRequest>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<MeUpdateRequest | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const lock = useRef(false);
  const mounted = useRef(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [profileMessage, setProfileMessage] = useState<Message | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<Message | null>(null);
  const busy = action !== null;
  const profileDirty = baseline !== null && profileValue(form) !== profileValue(baseline);
  const passwordDirty = !!(pw.current || pw.next || pw.confirm);
  useLeaveGuard(profileDirty || passwordDirty);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    getMe()
      .then((user) => {
        if (!active) return;
        if (!user) throw new ApiError('내 정보 응답을 확인하지 못했습니다.');
        const next = profileFromUser(user);
        setForm(next);
        setBaseline(next);
      })
      .catch((error: unknown) => {
        if (active)
          setProfileMessage({
            error: true,
            text: getApiErrorMessage(error, '내 정보를 불러오지 못했습니다.'),
          });
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (lock.current || !baseline || !profileDirty) return;
    const phoneError = getPhoneInputError(form.phone);
    if (!form.name.trim() || !form.department.trim() || phoneError) {
      setProfileMessage({ error: true, text: phoneError || '이름과 소속을 입력해 주세요.' });
      return;
    }
    lock.current = true;
    setAction('save');
    setProfileMessage(null);
    try {
      const saved = await updateMe({
        name: form.name.trim(),
        // API의 필수 필드이므로 서버에서 받은 기존 이메일을 변경 없이 전달합니다.
        email: baseline.email,
        phone: form.phone.trim(),
        affiliationType: form.affiliationType,
        department: form.department.trim(),
      });
      const user = saved ?? (await getMe());
      if (!user) throw new ApiError('저장된 내 정보를 확인하지 못했습니다.');
      if (!mounted.current) return;
      const next = profileFromUser(user);
      setForm(next);
      setBaseline(next);
      setProfileMessage({ text: '내 정보가 저장되었습니다.' });
    } catch (error) {
      if (mounted.current)
        setProfileMessage({ error: true, text: getApiErrorMessage(error, '저장하지 못했습니다.') });
    } finally {
      lock.current = false;
      if (mounted.current) setAction(null);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (lock.current || !pw.current.trim() || !pw.next.trim() || !pw.confirm) return;
    if (pw.next !== pw.confirm || pw.current === pw.next) {
      setPasswordMessage({
        error: true,
        text:
          pw.next !== pw.confirm
            ? '새 비밀번호가 일치하지 않습니다.'
            : '새 비밀번호는 현재 비밀번호와 달라야 합니다.',
      });
      return;
    }
    lock.current = true;
    setAction('password');
    setPasswordMessage(null);
    const sessionToken = getAccessToken();
    try {
      await changeMyPassword(pw.current, pw.next);
      if (getAccessToken() === sessionToken) {
        logout();
        if (mounted.current) navigate('/login', { replace: true });
      }
    } catch (error) {
      if (mounted.current)
        setPasswordMessage({
          error: true,
          text: getApiErrorMessage(error, '비밀번호를 변경하지 못했습니다.'),
        });
    } finally {
      lock.current = false;
      if (mounted.current) setAction(null);
    }
  };

  return (
    <main className="account-page">
      <header>
        <h1>계정 설정</h1>
      </header>
      <SlidingUnderlineTabs
        id="account-settings"
        label="계정 설정"
        options={TABS}
        value={tab}
        onChange={setTab}
      />
      <section
        id="account-settings-profile-panel"
        role="tabpanel"
        aria-labelledby="account-settings-profile-tab"
        hidden={tab !== 'profile'}
      >
        <form className="account-form" onSubmit={save} aria-busy={busy}>
          {profileMessage && (
            <p className="account-message" role={profileMessage.error ? 'alert' : 'status'}>
              {profileMessage.text}
            </p>
          )}
          {!baseline && !profileMessage && <p role="status">내 정보를 불러오고 있습니다.</p>}
          <fieldset disabled={!baseline || busy} className="account-fields">
            <label className="account-field" htmlFor="account-name">
              이름
              <input
                id="account-name"
                autoComplete="name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <div className="account-field">
              <label htmlFor="account-email">이메일</label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                readOnly
                value={form.email}
              />
            </div>
            <label className="account-field" htmlFor="account-phone">
              전화번호
              <input
                id="account-phone"
                type="tel"
                autoComplete="tel"
                required
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>
            <fieldset className="account-affiliation">
              <legend>소속 유형</legend>
              <div className="apply-segments">
                {AFFILIATIONS.map((option) => (
                  <label className="apply-segment" key={option.value}>
                    <input
                      type="radio"
                      name="account-affiliation"
                      value={option.value}
                      checked={form.affiliationType === option.value}
                      onChange={() =>
                        setForm({ ...form, affiliationType: option.value, department: '' })
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <DepartmentSelect
              key={form.affiliationType}
              idPrefix="accountDepartment"
              value={form.department}
              onChange={(department) => setForm((current) => ({ ...current, department }))}
              includeGeneral={form.affiliationType !== 'UNDERGRADUATE'}
              collegeLabel={form.affiliationType === 'UNDERGRADUATE' ? '단과대학' : '소속 구분'}
              departmentLabel={
                form.affiliationType === 'UNDERGRADUATE' ? '학과·학부' : '소속 학과/부서'
              }
              fieldClassName="account-field"
            />
          </fieldset>
          <button
            className="account-button account-button--primary"
            disabled={!profileDirty || busy}
          >
            {action === 'save' ? '저장 중...' : '정보 저장'}
          </button>
        </form>
      </section>
      <section
        id="account-settings-password-panel"
        role="tabpanel"
        aria-labelledby="account-settings-password-tab"
        hidden={tab !== 'password'}
      >
        <form className="account-form" onSubmit={changePassword} aria-busy={action === 'password'}>
          <p className="account-help">변경 후 모든 기기에서 다시 로그인해야 합니다.</p>
          {passwordMessage && (
            <p className="account-message" role={passwordMessage.error ? 'alert' : 'status'}>
              {passwordMessage.text}
            </p>
          )}
          <fieldset disabled={!baseline || busy} className="account-fields">
            <PasswordField
              id="account-current-password"
              label="현재 비밀번호"
              value={pw.current}
              autoComplete="current-password"
              onChange={(current) => setPw({ ...pw, current })}
            />
            <PasswordField
              id="account-new-password"
              label="새 비밀번호"
              value={pw.next}
              autoComplete="new-password"
              onChange={(next) => setPw({ ...pw, next })}
            />
            <PasswordField
              id="account-confirm-password"
              label="새 비밀번호 확인"
              value={pw.confirm}
              autoComplete="new-password"
              onChange={(confirm) => setPw({ ...pw, confirm })}
            />
          </fieldset>
          <button
            className="account-button account-button--primary"
            disabled={busy || !baseline || !pw.current || !pw.next || !pw.confirm}
          >
            {action === 'password' ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default AccountSettingsPage;
