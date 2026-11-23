import {
  canApply,
  getApplicationAvailability,
  getApplicationClosedMessage,
  type ApplicationAvailability,
} from '../../utils/eventSelection';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { formatKoDateKey } from '../../utils/date';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { findDepartmentGroup } from '../../constants/departments';
import DepartmentSelect from '../../components/forms/DepartmentSelect';
import {
  confirmApplicationEmailVerification,
  createApplication,
  sendApplicationEmailVerification,
  type ApplicationAffiliationType,
} from '../../api/applicationApi';
import { ApiError, getApiErrorMessage } from '../../api/apiClient';
import VerificationCodeInput from '../../components/auth/VerificationCodeInput';
import {
  getCurrentEvent,
  getEvent,
  getEventCourses,
  getPublicEvents,
  type CurrentEvent,
  type EventCourse,
} from '../../api/eventApi';
import {
  SCHOOL_EMAIL_DOMAIN,
  formatCourseDistance,
  getApplicationDaysLeft,
  getCourseTargetPages,
  getPhoneInputError,
  normalizeEmailIdInput,
  toApplicationEmail,
  usesSchoolEmailSuffix,
} from '../../utils/applyForm';
import { METERS_PER_PAGE } from '../../constants/reading';
import './auth.css';
import './apply.css';

type AffiliationType = 'undergraduate' | 'graduate' | 'professor' | 'lecturer' | 'staff';

const AFFILIATION_OPTIONS: { label: string; value: AffiliationType }[] = [
  { label: '학부생', value: 'undergraduate' },
  { label: '대학원생', value: 'graduate' },
  { label: '교수', value: 'professor' },
  { label: '강사·기타', value: 'lecturer' },
  { label: '직원(연구원 포함)', value: 'staff' },
];

const APPLICATION_AFFILIATION_BY_FORM: Partial<
  Record<AffiliationType, ApplicationAffiliationType>
> = {
  undergraduate: 'UNDERGRADUATE',
  graduate: 'GRADUATE',
  professor: 'PROFESSOR',
  staff: 'STAFF',
  lecturer: 'OTHER',
};

/** 상단 상태 행 문구. 신청 가능 여부 판정은 getApplicationAvailability를 그대로 따릅니다. */
const APPLICATION_STATUS_LABEL: Record<ApplicationAvailability['state'], string> = {
  open: '신청 접수 중',
  before: '신청 접수 예정',
  notStarted: '신청 접수 준비 중',
  after: '신청 마감',
  closed: '신청 마감',
  none: '',
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
  const location = useLocation();
  const explicitEventId = Number(
    new URLSearchParams(location.search).get('eventId') || location.state?.eventId,
  );
  const requestedEvent =
    Number.isSafeInteger(explicitEventId) && explicitEventId > 0 ? explicitEventId : null;
  const [availableEvents, setAvailableEvents] = useState<CurrentEvent[]>([]);

  const [name, setName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  // 화면에는 이메일 아이디만 입력받고, API에는 toApplicationEmail로 만든 전체 주소를 보냅니다.
  const [emailId, setEmailId] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<number | null>(null);
  const [verificationSecondsRemaining, setVerificationSecondsRemaining] = useState<number | null>(
    null,
  );
  const [codeInputFocusKey, setCodeInputFocusKey] = useState(0);
  const [grade, setGrade] = useState('');
  const [gender, setGender] = useState('');
  const [department, setDepartment] = useState('');
  const [affiliation, setAffiliation] = useState<AffiliationType>('undergraduate');
  const [currentEvent, setCurrentEvent] = useState<CurrentEvent | null>(null);
  const [courses, setCourses] = useState<EventCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [loadedEventKey, setLoadedEventKey] = useState<number | null>();
  const isEventCourseLoading = loadedEventKey !== requestedEvent;
  const [eventCourseError, setEventCourseError] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');
  const normalizedEmail = toApplicationEmail(emailId);
  // 행사 조회가 끝난 뒤 신청 가능 기간이 아니면 폼 대신 안내를 보여 줍니다. 최종 검증은 서버가 합니다.
  const applicationAvailability = getApplicationAvailability(currentEvent);
  const closedMessage =
    isEventCourseLoading || applicationAvailability.state === 'open'
      ? null
      : currentEvent
        ? getApplicationClosedMessage(applicationAvailability)
        : eventCourseError || getApplicationClosedMessage({ state: 'none' });
  const isEmailVerified = verifiedEmail !== null && verifiedEmail === normalizedEmail;
  const applicationStatus = APPLICATION_STATUS_LABEL[applicationAvailability.state];
  const applicationDaysLeft =
    currentEvent && applicationAvailability.state === 'open'
      ? getApplicationDaysLeft(currentEvent.applicationEndDate)
      : null;
  const showEmailSuffix = usesSchoolEmailSuffix(emailId);
  const isCourseSelectable = !isEventCourseLoading && canApply(currentEvent) && courses.length > 0;
  const isVerificationPending = isSendingVerification || isVerifyingCode;
  const isVerificationExpired = isCodeSent && verificationSecondsRemaining === 0;
  const verificationStatusMessage =
    verificationError ||
    (isVerificationExpired
      ? '인증 시간이 만료되었습니다. 인증번호를 다시 요청해 주세요.'
      : verificationMessage);

  useEffect(() => {
    let isActive = true;

    (async () => {
      const [eventResult, listResult] = await Promise.allSettled([
        requestedEvent ? getEvent(requestedEvent) : getCurrentEvent(),
        getPublicEvents(),
      ]);
      const open =
        listResult.status === 'fulfilled'
          ? listResult.value.filter((event) => canApply(event))
          : [];
      if (isActive) setAvailableEvents(open);
      const event = eventResult.status === 'fulfilled' ? eventResult.value : null;
      const selected = !requestedEvent && !canApply(event) && open.length ? open[0] : event;
      if (!selected) throw eventResult.status === 'rejected' ? eventResult.reason : new Error();
      const courseRows = await getEventCourses(selected.eventId);
      return {
        currentEvent: selected,
        courses: [...courseRows].sort((a, b) => a.displayOrder - b.displayOrder),
      };
    })()
      .then(({ currentEvent: nextCurrentEvent, courses: nextCourses }) => {
        if (!isActive) {
          return;
        }

        setCurrentEvent(nextCurrentEvent);
        setCourses(nextCourses);
        setSelectedCourseId(nextCourses.length === 1 ? nextCourses[0].courseId : null);
        setEventCourseError(nextCourses.length === 0 ? '신청 가능한 코스가 없습니다.' : '');
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setCurrentEvent(null);
        setCourses([]);
        setSelectedCourseId(null);
        setEventCourseError(
          getApiErrorMessage(
            error,
            '행사와 코스 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          ),
        );
      })
      .finally(() => {
        if (isActive) {
          setLoadedEventKey(requestedEvent);
        }
      });

    return () => {
      isActive = false;
    };
  }, [requestedEvent]);

  useEffect(() => {
    if (verificationExpiresAt === null || isEmailVerified) {
      return;
    }

    let intervalId: number | undefined;
    const updateRemainingTime = () => {
      const nextSeconds = Math.max(0, Math.ceil((verificationExpiresAt - Date.now()) / 1000));

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
    setDepartment('');
  };

  const resetEmailVerification = () => {
    setVerificationToken('');
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
    const nextEmailId = normalizeEmailIdInput(nextEmail);

    setEmailId(nextEmailId);

    // 학교 주소 전체를 붙여 넣는 등 실제 주소가 같으면 진행 중인 인증을 유지합니다.
    if (toApplicationEmail(nextEmailId) === normalizedEmail) {
      return;
    }

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

    try {
      await sendApplicationEmailVerification(normalizedEmail);
      setVerificationCode('');
      setIsCodeSent(true);
      setVerificationEmail(normalizedEmail);
      setVerifiedEmail(null);
      setVerificationMessage('인증번호를 이메일로 발송했습니다.');
      setVerificationSecondsRemaining(VERIFICATION_TIME_LIMIT_SECONDS);
      setVerificationExpiresAt(Date.now() + VERIFICATION_TIME_LIMIT_SECONDS * 1000);
      // 인증번호 입력칸이 렌더링된 뒤 첫 번째 자리에 포커스를 옮깁니다.
      setCodeInputFocusKey((current) => current + 1);
    } catch (error) {
      setVerificationError(
        getApiErrorMessage(error, '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
      );
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleVerificationCodeChange = (nextCode: string) => {
    setVerificationCode(nextCode.replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH));
    setVerificationError('');
  };

  const handleConfirmVerification = async () => {
    if (isVerificationPending || isEmailVerified) {
      return;
    }

    if (!isCodeSent || verificationEmail === null || verificationEmail !== normalizedEmail) {
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
      setVerificationToken(
        await confirmApplicationEmailVerification(normalizedEmail, verificationCode),
      );
      setVerifiedEmail(normalizedEmail);
      setVerificationMessage('이메일 인증이 완료되었습니다.');
      setVerificationExpiresAt(null);
      setVerificationSecondsRemaining(null);
    } catch (error) {
      setVerifiedEmail(null);
      setVerificationError(
        getApiErrorMessage(error, '인증번호 확인에 실패했습니다. 입력한 번호를 확인해 주세요.'),
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
      !emailId.trim() ||
      !affiliation ||
      !department.trim()
    ) {
      setErrorMessage('필수 정보를 모두 입력해 주세요.');
      return;
    }

    const phoneError = getPhoneInputError(phone);
    if (phoneError) {
      setErrorMessage(phoneError);
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

    if (!isAgreed) {
      setErrorMessage('개인정보 수집 및 이용 안내에 동의해 주세요.');
      return;
    }

    if (isEventCourseLoading || !currentEvent || !canApply(currentEvent)) {
      setErrorMessage(eventCourseError || '현재 신청 가능한 행사가 없습니다.');
      return;
    }

    if (
      selectedCourseId === null ||
      !courses.some((course) => course.courseId === selectedCourseId)
    ) {
      setErrorMessage('신청 가능한 코스를 선택해 주세요.');
      return;
    }

    const applicationAffiliation = APPLICATION_AFFILIATION_BY_FORM[affiliation];

    if (!applicationAffiliation) {
      setErrorMessage('강사의 서버 소속 유형 정책이 확인되지 않아 현재 참가신청할 수 없습니다.');
      return;
    }

    setErrorMessage('');
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      await createApplication({
        eventId: currentEvent.eventId,
        courseId: selectedCourseId,
        verificationToken,
        privacyConsentVersion: 'application-v1',
        name: name.trim(),
        studentNo: studentNumber.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        affiliationType: applicationAffiliation,
        department: department.trim(),
        college: findDepartmentGroup(department)?.label,
        grade: affiliation === 'undergraduate' && grade ? grade : undefined,
        gender: gender || undefined,
      });
      navigate('/apply/pending', {
        state: { email: normalizedEmail, eventId: currentEvent.eventId },
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        ['EMAIL_NOT_VERIFIED', 'EMAIL_VERIFICATION_EXPIRED'].includes(error.code ?? '')
      ) {
        resetEmailVerification();
      }
      setErrorMessage(
        getApiErrorMessage(error, '참가신청에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
      );
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page apply-page">
      <section className="apply-shell" aria-labelledby="apply-title">
        <header className="apply-header">
          {currentEvent && applicationStatus && (
            <p
              className={`apply-status${applicationAvailability.state === 'open' ? ' is-open' : ''}`}
            >
              <span className="apply-status__state">{applicationStatus}</span>
              <span className="apply-status__period">
                신청기간{' '}
                <time dateTime={currentEvent.applicationStartDate}>
                  {formatKoDateKey(currentEvent.applicationStartDate)}
                </time>{' '}
                ~{' '}
                <time dateTime={currentEvent.applicationEndDate}>
                  {formatKoDateKey(currentEvent.applicationEndDate)}
                </time>
              </span>
              {applicationDaysLeft !== null && (
                <span className="apply-status__deadline">
                  {applicationDaysLeft === 0 ? '오늘 마감' : `마감까지 ${applicationDaysLeft}일`}
                </span>
              )}
            </p>
          )}
          <h1 id="apply-title">독서마라톤 참가신청</h1>
          {currentEvent && <p className="apply-event-title">{currentEvent.title}</p>}
          {availableEvents.some((event) => event.eventId !== currentEvent?.eventId) &&
            currentEvent && (
              <label>
                신청할 행사
                <select
                  disabled={isSubmitting || isEventCourseLoading}
                  value={currentEvent.eventId}
                  onChange={(event) =>
                    navigate(`/apply?eventId=${event.target.value}`, { replace: true })
                  }
                >
                  {!availableEvents.some((event) => event.eventId === currentEvent.eventId) && (
                    <option value={currentEvent.eventId}>{currentEvent.title}</option>
                  )}
                  {availableEvents.map((event) => (
                    <option key={event.eventId} value={event.eventId}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
        </header>

        {closedMessage ? (
          <div className="apply-closed" role="status">
            <strong>{closedMessage}</strong>
            {(applicationAvailability.state === 'after' ||
              applicationAvailability.state === 'closed') && (
              <p>이미 참가 중이라면 로그인 후 독서일지를 작성할 수 있습니다.</p>
            )}
            <div className="apply-closed__actions">
              <Link to="/login" className="apply-closed__primary">
                로그인
              </Link>
              <Link to="/status">대회 현황 보기</Link>
            </div>
          </div>
        ) : (
          <form className="apply-form" onSubmit={handleSubmit}>
            <section className="apply-group" aria-labelledby="apply-group-basic">
              <h2 id="apply-group-basic" className="apply-group__label">
                기본 정보
              </h2>
              <div className="apply-group__body">
                <div className="apply-grid">
                  <div className="apply-field">
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
                  <div className="apply-field">
                    <label htmlFor="studentNumber">학번/사번</label>
                    <input
                      id="studentNumber"
                      type="text"
                      value={studentNumber}
                      onChange={(event) => setStudentNumber(event.target.value)}
                      placeholder="학번 또는 사번"
                      autoComplete="username"
                      aria-describedby="studentNumber-help"
                    />
                    <p id="studentNumber-help" className="apply-help">
                      입력한 학번/사번은 로그인 아이디로 사용됩니다.
                    </p>
                  </div>
                  <div className="apply-field">
                    <label htmlFor="phone">연락처</label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="예: 010-1234-5678"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="apply-group" aria-labelledby="apply-group-email">
              <h2 id="apply-group-email" className="apply-group__label">
                이메일 인증
              </h2>
              <div className="apply-group__body">
                <div className="apply-field">
                  {/* 왼쪽 그룹명이 '이메일 인증'이므로 화면에는 숨기고 보조기기 이름만 유지합니다. */}
                  <label htmlFor="email" className="sr-only">
                    학교 이메일
                  </label>
                  <div className="apply-inline">
                    <div
                      className={`apply-email${showEmailSuffix ? '' : ' is-full-address'}${
                        isVerificationPending ? ' is-disabled' : ''
                      }`}
                    >
                      <input
                        id="email"
                        type="text"
                        inputMode="email"
                        value={emailId}
                        onChange={(event) => handleEmailChange(event.target.value)}
                        placeholder="이메일 아이디"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        disabled={isVerificationPending}
                        aria-describedby={
                          showEmailSuffix
                            ? 'email-suffix email-verification-message'
                            : 'email-verification-message'
                        }
                      />
                      {showEmailSuffix && (
                        <span id="email-suffix" className="apply-email__suffix">
                          @{SCHOOL_EMAIL_DOMAIN}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`apply-button apply-button--outline${
                        isEmailVerified ? ' is-verified' : ''
                      }`}
                      onClick={handleSendVerification}
                      disabled={isVerificationPending || isEmailVerified}
                      aria-busy={isSendingVerification}
                    >
                      {isEmailVerified
                        ? '인증완료'
                        : isSendingVerification
                          ? '발송 중...'
                          : isCodeSent
                            ? '재전송'
                            : '인증하기'}
                    </button>
                  </div>
                </div>

                {isCodeSent && !isEmailVerified && (
                  <div className="apply-field">
                    <span className="apply-field__label" aria-hidden="true">
                      인증번호
                    </span>
                    <div className="apply-otp-row">
                      <VerificationCodeInput
                        value={verificationCode}
                        length={VERIFICATION_CODE_LENGTH}
                        disabled={isVerificationPending}
                        describedById="email-verification-message"
                        onChange={handleVerificationCodeChange}
                        focusRequestKey={codeInputFocusKey}
                      />
                      <span
                        className={`apply-timer${isVerificationExpired ? ' is-expired' : ''}`}
                        role="timer"
                        aria-live="off"
                        aria-label={`인증번호 입력 남은 시간 ${formatVerificationTime(
                          verificationSecondsRemaining ?? VERIFICATION_TIME_LIMIT_SECONDS,
                        )}`}
                      >
                        남은 시간{' '}
                        <b>
                          {formatVerificationTime(
                            verificationSecondsRemaining ?? VERIFICATION_TIME_LIMIT_SECONDS,
                          )}
                        </b>
                      </span>
                      <button
                        type="button"
                        className="apply-button apply-button--primary"
                        onClick={handleConfirmVerification}
                        disabled={
                          isVerificationPending ||
                          verificationCode.length !== VERIFICATION_CODE_LENGTH ||
                          isVerificationExpired
                        }
                        aria-busy={isVerifyingCode}
                      >
                        {isVerifyingCode ? '확인 중...' : '확인'}
                      </button>
                    </div>
                  </div>
                )}

                <p
                  id="email-verification-message"
                  className={`apply-help apply-verification-message${
                    verificationError ? ' is-error' : isEmailVerified ? ' is-success' : ''
                  }`}
                  role={verificationError ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {verificationStatusMessage ||
                    '학교 이메일로 인증번호를 받아 본인 확인을 완료해 주세요.'}
                </p>
              </div>
            </section>

            <section className="apply-group" aria-labelledby="apply-group-affiliation">
              <h2 id="apply-group-affiliation" className="apply-group__label">
                소속 정보
              </h2>
              <div className="apply-group__body">
                <fieldset className="apply-fieldset">
                  <legend className="apply-field__label">소속 유형</legend>
                  <div className="apply-segments">
                    {AFFILIATION_OPTIONS.map((option) => (
                      <label className="apply-segment" key={option.value}>
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
                <div className="apply-field">
                  <DepartmentSelect
                    idPrefix="department"
                    value={department}
                    onChange={setDepartment}
                    includeGeneral={affiliation !== 'undergraduate'}
                    collegeLabel={affiliation === 'undergraduate' ? '단과대학' : '소속 구분'}
                    departmentLabel={
                      affiliation === 'undergraduate' ? '학과·학부' : '소속 학과/부서'
                    }
                    fieldClassName="apply-field"
                  />
                  {affiliation === 'undergraduate' && (
                    <label className="apply-field">
                      학년 (선택)
                      <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                        <option value="">선택하지 않음</option>
                        {['1', '2', '3', '4', '5', '6'].map((g) => (
                          <option key={g} value={g}>
                            {g}학년
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="apply-field">
                    성별 (선택)
                    <select value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option value="">선택하지 않음</option>
                      <option value="여">여</option>
                      <option value="남">남</option>
                    </select>
                  </label>
                  <p className="apply-help">
                    학년과 성별은 도서관 결과 보고에 사용되는 선택 항목입니다.
                  </p>
                  <p className="apply-help">목록에 없는 소속은 도서관 담당자에게 문의해 주세요.</p>
                </div>
              </div>
            </section>

            <section className="apply-group" aria-labelledby="apply-group-course">
              <h2 id="apply-group-course" className="apply-group__label">
                참가 코스
              </h2>
              <div className="apply-group__body">
                <fieldset className="apply-fieldset" aria-describedby="course-help">
                  <legend className="sr-only">참가 코스 선택</legend>
                  {courses.length > 0 ? (
                    <div className="apply-courses">
                      {courses.map((course) => (
                        <label className="apply-course" key={course.courseId}>
                          <input
                            type="radio"
                            name="course"
                            value={course.courseId}
                            checked={selectedCourseId === course.courseId}
                            onChange={() => setSelectedCourseId(course.courseId)}
                            disabled={!isCourseSelectable}
                          />
                          <span className="apply-course__box">
                            <span className="apply-course__name">{course.name}</span>
                            {/* 화면 낭독기가 코스명과 거리를 이어 읽지 않도록 띄어 둡니다. */}{' '}
                            {course.targetDistanceMeter > 0 && (
                              <span className="apply-course__meta">
                                {formatCourseDistance(course.targetDistanceMeter)} ·{' '}
                                {getCourseTargetPages(course.targetDistanceMeter).toLocaleString(
                                  'ko-KR',
                                )}
                                쪽
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    // 코스가 없을 때의 안내는 아래 오류 문구(eventCourseError)가 맡습니다.
                    isEventCourseLoading && (
                      <p className="apply-course-empty">코스 정보를 불러오는 중입니다.</p>
                    )
                  )}
                </fieldset>
                {eventCourseError ? (
                  <p id="course-help" className="apply-help is-error" role="alert">
                    {eventCourseError}
                  </p>
                ) : (
                  <p id="course-help" className="apply-help">
                    신청한 코스는 추후 관리자에게 요청해 상위 코스로 변경할 수 있습니다. 독서 1쪽은{' '}
                    {METERS_PER_PAGE}m입니다.
                  </p>
                )}
              </div>
            </section>

            <div className="apply-footer">
              <label className="apply-agreement">
                <input
                  type="checkbox"
                  checked={isAgreed}
                  onChange={(event) => setIsAgreed(event.target.checked)}
                />
                <span>
                  도서관 문화행사 참가자 파악 및 행사 안내를 위한 개인정보 수집 및 이용에
                  동의합니다.
                </span>
              </label>
              {errorMessage && (
                <p className="apply-error" role="alert">
                  {errorMessage}
                </p>
              )}
              <div className="apply-submit">
                <p className="apply-submit__guide">
                  승인 결과와 로그인 안내는 인증한 학교 이메일로 발송됩니다.
                </p>
                <button
                  type="submit"
                  className="apply-button apply-button--primary apply-submit__button"
                  disabled={
                    !isEmailVerified ||
                    isVerificationPending ||
                    isSubmitting ||
                    isEventCourseLoading ||
                    !canApply(currentEvent) ||
                    selectedCourseId === null
                  }
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? '신청 중...' : '참가신청하기'}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

export default ApplyPage;
