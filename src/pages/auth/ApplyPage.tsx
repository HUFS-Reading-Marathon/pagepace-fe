import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './auth.css';

type CourseType = 'short' | 'half' | 'full';

type GradeType = '1' | '2' | '3' | '4' | 'staff' | 'etc';

type GenderType = 'female' | 'male' | 'none';

type StoredApplicant = {
  name: string;
  loginId: string;
  department: string;
  grade: GradeType;
  gender: GenderType;
  course: CourseType;
  password: string;
};

const COURSE_OPTIONS: { label: string; value: CourseType }[] = [
  { label: '단축코스', value: 'short' },
  { label: '하프코스', value: 'half' },
  { label: '풀코스', value: 'full' },
];

const GRADE_OPTIONS: { label: string; value: GradeType }[] = [
  { label: '1학년', value: '1' },
  { label: '2학년', value: '2' },
  { label: '3학년', value: '3' },
  { label: '4학년', value: '4' },
  { label: '교직원', value: 'staff' },
  { label: '기타', value: 'etc' },
];

const GENDER_OPTIONS: { label: string; value: GenderType }[] = [
  { label: '여성', value: 'female' },
  { label: '남성', value: 'male' },
  { label: '선택 안 함', value: 'none' },
];

function ApplyPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [grade, setGrade] = useState<GradeType>('1');
  const [gender, setGender] = useState<GenderType>('none');
  const [course, setCourse] = useState<CourseType>('half');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !name.trim() ||
      !studentNumber.trim() ||
      !department.trim() ||
      !password.trim() ||
      !passwordConfirm.trim()
    ) {
      setErrorMessage('필수 정보를 모두 입력해 주세요.');
      return;
    }

    if (studentNumber.trim().length < 4) {
      setErrorMessage('학번 또는 사번을 정확히 입력해 주세요.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('비밀번호는 6자 이상으로 입력해 주세요.');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!isAgreed) {
      setErrorMessage('개인정보 수집 및 이용 안내에 동의해 주세요.');
      return;
    }

    const storedApplicants = localStorage.getItem('applicants');
    const applicants: StoredApplicant[] = storedApplicants
      ? JSON.parse(storedApplicants)
      : [];

    const loginId = studentNumber.trim();

    const isDuplicated = applicants.some(
      (applicant) => applicant.loginId === loginId,
    );

    if (isDuplicated) {
      setErrorMessage('이미 참가신청이 완료된 학번 또는 사번입니다.');
      return;
    }

    const newApplicant: StoredApplicant = {
      name: name.trim(),
      loginId,
      department: department.trim(),
      grade,
      gender,
      course,
      password,
    };

    /*
      API 연동 전 임시 처리:
      참가신청 완료 = 계정 생성 + 참가 완료 + 자동 로그인
    */
    localStorage.setItem(
      'applicants',
      JSON.stringify([...applicants, newApplicant]),
    );
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('isApplied', 'true');
    localStorage.setItem('loginId', newApplicant.loginId);
    localStorage.setItem('userName', newApplicant.name);
    localStorage.setItem('userCourse', newApplicant.course);

    setErrorMessage('');
    window.dispatchEvent(new Event('auth-change'));

    navigate('/');
  };

  return (
    <main className="auth-page auth-page-apply">
      <div className="auth-watermark" aria-hidden="true">
        <img src="/minerva-owl.png" alt="" />
      </div>

      <section className="auth-shell auth-shell-apply" aria-label="참가신청 영역">
        <div className="auth-heading">
          <h1>참가신청</h1>
          <p className="auth-description">
            학번 또는 사번으로 계정을 만들고 독서마라톤 참가를 신청합니다.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <label htmlFor="name">성명</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="이름"
              autoComplete="name"
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="studentNumber">학번/사번</label>
            <input
              id="studentNumber"
              type="text"
              value={studentNumber}
              onChange={(event) => setStudentNumber(event.target.value)}
              placeholder="학번 또는 사번"
              autoComplete="username"
            />
            <p className="auth-field-help">
              입력한 학번/사번은 로그인 아이디로 사용됩니다.
            </p>
          </div>

          <div className="auth-form-group">
            <label htmlFor="department">소속학과</label>
            <input
              id="department"
              type="text"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="예: 컴퓨터공학부"
              autoComplete="organization"
            />
          </div>

          <div className="auth-form-row">
            <div className="auth-form-group">
              <label htmlFor="grade">학년</label>
              <select
                id="grade"
                value={grade}
                onChange={(event) => setGrade(event.target.value as GradeType)}
              >
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-form-group">
              <label htmlFor="gender">성별</label>
              <select
                id="gender"
                value={gender}
                onChange={(event) => setGender(event.target.value as GenderType)}
              >
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="auth-form-group">
            <label htmlFor="course">참가 코스</label>
            <select
              id="course"
              value={course}
              onChange={(event) => setCourse(event.target.value as CourseType)}
            >
              {COURSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="auth-form-row">
            <div className="auth-form-group">
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="6자 이상"
                autoComplete="new-password"
              />
            </div>

            <div className="auth-form-group">
              <label htmlFor="passwordConfirm">비밀번호 확인</label>
              <input
                id="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="비밀번호 재입력"
                autoComplete="new-password"
              />
            </div>
          </div>

          <label className="auth-check auth-agreement">
            <input
              type="checkbox"
              checked={isAgreed}
              onChange={(event) => setIsAgreed(event.target.checked)}
            />
            <span>
              도서관 문화행사 참가자 파악 및 행사 안내를 위한 개인정보 수집 및
              이용에 동의합니다.
            </span>
          </label>

          {errorMessage && <p className="auth-error">{errorMessage}</p>}

          <button type="submit" className="auth-submit-button">
            참가신청 완료
          </button>
        </form>

        <div className="auth-divider" />

        <div className="auth-footer-info">
          <p className="auth-note">
            이미 참가신청을 완료했다면 학번/사번과 비밀번호로 로그인할 수 있습니다.
          </p>

          <div className="auth-footer-links">
            <Link to="/login" className="auth-back-link">
              로그인하기
            </Link>

            <Link to="/" className="auth-back-link">
              행사 안내로 돌아가기
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default ApplyPage;