import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { GENERAL_AFFILIATIONS, STUDENT_DEPARTMENT_GROUPS } from '../../constants/departments';
import {
  confirmApplicationEmailVerification,
  createApplication,
  sendApplicationEmailVerification,
  type ApplicationAffiliationType,
} from '../../api/applicationApi';
import { ApiError } from '../../api/apiClient';
import {
  getCurrentEvent,
  getEventCourses,
  type CurrentEvent,
  type EventCourse,
} from '../../api/eventApi';
import './auth.css';

type AffiliationType =
  | 'undergraduate'
  | 'graduate'
  | 'professor'
  | 'lecturer'
  | 'staff';

type GradeType = '1' | '2' | '3' | '4';

type GenderType = 'female' | 'male' | 'none';

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

const APPLICATION_AFFILIATION_BY_FORM: Partial<
  Record<AffiliationType, ApplicationAffiliationType>
> = {
  undergraduate: 'UNDERGRADUATE',
  graduate: 'GRADUATE',
  professor: 'PROFESSOR',
  staff: 'STAFF',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_CODE_PATTERN = /^\d{6}$/;
const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_TIME_LIMIT_SECONDS = 5 * 60;

const formatVerificationTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

function ApplyPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null,
  );
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<
    number | null
  >(null);
  const [verificationSecondsRemaining, setVerificationSecondsRemaining] =
    useState<number | null>(null);
  const verificationDigitRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [department, setDepartment] = useState('');
  const [affiliation, setAffiliation] =
    useState<AffiliationType>('undergraduate');
  const [grade, setGrade] = useState<GradeType | null>('1');
  const [gender, setGender] = useState<GenderType>('none');
  const [currentEvent, setCurrentEvent] = useState<CurrentEvent | null>(null);
  const [courses, setCourses] = useState<EventCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [isEventCourseLoading, setIsEventCourseLoading] = useState(true);
  const [eventCourseError, setEventCourseError] = useState('');
  const eventCourseRequestRef = useRef<
    Promise<{ currentEvent: CurrentEvent; courses: EventCourse[] }> | null
  >(null);
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');
  const normalizedEmail = email.trim();
  const isEmailVerified =
    verifiedEmail !== null && verifiedEmail === normalizedEmail;
  const isVerificationPending = isSendingVerification || isVerifyingCode;
  const isVerificationExpired =
    isCodeSent && verificationSecondsRemaining === 0;
  const verificationStatusMessage =
    verificationError ||
    (isVerificationExpired
      ? '인증 시간이 만료되었습니다. 인증번호를 다시 요청해 주세요.'
      : verificationMessage);

  useEffect(() => {
    let isActive = true;

    if (eventCourseRequestRef.current === null) {
      eventCourseRequestRef.current = (async () => {
        const nextCurrentEvent = await getCurrentEvent();
        const nextCourses = await getEventCourses(nextCurrentEvent.eventId);

        return {
          currentEvent: nextCurrentEvent,
          courses: [...nextCourses].sort(
            (first, second) => first.displayOrder - second.displayOrder,
          ),
        };
      })();
    }

    eventCourseRequestRef.current
      .then(({ currentEvent: nextCurrentEvent, courses: nextCourses }) => {
        if (!isActive) {
          return;
        }

        const defaultCourse =
          nextCourses.find(
            (course) => course.name.replace(/\s/g, '') === '하프코스',
          ) ?? nextCourses[0];

        setCurrentEvent(nextCurrentEvent);
        setCourses(nextCourses);
        setSelectedCourseId(defaultCourse?.courseId ?? null);
        setEventCourseError(
          nextCourses.length === 0 ? '신청 가능한 코스가 없습니다.' : '',
        );
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setCurrentEvent(null);
        setCourses([]);
        setSelectedCourseId(null);
        setEventCourseError(
          error instanceof ApiError
            ? error.message
            : '행사와 코스 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
      })
      .finally(() => {
        if (isActive) {
          setIsEventCourseLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (verificationExpiresAt === null || isEmailVerified) {
      return;
    }

    let intervalId: number | undefined;
    const updateRemainingTime = () => {
      const nextSeconds = Math.max(
        0,
        Math.ceil((verificationExpiresAt - Date.now()) / 1000),
      );

      setVerificationSecondsRemaining(nextSeconds);

      if (nextSeconds === 0 && intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };

    updateRemainingTime();

    if (verificationExpiresAt > Date.now()) {
      intervalId = window.setInterval(updateRemainingTime, 1000);
    }

    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [verificationExpiresAt, isEmailVerified]);

  const handleAffiliationChange = (nextAffiliation: AffiliationType) => {
    setAffiliation(nextAffiliation);
    setGrade(nextAffiliation === 'undergraduate' ? '1' : null);
    setDepartment('');
  };

  const resetEmailVerification = () => {
    setVerificationCode('');
    setIsCodeSent(false);
    setVerificationEmail(null);
    setVerifiedEmail(null);
    setVerificationMessage('');
    setVerificationError('');
    setVerificationExpiresAt(null);
    setVerificationSecondsRemaining(null);
  };

  const handleEmailChange = (nextEmail: string) => {
    setEmail(nextEmail);

    if (isCodeSent || verifiedEmail !== null) {
      resetEmailVerification();
    } else {
      setVerificationError('');
      setVerificationMessage('');
    }

    setErrorMessage('');
  };

  const handleSendVerification = async () => {
    if (isVerificationPending || isEmailVerified) {
      return;
    }

    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      setVerificationMessage('');
      setVerificationError('학교 이메일을 정확히 입력해 주세요.');
      return;
    }

    setErrorMessage('');
    setVerificationError('');
    setVerificationMessage('');
    setIsSendingVerification(true);
    let wasVerificationSent = false;

    try {
      await sendApplicationEmailVerification(normalizedEmail);
      setVerificationCode('');
      setIsCodeSent(true);
      setVerificationEmail(normalizedEmail);
      setVerifiedEmail(null);
      setVerificationMessage('인증번호를 이메일로 발송했습니다.');
      setVerificationSecondsRemaining(VERIFICATION_TIME_LIMIT_SECONDS);
      setVerificationExpiresAt(
        Date.now() + VERIFICATION_TIME_LIMIT_SECONDS * 1000,
      );
      wasVerificationSent = true;
    } catch (error) {
      setVerificationError(
        error instanceof ApiError
          ? error.message
          : '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setIsSendingVerification(false);

      if (wasVerificationSent) {
        window.requestAnimationFrame(() => {
          verificationDigitRefs.current[0]?.focus();
        });
      }
    }
  };

  const handleVerificationCodeChange = (nextCode: string) => {
    setVerificationCode(
      nextCode.replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH),
    );
    setVerificationError('');
  };

  const focusVerificationDigit = (index: number) => {
    window.requestAnimationFrame(() => {
      verificationDigitRefs.current[index]?.focus();
    });
  };

  const handleVerificationDigitChange = (index: number, nextValue: string) => {
    const digits = nextValue.replace(/\D/g, '');

    if (!digits) {
      handleVerificationCodeChange(
        verificationCode.slice(0, index) + verificationCode.slice(index + 1),
      );
      return;
    }

    if (index > verificationCode.length) {
      focusVerificationDigit(verificationCode.length);
      return;
    }

    const digit = digits.slice(-1);
    const nextCode =
      index === verificationCode.length
        ? verificationCode + digit
        : verificationCode.slice(0, index) +
          digit +
          verificationCode.slice(index + 1);

    handleVerificationCodeChange(nextCode);

    if (index < VERIFICATION_CODE_LENGTH - 1) {
      focusVerificationDigit(index + 1);
    }
  };

  const handleVerificationDigitKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === 'Backspace') {
      event.preventDefault();

      if (verificationCode[index]) {
        handleVerificationCodeChange(
          verificationCode.slice(0, index) +
            verificationCode.slice(index + 1),
        );
        focusVerificationDigit(index);
      } else if (index > 0) {
        focusVerificationDigit(index - 1);
      }

      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusVerificationDigit(index - 1);
    }

    if (
      event.key === 'ArrowRight' &&
      index < VERIFICATION_CODE_LENGTH - 1
    ) {
      event.preventDefault();
      focusVerificationDigit(index + 1);
    }
  };

  const handleVerificationCodePaste = (
    event: ClipboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    const pastedDigits = event.clipboardData
      .getData('text')
      .replace(/\D/g, '');

    if (!pastedDigits) {
      return;
    }

    event.preventDefault();

    const startIndex = Math.min(index, verificationCode.length);
    const availableDigits = pastedDigits.slice(
      0,
      VERIFICATION_CODE_LENGTH - startIndex,
    );
    const nextCode = (
      verificationCode.slice(0, startIndex) +
      availableDigits +
      verificationCode.slice(startIndex + availableDigits.length)
    ).slice(0, VERIFICATION_CODE_LENGTH);

    handleVerificationCodeChange(nextCode);
    focusVerificationDigit(
      Math.min(
        startIndex + availableDigits.length,
        VERIFICATION_CODE_LENGTH - 1,
      ),
    );
  };

  const handleConfirmVerification = async () => {
    if (isVerificationPending || isEmailVerified) {
      return;
    }

    if (
      !isCodeSent ||
      verificationEmail === null ||
      verificationEmail !== normalizedEmail
    ) {
      setVerificationMessage('');
      setVerificationError('학교 이메일 인증번호를 다시 요청해 주세요.');
      return;
    }

    if (!VERIFICATION_CODE_PATTERN.test(verificationCode)) {
      setVerificationMessage('');
      setVerificationError('인증번호 6자리를 입력해 주세요.');
      return;
    }

    setErrorMessage('');
    setVerificationError('');
    setVerificationMessage('');
    setIsVerifyingCode(true);

    try {
      await confirmApplicationEmailVerification(
        normalizedEmail,
        verificationCode,
      );
      setVerifiedEmail(normalizedEmail);
      setVerificationMessage('이메일 인증이 완료되었습니다.');
      setVerificationExpiresAt(null);
      setVerificationSecondsRemaining(null);
    } catch (error) {
      setVerifiedEmail(null);
      setVerificationError(
        error instanceof ApiError
          ? error.message
          : '인증번호 확인에 실패했습니다. 입력한 번호를 확인해 주세요.',
      );
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmittingRef.current) {
      return;
    }

    if (
      !name.trim() ||
      !studentNumber.trim() ||
      !email.trim() ||
      !affiliation ||
      !department.trim() ||
      !gender
    ) {
      setErrorMessage('필수 정보를 모두 입력해 주세요.');
      return;
    }

    if (studentNumber.trim().length < 4) {
      setErrorMessage('학번 또는 사번을 정확히 입력해 주세요.');
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setErrorMessage('학교 이메일을 정확히 입력해 주세요.');
      return;
    }

    if (!isEmailVerified) {
      setErrorMessage('학교 이메일 인증을 완료해 주세요.');
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

    if (!currentEvent) {
      setErrorMessage(
        eventCourseError || '현재 신청 가능한 행사가 없습니다.',
      );
      return;
    }

    if (
      selectedCourseId === null ||
      !courses.some((course) => course.courseId === selectedCourseId)
    ) {
      setErrorMessage('신청 가능한 코스를 선택해 주세요.');
      return;
    }

    const applicationAffiliation =
      APPLICATION_AFFILIATION_BY_FORM[affiliation];

    if (!applicationAffiliation) {
      setErrorMessage(
        '강사의 서버 소속 유형 정책이 확인되지 않아 현재 참가신청할 수 없습니다.',
      );
      return;
    }

    setErrorMessage('');
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      await createApplication({
        eventId: currentEvent.eventId,
        courseId: selectedCourseId,
        name: name.trim(),
        studentNo: studentNumber.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        affiliationType: applicationAffiliation,
        department: department.trim(),
      });
      navigate('/apply/pending', { state: { email: normalizedEmail } });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : '참가신청에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      );
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
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

          <div className="auth-form-group auth-email-verification">
            <label htmlFor="email">학교 이메일</label>
            <div className="auth-email-verification__row">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => handleEmailChange(event.target.value)}
                onInvalid={(event) => {
                  event.preventDefault();
                  setVerificationError('학교 이메일을 정확히 입력해 주세요.');
                }}
                placeholder="학교 이메일"
                autoComplete="email"
                disabled={isVerificationPending}
                aria-describedby="email-verification-message"
              />
              <button
                type="button"
                className={`auth-email-verification__button${
                  isEmailVerified ? ' is-verified' : ''
                }`}
                onClick={handleSendVerification}
                disabled={isVerificationPending || isEmailVerified}
                aria-busy={isSendingVerification}
              >
                {isEmailVerified
                  ? '인증완료'
                  : isSendingVerification
                    ? '발송 중'
                    : isCodeSent
                      ? '재전송'
                      : '인증하기'}
              </button>
            </div>

            {isCodeSent && !isEmailVerified && (
              <div className="auth-email-verification__row auth-email-verification__code-row">
                <span
                  id="verification-code-label"
                  className="sr-only"
                >
                  이메일 인증번호
                </span>
                <div
                  className="auth-email-verification__otp"
                  role="group"
                  aria-labelledby="verification-code-label"
                >
                  {Array.from({ length: VERIFICATION_CODE_LENGTH }).map(
                    (_, index) => (
                      <input
                        key={index}
                        ref={(element) => {
                          verificationDigitRefs.current[index] = element;
                        }}
                        id={`verificationCode-${index + 1}`}
                        className="auth-email-verification__digit"
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        value={verificationCode[index] ?? ''}
                        onChange={(event) =>
                          handleVerificationDigitChange(
                            index,
                            event.target.value,
                          )
                        }
                        onKeyDown={(event) =>
                          handleVerificationDigitKeyDown(event, index)
                        }
                        onPaste={(event) =>
                          handleVerificationCodePaste(event, index)
                        }
                        onFocus={(event) => event.currentTarget.select()}
                        maxLength={1}
                        disabled={isVerificationPending}
                        aria-label={`인증번호 ${index + 1}번째 자리`}
                        aria-describedby="email-verification-message"
                      />
                    ),
                  )}
                </div>
                <span
                  className="auth-email-verification__timer"
                  role="timer"
                  aria-live="off"
                  aria-label={`인증번호 입력 남은 시간 ${formatVerificationTime(
                    verificationSecondsRemaining ??
                      VERIFICATION_TIME_LIMIT_SECONDS,
                  )}`}
                >
                  {formatVerificationTime(
                    verificationSecondsRemaining ??
                      VERIFICATION_TIME_LIMIT_SECONDS,
                  )}
                </span>
                <button
                  type="button"
                  className="auth-email-verification__button auth-email-verification__confirm"
                  onClick={handleConfirmVerification}
                  disabled={
                    isVerificationPending ||
                    verificationCode.length !== VERIFICATION_CODE_LENGTH ||
                    isVerificationExpired
                  }
                  aria-busy={isVerifyingCode}
                >
                  {isVerifyingCode ? '확인 중' : '확인'}
                </button>
              </div>
            )}

            <p
              id="email-verification-message"
              className={`auth-email-verification__message${
                verificationError ? ' is-error' : ''
              }`}
              role={verificationError ? 'alert' : 'status'}
              aria-live="polite"
            >
              {verificationStatusMessage}
            </p>
          </div>

          <div className="auth-form-group">
            <label htmlFor="phone">연락처</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="예: 010-1234-5678"
              autoComplete="tel"
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
            <label htmlFor="department">{affiliation === 'undergraduate' ? '소속 학과' : '소속 학과/부서'}</label>
            <select
              id="department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            >
              <option value="" disabled>소속을 선택해 주세요</option>
              {STUDENT_DEPARTMENT_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.departments.map((item) => <option key={item} value={item}>{item}</option>)}
                </optgroup>
              ))}
              {affiliation !== 'undergraduate' && (
                <optgroup label="교직원·대학원·기타">
                  {GENERAL_AFFILIATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </optgroup>
              )}
            </select>
            <small className="auth-department-guide">목록에 없는 소속은 도서관 담당자에게 문의해 주세요.</small>
          </div>

          <div className="auth-form-row">
            <div className="auth-form-group">
              <label htmlFor="course">참가 코스</label>
              <select
                id="course"
                value={selectedCourseId ?? ''}
                onChange={(event) =>
                  setSelectedCourseId(Number(event.target.value))
                }
                disabled={
                  isEventCourseLoading ||
                  currentEvent === null ||
                  courses.length === 0
                }
              >
                <option value="" disabled>
                  {isEventCourseLoading
                    ? '코스 정보를 불러오는 중입니다'
                    : courses.length === 0
                      ? '신청 가능한 코스 없음'
                      : '코스를 선택해 주세요'}
                </option>
                {courses.map((course) => (
                  <option key={course.courseId} value={course.courseId}>
                    {course.name}
                  </option>
                ))}
              </select>
              {eventCourseError && (
                <p className="auth-error" role="alert">
                  {eventCourseError}
                </p>
              )}
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

          <button
            type="submit"
            className="auth-submit-button"
            disabled={
              !isEmailVerified ||
              isVerificationPending ||
              isSubmitting ||
              isEventCourseLoading ||
              currentEvent === null ||
              selectedCourseId === null
            }
            aria-busy={isSubmitting}
          >
            {isSubmitting ? '신청 중...' : '참가신청하기'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default ApplyPage;
