import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createAdminCourse,
  createAdminEvent,
  deleteAdminCourse,
  deleteAdminEvent,
  getAdminEvent,
  getAdminEventCourses,
  getAdminEvents,
  updateAdminCourse,
  updateAdminEvent,
} from '../../api/adminEventApi';
import { ApiError } from '../../api/apiClient';
import {
  EVENT_STATUSES,
  type AdminCourse,
  type AdminEvent,
  type CreateCourseRequest,
  type CreateEventRequest,
  type EventStatus,
} from '../../types/adminEvent';
import '../../styles/admin-event-settings.css';

type EventForm = {
  title: string;
  roundNo: string;
  applicationStartDate: string;
  applicationEndDate: string;
  eventStartDate: string;
  eventEndDate: string;
  status: EventStatus;
  description: string;
  contactPhone: string;
  contactEmail: string;
  kakaoOpenChatUrl: string;
  publicVisible: boolean;
};

type CourseForm = {
  name: string;
  targetDistanceMeter: string;
  standardBookCount: string;
  avgMonthlyReadingCount: string;
  maxWinners: string;
  extraLoanCount: string;
  rewardType: string;
  rewardAmount: string;
  displayOrder: string;
};

type CourseNumberField = Exclude<keyof CourseForm, 'name' | 'rewardType'>;

const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: '작성 중',
  READY: '준비',
  APPLICATION_OPEN: '신청 접수 중',
  APPLICATION_CLOSED: '신청 마감',
  IN_PROGRESS: '진행 중',
  ENDED: '종료',
  FINALIZED: '최종 확정',
  ARCHIVED: '보관',
};

const DEFAULT_EVENT_SELECTION_ORDER: EventStatus[] = [
  'APPLICATION_OPEN',
  'READY',
  'DRAFT',
];

const EMPTY_EVENT_FORM: EventForm = {
  title: '',
  roundNo: '',
  applicationStartDate: '',
  applicationEndDate: '',
  eventStartDate: '',
  eventEndDate: '',
  status: 'DRAFT',
  description: '',
  contactPhone: '',
  contactEmail: '',
  kakaoOpenChatUrl: '',
  publicVisible: false,
};

const EMPTY_COURSE_FORM: CourseForm = {
  name: '',
  targetDistanceMeter: '',
  standardBookCount: '',
  avgMonthlyReadingCount: '0',
  maxWinners: '0',
  extraLoanCount: '0',
  rewardType: '',
  rewardAmount: '0',
  displayOrder: '0',
};

const COURSE_NUMBER_FIELDS: CourseNumberField[] = [
  'targetDistanceMeter',
  'standardBookCount',
  'avgMonthlyReadingCount',
  'maxWinners',
  'extraLoanCount',
  'rewardAmount',
  'displayOrder',
];

function getApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function toEventForm(event: AdminEvent): EventForm {
  return {
    title: event.title,
    roundNo: String(event.roundNo),
    applicationStartDate: event.applicationStartDate,
    applicationEndDate: event.applicationEndDate,
    eventStartDate: event.eventStartDate,
    eventEndDate: event.eventEndDate,
    status: event.status,
    description: event.description ?? '',
    contactPhone: event.contactPhone ?? '',
    contactEmail: event.contactEmail ?? '',
    kakaoOpenChatUrl: event.kakaoOpenChatUrl ?? '',
    publicVisible: event.publicVisible,
  };
}

function toCourseForm(course: AdminCourse): CourseForm {
  return {
    name: course.name,
    targetDistanceMeter: String(course.targetDistanceMeter),
    standardBookCount: String(course.standardBookCount),
    avgMonthlyReadingCount: String(course.avgMonthlyReadingCount),
    maxWinners: String(course.maxWinners),
    extraLoanCount: String(course.extraLoanCount),
    rewardType: course.rewardType ?? '',
    rewardAmount: String(course.rewardAmount),
    displayOrder: String(course.displayOrder),
  };
}

function chooseEventId(events: AdminEvent[], preferredEventId?: number) {
  if (
    preferredEventId &&
    events.some((event) => event.eventId === preferredEventId)
  ) {
    return preferredEventId;
  }

  for (const status of DEFAULT_EVENT_SELECTION_ORDER) {
    const matchedEvent = events.find((event) => event.status === status);

    if (matchedEvent) {
      return matchedEvent.eventId;
    }
  }

  return events[0]?.eventId ?? null;
}

function getDateUtcValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function getTodayUtcValue() {
  const today = new Date();

  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
}

function getEventCountdown(startDate: string, endDate: string) {
  const startUtc = getDateUtcValue(startDate);

  if (startUtc === null) {
    return '일정 미설정';
  }

  const todayUtc = getTodayUtcValue();
  const remainingDays = Math.ceil(
    (startUtc - todayUtc) / (24 * 60 * 60 * 1000),
  );

  if (remainingDays > 0) {
    return `D-${remainingDays}`;
  }

  if (remainingDays === 0) {
    return 'D-DAY';
  }

  const endUtc = getDateUtcValue(endDate);

  if (endUtc !== null && todayUtc <= endUtc) {
    return '행사 진행 중';
  }

  return endUtc !== null ? '행사 종료' : '시작일 경과';
}

function formatDateLabel(value: string) {
  if (!value) {
    return '행사 시작일을 입력해 주세요.';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function validateEventForm(form: EventForm) {
  if (!form.title.trim()) {
    return '행사명을 입력해 주세요.';
  }

  const roundNo = Number(form.roundNo);

  if (!Number.isInteger(roundNo) || roundNo <= 0) {
    return '회차는 0보다 큰 정수여야 합니다.';
  }

  if (
    !form.applicationStartDate ||
    !form.applicationEndDate ||
    !form.eventStartDate ||
    !form.eventEndDate
  ) {
    return '행사 기간과 신청 기간의 날짜를 모두 입력해 주세요.';
  }

  if (form.applicationEndDate < form.applicationStartDate) {
    return '신청 종료일은 신청 시작일보다 빠를 수 없습니다.';
  }

  if (form.eventEndDate < form.eventStartDate) {
    return '행사 종료일은 행사 시작일보다 빠를 수 없습니다.';
  }

  return null;
}

function toEventRequest(form: EventForm): CreateEventRequest {
  return {
    title: form.title.trim(),
    roundNo: Number(form.roundNo),
    applicationStartDate: form.applicationStartDate,
    applicationEndDate: form.applicationEndDate,
    eventStartDate: form.eventStartDate,
    eventEndDate: form.eventEndDate,
    status: form.status,
    description: form.description.trim(),
    contactPhone: form.contactPhone.trim(),
    contactEmail: form.contactEmail.trim(),
    kakaoOpenChatUrl: form.kakaoOpenChatUrl.trim(),
    publicVisible: form.publicVisible,
  };
}

function validateCourseForm(form: CourseForm) {
  if (!form.name.trim()) {
    return '코스명을 입력해 주세요.';
  }

  for (const field of COURSE_NUMBER_FIELDS) {
    const value = Number(form[field]);

    if (!Number.isFinite(value) || value < 0) {
      return '코스 숫자 항목은 0 이상의 숫자여야 합니다.';
    }
  }

  if (
    Number(form.targetDistanceMeter) <= 0 ||
    Number(form.standardBookCount) <= 0
  ) {
    return '목표 거리와 기준 도서 수는 0보다 커야 합니다.';
  }

  return null;
}

function toCourseRequest(form: CourseForm): CreateCourseRequest {
  return {
    name: form.name.trim(),
    targetDistanceMeter: Number(form.targetDistanceMeter),
    standardBookCount: Number(form.standardBookCount),
    avgMonthlyReadingCount: Number(form.avgMonthlyReadingCount),
    maxWinners: Number(form.maxWinners),
    extraLoanCount: Number(form.extraLoanCount),
    rewardType: form.rewardType.trim(),
    rewardAmount: Number(form.rewardAmount),
    displayOrder: Number(form.displayOrder),
  };
}

function AdminEventSettingsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [eventForm, setEventForm] = useState<EventForm>(EMPTY_EVENT_FORM);
  const [courseForms, setCourseForms] = useState<
    Array<{ courseId: number; form: CourseForm }>
  >([]);
  const [newCourseForm, setNewCourseForm] =
    useState<CourseForm>(EMPTY_COURSE_FORM);
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isEventDetailLoading, setIsEventDetailLoading] = useState(false);
  const [isCoursesLoading, setIsCoursesLoading] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [savingCourseId, setSavingCourseId] = useState<number | 'new' | null>(
    null,
  );
  const [deletingCourseId, setDeletingCourseId] = useState<number | null>(null);
  const [pageError, setPageError] = useState('');
  const [courseError, setCourseError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const initialEventsRequestRef = useRef<Promise<AdminEvent[]> | null>(null);
  const detailRequestRef = useRef<{
    eventId: number;
    promise: Promise<AdminEvent>;
  } | null>(null);
  const coursesRequestRef = useRef<{
    eventId: number;
    promise: Promise<AdminCourse[]>;
  } | null>(null);

  const eventCountdown = useMemo(
    () => getEventCountdown(eventForm.eventStartDate, eventForm.eventEndDate),
    [eventForm.eventEndDate, eventForm.eventStartDate],
  );

  const clearFeedback = () => {
    setFeedbackMessage('');
    setFeedbackIsError(false);
  };

  const showError = (message: string) => {
    setFeedbackMessage(message);
    setFeedbackIsError(true);
  };

  const showSuccess = (message: string) => {
    setFeedbackMessage(message);
    setFeedbackIsError(false);
  };

  const applyEvents = (nextEvents: AdminEvent[], preferredEventId?: number) => {
    const nextEventId = chooseEventId(nextEvents, preferredEventId);

    setEvents(nextEvents);

    if (nextEventId !== selectedEventId) {
      setIsEventDetailLoading(nextEventId !== null);
      setIsCoursesLoading(nextEventId !== null);
    }

    setSelectedEventId(nextEventId);
    setIsCreatingEvent(false);

    if (nextEventId === null) {
      setIsEventDetailLoading(false);
      setIsCoursesLoading(false);
      setEventForm(EMPTY_EVENT_FORM);
      setCourseForms([]);
    }

    return nextEventId;
  };

  const refreshEvents = async (preferredEventId?: number) => {
    setIsEventsLoading(true);

    try {
      const nextEvents = await getAdminEvents();

      setPageError('');
      return applyEvents(nextEvents, preferredEventId);
    } finally {
      setIsEventsLoading(false);
    }
  };

  const refreshCourses = async (eventId: number) => {
    setIsCoursesLoading(true);

    try {
      const courses = await getAdminEventCourses(eventId);

      setCourseForms(
        courses.map((course) => ({
          courseId: course.courseId,
          form: toCourseForm(course),
        })),
      );
      setCourseError('');
    } finally {
      setIsCoursesLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    if (initialEventsRequestRef.current === null) {
      initialEventsRequestRef.current = getAdminEvents();
    }

    initialEventsRequestRef.current
      .then((nextEvents) => {
        if (!isActive) {
          return;
        }

        const nextEventId = chooseEventId(nextEvents);

        setEvents(nextEvents);
        setSelectedEventId(nextEventId);
        setIsEventDetailLoading(nextEventId !== null);
        setIsCoursesLoading(nextEventId !== null);

        if (nextEventId === null) {
          setEventForm(EMPTY_EVENT_FORM);
          setCourseForms([]);
        }

        setPageError('');
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setPageError(
          getApiErrorMessage(error, '행사 목록을 불러오지 못했습니다.'),
        );
      })
      .finally(() => {
        if (isActive) {
          setIsEventsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (selectedEventId === null || isCreatingEvent) {
      return;
    }

    let isActive = true;
    const eventId = selectedEventId;

    if (
      detailRequestRef.current === null ||
      detailRequestRef.current.eventId !== eventId
    ) {
      detailRequestRef.current = {
        eventId,
        promise: getAdminEvent(eventId),
      };
    }

    if (
      coursesRequestRef.current === null ||
      coursesRequestRef.current.eventId !== eventId
    ) {
      coursesRequestRef.current = {
        eventId,
        promise: getAdminEventCourses(eventId),
      };
    }

    const detailRequest = detailRequestRef.current;
    const coursesRequest = coursesRequestRef.current;

    detailRequest.promise
      .then((event) => {
        if (isActive) {
          setEventForm(toEventForm(event));
          setPageError('');
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setPageError(
            getApiErrorMessage(error, '행사 상세를 불러오지 못했습니다.'),
          );
        }
      })
      .finally(() => {
        if (detailRequestRef.current === detailRequest) {
          detailRequestRef.current = null;
        }

        if (isActive) {
          setIsEventDetailLoading(false);
        }
      });

    coursesRequest.promise
      .then((courses) => {
        if (isActive) {
          setCourseForms(
            courses.map((course) => ({
              courseId: course.courseId,
              form: toCourseForm(course),
            })),
          );
          setCourseError('');
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setCourseError(
            getApiErrorMessage(error, '코스 목록을 불러오지 못했습니다.'),
          );
        }
      })
      .finally(() => {
        if (coursesRequestRef.current === coursesRequest) {
          coursesRequestRef.current = null;
        }

        if (isActive) {
          setIsCoursesLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [isCreatingEvent, selectedEventId]);

  const handleEventFieldChange = <Field extends keyof EventForm>(
    field: Field,
    value: EventForm[Field],
  ) => {
    clearFeedback();
    setEventForm((current) => ({ ...current, [field]: value }));
  };

  const handleEventSelection = (value: string) => {
    const eventId = Number(value);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return;
    }

    clearFeedback();
    setPageError('');
    setCourseError('');
    setIsAddingCourse(false);
    setIsEventDetailLoading(true);
    setIsCoursesLoading(true);
    setSelectedEventId(eventId);
    setIsCreatingEvent(false);
  };

  const handleCreateEventStart = () => {
    clearFeedback();
    setPageError('');
    setCourseError('');
    setSelectedEventId(null);
    setIsCreatingEvent(true);
    setIsEventDetailLoading(false);
    setIsCoursesLoading(false);
    setEventForm(EMPTY_EVENT_FORM);
    setCourseForms([]);
    setIsAddingCourse(false);
  };

  const handleCreateEventCancel = () => {
    clearFeedback();
    applyEvents(events);
  };

  const handleEventSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    if (isSavingEvent) {
      return;
    }

    const validationMessage = validateEventForm(eventForm);

    if (validationMessage) {
      showError(validationMessage);
      return;
    }

    setIsSavingEvent(true);
    clearFeedback();

    try {
      const request = toEventRequest(eventForm);

      if (isCreatingEvent) {
        const createdEvent = await createAdminEvent(request);
        const nextEventId = await refreshEvents(createdEvent?.eventId);

        if (nextEventId !== null) {
          const latestEvent = await getAdminEvent(nextEventId);
          setEventForm(toEventForm(latestEvent));
        }

        showSuccess('행사가 성공적으로 생성되었습니다.');
      } else if (selectedEventId !== null) {
        const updatedEvent = await updateAdminEvent(selectedEventId, request);
        await refreshEvents(selectedEventId);

        if (updatedEvent) {
          setEventForm(toEventForm(updatedEvent));
        } else {
          const latestEvent = await getAdminEvent(selectedEventId);
          setEventForm(toEventForm(latestEvent));
        }

        showSuccess('행사 설정이 성공적으로 저장되었습니다.');
      }
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, '행사 설정을 저장하지 못했습니다.'));
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleEventDelete = async () => {
    if (selectedEventId === null || isDeletingEvent) {
      return;
    }

    const selectedEvent = events.find(
      (event) => event.eventId === selectedEventId,
    );
    const confirmed = window.confirm(
      `“${selectedEvent?.title ?? '선택한 행사'}”를 삭제하시겠습니까? 삭제한 행사는 복구할 수 없습니다.`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingEvent(true);
    clearFeedback();

    try {
      await deleteAdminEvent(selectedEventId);
      await refreshEvents();
      setCourseForms([]);
      showSuccess('행사가 삭제되었습니다.');
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, '행사를 삭제하지 못했습니다.'));
    } finally {
      setIsDeletingEvent(false);
    }
  };

  const updateCourseForm = (
    courseId: number,
    field: keyof CourseForm,
    value: string,
  ) => {
    clearFeedback();
    setCourseForms((current) =>
      current.map((course) =>
        course.courseId === courseId
          ? { ...course, form: { ...course.form, [field]: value } }
          : course,
      ),
    );
  };

  const handleExistingCourseSubmit = async (
    submitEvent: FormEvent<HTMLFormElement>,
    courseId: number,
  ) => {
    submitEvent.preventDefault();

    if (selectedEventId === null || savingCourseId !== null) {
      return;
    }

    const course = courseForms.find((item) => item.courseId === courseId);

    if (!course) {
      return;
    }

    const validationMessage = validateCourseForm(course.form);

    if (validationMessage) {
      showError(validationMessage);
      return;
    }

    setSavingCourseId(courseId);
    clearFeedback();

    try {
      await updateAdminCourse(courseId, toCourseRequest(course.form));
      await refreshCourses(selectedEventId);
      showSuccess('코스 설정이 저장되었습니다.');
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, '코스 설정을 저장하지 못했습니다.'));
    } finally {
      setSavingCourseId(null);
    }
  };

  const handleNewCourseSubmit = async (
    submitEvent: FormEvent<HTMLFormElement>,
  ) => {
    submitEvent.preventDefault();

    if (selectedEventId === null || savingCourseId !== null) {
      return;
    }

    const validationMessage = validateCourseForm(newCourseForm);

    if (validationMessage) {
      showError(validationMessage);
      return;
    }

    setSavingCourseId('new');
    clearFeedback();

    try {
      await createAdminCourse(selectedEventId, toCourseRequest(newCourseForm));
      await refreshCourses(selectedEventId);
      setNewCourseForm(EMPTY_COURSE_FORM);
      setIsAddingCourse(false);
      showSuccess('코스가 생성되었습니다.');
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, '코스를 생성하지 못했습니다.'));
    } finally {
      setSavingCourseId(null);
    }
  };

  const handleCourseDelete = async (courseId: number, courseName: string) => {
    if (selectedEventId === null || deletingCourseId !== null) {
      return;
    }

    if (
      !window.confirm(
        `“${courseName}” 코스를 삭제하시겠습니까? 삭제한 코스는 복구할 수 없습니다.`,
      )
    ) {
      return;
    }

    setDeletingCourseId(courseId);
    clearFeedback();

    try {
      await deleteAdminCourse(courseId);
      await refreshCourses(selectedEventId);
      showSuccess('코스가 삭제되었습니다.');
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, '코스를 삭제하지 못했습니다.'));
    } finally {
      setDeletingCourseId(null);
    }
  };

  const renderCourseFields = (
    form: CourseForm,
    updateField: (field: keyof CourseForm, value: string) => void,
  ) => (
    <div className="admin-event-settings__course-fields">
      <label className="admin-event-settings__course-name">
        <span>코스명</span>
        <input
          type="text"
          required
          value={form.name}
          onChange={(event) => updateField('name', event.target.value)}
        />
      </label>

      <label>
        <span>목표 거리</span>
        <div className="admin-event-settings__number-control">
          <input
            type="number"
            min="1"
            step="1"
            required
            value={form.targetDistanceMeter}
            onChange={(event) =>
              updateField('targetDistanceMeter', event.target.value)
            }
          />
          <span>m</span>
        </div>
      </label>

      <label>
        <span>기준 도서 수</span>
        <div className="admin-event-settings__number-control">
          <input
            type="number"
            min="1"
            step="1"
            required
            value={form.standardBookCount}
            onChange={(event) =>
              updateField('standardBookCount', event.target.value)
            }
          />
          <span>권</span>
        </div>
      </label>

      <label>
        <span>월평균 독서량</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.avgMonthlyReadingCount}
          onChange={(event) =>
            updateField('avgMonthlyReadingCount', event.target.value)
          }
        />
      </label>

      <label>
        <span>최대 수상자</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.maxWinners}
          onChange={(event) =>
            updateField('maxWinners', event.target.value)
          }
        />
      </label>

      <label>
        <span>추가 대출 권수</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.extraLoanCount}
          onChange={(event) =>
            updateField('extraLoanCount', event.target.value)
          }
        />
      </label>

      <label>
        <span>보상 유형</span>
        <input
          type="text"
          value={form.rewardType}
          placeholder="서버 rewardType 값"
          onChange={(event) => updateField('rewardType', event.target.value)}
        />
      </label>

      <label>
        <span>보상 금액</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.rewardAmount}
          onChange={(event) =>
            updateField('rewardAmount', event.target.value)
          }
        />
      </label>

      <label>
        <span>표시 순서</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.displayOrder}
          onChange={(event) =>
            updateField('displayOrder', event.target.value)
          }
        />
      </label>
    </div>
  );

  return (
    <section className="admin-page admin-event-settings">
      <header className="admin-page__header admin-event-settings__header">
        <div>
          <h1>행사/코스 설정</h1>
          <p>행사 기간, 신청 기간, 코스 기준, 보상 기준을 설정합니다.</p>
        </div>

        <div className="admin-event-settings__countdown" aria-live="polite">
          <span>행사 시작까지</span>
          <strong>{eventCountdown}</strong>
          <small>{formatDateLabel(eventForm.eventStartDate)}</small>
        </div>
      </header>

      <section
        className="admin-event-settings__panel admin-event-settings__selector"
        aria-labelledby="eventSelectionTitle"
      >
        <div>
          <h2 id="eventSelectionTitle">관리 행사 선택</h2>
          <p>관리자 행사 목록에서 수정할 행사를 선택합니다.</p>
        </div>

        <div className="admin-event-settings__selector-controls">
          <select
            aria-label="관리할 행사"
            value={selectedEventId ?? ''}
            disabled={isEventsLoading || isCreatingEvent || events.length === 0}
            onChange={(event) => handleEventSelection(event.target.value)}
          >
            {events.length === 0 && <option value="">등록된 행사 없음</option>}
            {events.map((event) => (
              <option key={event.eventId} value={event.eventId}>
                {event.roundNo}회 · {event.title} · {EVENT_STATUS_LABELS[event.status]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="admin-event-settings__secondary-button"
            disabled={isSavingEvent || isDeletingEvent}
            onClick={handleCreateEventStart}
          >
            새 행사
          </button>
        </div>
      </section>

      {pageError && (
        <p className="admin-event-settings__load-error" role="alert">
          {pageError}
        </p>
      )}

      {isEventsLoading ? (
        <div className="admin-event-settings__empty" role="status">
          행사 목록을 불러오는 중입니다.
        </div>
      ) : events.length === 0 && !isCreatingEvent ? (
        <div className="admin-event-settings__empty">
          <p>등록된 행사가 없습니다.</p>
          <button
            type="button"
            className="admin-event-settings__secondary-button"
            onClick={handleCreateEventStart}
          >
            첫 행사 만들기
          </button>
        </div>
      ) : (
        <form
          className="admin-event-settings__form"
          noValidate
          onSubmit={handleEventSubmit}
        >
          <section
            className="admin-event-settings__panel"
            aria-labelledby="eventBasicTitle"
          >
            <div className="admin-event-settings__section-heading">
              <div>
                <h2 id="eventBasicTitle">
                  {isCreatingEvent ? '새 행사 정보' : '행사 기본 정보'}
                </h2>
                <p>행사명, 회차, 운영 상태와 공개 여부를 설정합니다.</p>
              </div>
              <span>필수</span>
            </div>

            <fieldset
              className="admin-event-settings__basic-grid"
              disabled={isEventDetailLoading}
            >
              <label className="admin-event-settings__wide-field">
                <span>행사명</span>
                <input
                  type="text"
                  required
                  value={eventForm.title}
                  onChange={(event) =>
                    handleEventFieldChange('title', event.target.value)
                  }
                />
              </label>

              <label>
                <span>회차</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={eventForm.roundNo}
                  onChange={(event) =>
                    handleEventFieldChange('roundNo', event.target.value)
                  }
                />
              </label>

              <label>
                <span>운영 상태</span>
                <select
                  value={eventForm.status}
                  onChange={(event) =>
                    handleEventFieldChange(
                      'status',
                      event.target.value as EventStatus,
                    )
                  }
                >
                  {EVENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {EVENT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-event-settings__visibility-field">
                <input
                  type="checkbox"
                  checked={eventForm.publicVisible}
                  onChange={(event) =>
                    handleEventFieldChange('publicVisible', event.target.checked)
                  }
                />
                <span>사용자 화면에 공개</span>
              </label>
            </fieldset>
          </section>

          <section
            className="admin-event-settings__panel"
            aria-labelledby="eventPeriodTitle"
          >
            <div className="admin-event-settings__section-heading">
              <div>
                <h2 id="eventPeriodTitle">기간 설정</h2>
                <p>행사 운영 기간과 참가 신청을 받는 기간을 입력합니다.</p>
              </div>
              <span>필수</span>
            </div>

            <div className="admin-event-settings__period-grid">
              <fieldset className="admin-event-settings__period-group">
                <legend>행사 기간</legend>
                <div className="admin-event-settings__date-range">
                  <label>
                    <span>행사 시작일</span>
                    <input
                      type="date"
                      required
                      value={eventForm.eventStartDate}
                      onChange={(event) =>
                        handleEventFieldChange(
                          'eventStartDate',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <span className="admin-event-settings__range-mark">~</span>
                  <label>
                    <span>행사 종료일</span>
                    <input
                      type="date"
                      required
                      value={eventForm.eventEndDate}
                      onChange={(event) =>
                        handleEventFieldChange('eventEndDate', event.target.value)
                      }
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="admin-event-settings__period-group">
                <legend>신청 기간</legend>
                <div className="admin-event-settings__date-range">
                  <label>
                    <span>신청 시작일</span>
                    <input
                      type="date"
                      required
                      value={eventForm.applicationStartDate}
                      onChange={(event) =>
                        handleEventFieldChange(
                          'applicationStartDate',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <span className="admin-event-settings__range-mark">~</span>
                  <label>
                    <span>신청 종료일</span>
                    <input
                      type="date"
                      required
                      value={eventForm.applicationEndDate}
                      onChange={(event) =>
                        handleEventFieldChange(
                          'applicationEndDate',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              </fieldset>
            </div>
          </section>

          <section
            className="admin-event-settings__panel"
            aria-labelledby="eventContactTitle"
          >
            <div className="admin-event-settings__section-heading">
              <div>
                <h2 id="eventContactTitle">행사 안내</h2>
                <p>행사 설명과 문의 채널을 설정합니다.</p>
              </div>
              <span className="admin-event-settings__optional">선택</span>
            </div>

            <div className="admin-event-settings__contact-grid">
              <label>
                <span>문의 전화</span>
                <input
                  type="tel"
                  value={eventForm.contactPhone}
                  onChange={(event) =>
                    handleEventFieldChange('contactPhone', event.target.value)
                  }
                />
              </label>
              <label>
                <span>문의 이메일</span>
                <input
                  type="email"
                  value={eventForm.contactEmail}
                  onChange={(event) =>
                    handleEventFieldChange('contactEmail', event.target.value)
                  }
                />
              </label>
              <label className="admin-event-settings__wide-field">
                <span>카카오 오픈채팅 URL</span>
                <input
                  type="url"
                  value={eventForm.kakaoOpenChatUrl}
                  onChange={(event) =>
                    handleEventFieldChange(
                      'kakaoOpenChatUrl',
                      event.target.value,
                    )
                  }
                />
              </label>
              <label className="admin-event-settings__wide-field">
                <span>행사 설명</span>
                <textarea
                  rows={4}
                  value={eventForm.description}
                  onChange={(event) =>
                    handleEventFieldChange('description', event.target.value)
                  }
                />
              </label>
            </div>
          </section>

          <div className="admin-event-settings__form-footer">
            <div className="admin-event-settings__event-actions">
              {!isCreatingEvent && selectedEventId !== null && (
                <button
                  type="button"
                  className="admin-event-settings__danger-button"
                  disabled={isDeletingEvent || isSavingEvent}
                  onClick={handleEventDelete}
                >
                  {isDeletingEvent ? '삭제 중…' : '행사 삭제'}
                </button>
              )}
              {isCreatingEvent && events.length > 0 && (
                <button
                  type="button"
                  className="admin-event-settings__secondary-button"
                  disabled={isSavingEvent}
                  onClick={handleCreateEventCancel}
                >
                  취소
                </button>
              )}
            </div>

            <button
              type="submit"
              className="admin-event-settings__save-button"
              disabled={isSavingEvent || isEventDetailLoading}
            >
              {isSavingEvent
                ? '저장 중…'
                : isCreatingEvent
                  ? '행사 생성'
                  : '행사 설정 저장'}
            </button>
          </div>
        </form>
      )}

      {!isCreatingEvent && selectedEventId !== null && (
        <section
          className="admin-event-settings__panel admin-event-settings__courses-panel"
          aria-labelledby="courseStandardsTitle"
        >
          <div className="admin-event-settings__section-heading">
            <div>
              <h2 id="courseStandardsTitle">코스 기준·보상 설정</h2>
              <p>선택한 행사의 코스 기준과 보상 정보를 설정합니다.</p>
            </div>
            <button
              type="button"
              className="admin-event-settings__secondary-button"
              disabled={isCoursesLoading || savingCourseId !== null}
              onClick={() => {
                clearFeedback();
                setNewCourseForm(EMPTY_COURSE_FORM);
                setIsAddingCourse(true);
              }}
            >
              코스 추가
            </button>
          </div>

          {courseError && (
            <p className="admin-event-settings__load-error" role="alert">
              {courseError}
            </p>
          )}

          {isCoursesLoading ? (
            <div className="admin-event-settings__empty" role="status">
              코스 목록을 불러오는 중입니다.
            </div>
          ) : (
            <div className="admin-event-settings__course-grid">
              {courseForms.map(({ courseId, form }) => (
                <form
                  key={courseId}
                  className="admin-event-settings__course-card"
                  onSubmit={(event) =>
                    handleExistingCourseSubmit(event, courseId)
                  }
                >
                  {renderCourseFields(form, (field, value) =>
                    updateCourseForm(courseId, field, value),
                  )}
                  <div className="admin-event-settings__course-actions">
                    <button
                      type="button"
                      className="admin-event-settings__danger-button"
                      disabled={
                        deletingCourseId !== null || savingCourseId !== null
                      }
                      onClick={() => handleCourseDelete(courseId, form.name)}
                    >
                      {deletingCourseId === courseId ? '삭제 중…' : '삭제'}
                    </button>
                    <button
                      type="submit"
                      className="admin-event-settings__save-button"
                      disabled={
                        deletingCourseId !== null || savingCourseId !== null
                      }
                    >
                      {savingCourseId === courseId ? '저장 중…' : '코스 저장'}
                    </button>
                  </div>
                </form>
              ))}

              {isAddingCourse && (
                <form
                  className="admin-event-settings__course-card admin-event-settings__course-card--new"
                  onSubmit={handleNewCourseSubmit}
                >
                  {renderCourseFields(newCourseForm, (field, value) => {
                    clearFeedback();
                    setNewCourseForm((current) => ({
                      ...current,
                      [field]: value,
                    }));
                  })}
                  <div className="admin-event-settings__course-actions">
                    <button
                      type="button"
                      className="admin-event-settings__secondary-button"
                      disabled={savingCourseId !== null}
                      onClick={() => setIsAddingCourse(false)}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="admin-event-settings__save-button"
                      disabled={savingCourseId !== null}
                    >
                      {savingCourseId === 'new' ? '생성 중…' : '코스 생성'}
                    </button>
                  </div>
                </form>
              )}

              {courseForms.length === 0 && !isAddingCourse && (
                <div className="admin-event-settings__empty">
                  등록된 코스가 없습니다.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <p
        className={[
          'admin-event-settings__feedback',
          feedbackIsError ? 'admin-event-settings__feedback--error' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role={feedbackIsError ? 'alert' : 'status'}
        aria-live="polite"
      >
        {feedbackMessage}
      </p>
    </section>
  );
}

export default AdminEventSettingsPage;
