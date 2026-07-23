import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './auth.css';

type CourseType = 'short' | 'half' | 'full';

type AffiliationType =
  | 'undergraduate'
  | 'graduate'
  | 'professor'
  | 'lecturer'
  | 'staff';

type GradeType = '1' | '2' | '3' | '4';

type GenderType = 'female' | 'male' | 'none';

type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type StoredApplicant = {
  name: string;
  loginId: string;
  email: string;
  department: string;
  affiliation: AffiliationType;
  grade: GradeType | null;
  gender: GenderType;
  course: CourseType;
  applicationStatus: ApplicationStatus;
  appliedAt: string;
};

const COURSE_OPTIONS: { label: string; value: CourseType }[] = [
  { label: '단축코스', value: 'short' },
  { label: '하프코스', value: 'half' },
  { label: '풀코스', value: 'full' },
];

const AFFILIATION_OPTIONS: { label: string; value: AffiliationType }[] = [
  { label: '학부생', value: 'undergraduate' },
  { label: '대학원생', value: 'graduate' },
  { label: '교수', value: 'professor' },
  { label: '강사', value: 'lecturer' },
  { label: '직원(연구원 포함)', value: 'staff' },
];

const GRADE_OPTIONS: { label: string; value: GradeType }[] = [
  { label: '1학년', value: '1' },
  { label: '2학년', value: '2' },
  { label: '3학년', value: '3' },
  { label: '4학년', value: '4' },
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
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [affiliation, setAffiliation] =
    useState<AffiliationType>('undergraduate');
  const [grade, setGrade] = useState<GradeType | null>('1');
  const [gender, setGender] = useState<GenderType>('none');
  const [course, setCourse] = useState<CourseType>('half');
  const [isAgreed, setIsAgreed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleAffiliationChange = (nextAffiliation: AffiliationType) => {
    setAffiliation(nextAffiliation);
    setGrade(nextAffiliation === 'undergraduate' ? '1' : null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !name.trim() ||
      !studentNumber.trim() ||
      !email.trim() ||
      !affiliation ||
      !department.trim() ||
      !course ||
      !gender
    ) {
      setErrorMessage('필수 정보를 모두 입력해 주세요.');
      return;
    }

    if (studentNumber.trim().length < 4) {
      setErrorMessage('학번 또는 사번을 정확히 입력해 주세요.');
      return;
    }

    const normalizedEmail = email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      setErrorMessage('학교 이메일을 정확히 입력해 주세요.');
      return;
    }

    if (affiliation === 'undergraduate' && !grade) {
      setErrorMessage('학부생은 학년을 선택해 주세요.');
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
      email: normalizedEmail,
      department: department.trim(),
      affiliation,
      grade: affiliation === 'undergraduate' ? grade : null,
      gender,
      course,
      applicationStatus: 'PENDING',
      appliedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      'applicants',
      JSON.stringify([...applicants, newApplicant]),
    );

    setErrorMessage('');
    navigate('/apply/pending', { state: { email: newApplicant.email } });
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
            독서마라톤 참가를 위한 정보를 입력해 주세요.
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
            <label htmlFor="email">학교 이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onInvalid={(event) => {
                event.preventDefault();
                setErrorMessage('학교 이메일을 정확히 입력해 주세요.');
              }}
              placeholder="학교 이메일"
              autoComplete="email"
            />
          </div>

          <fieldset className="auth-form-group auth-affiliation-group">
            <legend>신분</legend>
            <div className="auth-affiliation-options">
              {AFFILIATION_OPTIONS.map((option) => (
                <label className="auth-affiliation-option" key={option.value}>
                  <input
                    type="radio"
                    name="affiliation"
                    value={option.value}
                    checked={affiliation === option.value}
                    onChange={() => handleAffiliationChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {affiliation === 'undergraduate' && (
            <div className="auth-form-group">
              <label htmlFor="grade">학년</label>
              <select
                id="grade"
                value={grade ?? ''}
                onChange={(event) => setGrade(event.target.value as GradeType)}
              >
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="auth-form-group">
            <label htmlFor="department">소속 학과/부서</label>
            <input
              id="department"
              type="text"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="예: 컴퓨터공학부 또는 도서관"
              autoComplete="organization"
            />
          </div>

          <div className="auth-form-row">
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
            신청 완료 후 관리자 승인 및 로그인 안내를 확인해 주세요.
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
