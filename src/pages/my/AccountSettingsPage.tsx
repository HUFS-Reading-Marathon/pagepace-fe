import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { changeMyPassword, getMe, updateMe, type MeUpdateRequest } from '../../api/meApi';
import {
  GENERAL_AFFILIATIONS,
  STUDENT_DEPARTMENT_GROUPS,
} from '../../constants/departments';
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
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user) {
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
      await updateMe(form);
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
        <p>MY ACCOUNT</p>
        <h1>계정 설정</h1>
        <span>연락처와 소속 정보를 최신 상태로 관리하세요.</span>
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
          <label>
            이메일
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
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
          <label>
            소속
            <select
              value={form.department}
              onChange={(event) =>
                setForm({ ...form, department: event.target.value })
              }
            >
              <option value="">선택</option>
              {STUDENT_DEPARTMENT_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.departments.map((department) => (
                    <option key={department}>{department}</option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="기타 소속">
                {GENERAL_AFFILIATIONS.map((department) => (
                  <option key={department}>{department}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <button>정보 저장</button>
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
          <button>비밀번호 변경</button>
        </form>
      </div>
    </main>
  );
}

export default AccountSettingsPage;
