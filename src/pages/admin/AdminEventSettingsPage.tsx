import {
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
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
import { ApiError, getApiErrorMessage } from '../../api/apiClient';
import CourseFormFields from '../../components/admin/eventSettings/CourseFormFields';
import {
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  type AdminCourse,
  type AdminEvent,
  type EventStatus,
} from '../../types/adminEvent';
import { chooseEventIdByStatus, findPreviousEvent } from '../../utils/adminEvent';
import {
  COURSE_PRESETS,
  EMPTY_COURSE_FORM,
  EMPTY_EVENT_FORM,
  getEventCountdown,
  formatDateLabel,
  formatShortDateRange,
  toCourseForm,
  toCourseRequest,
  toEventForm,
  toEventRequest,
  validateCourseForm,
  validateEventForm,
  type CourseForm,
  type CoursePresetKey,
  type EventForm,
} from '../../utils/adminEventForms';
import '../../styles/admin-event-settings.css';

const DEFAULT_EVENT_SELECTION_ORDER: EventStatus[] = ['APPLICATION_OPEN', 'READY', 'DRAFT'];

type CourseFormEntry = { courseId: number; form: CourseForm };

function chooseEventId(events: AdminEvent[], preferredEventId?: number) {
  if (preferredEventId && events.some((event) => event.eventId === preferredEventId)) {
    return preferredEventId;
  }

  return chooseEventIdByStatus(events, DEFAULT_EVENT_SELECTION_ORDER);
}

function toCourseFormEntries(courses: AdminCourse[]): CourseFormEntry[] {
  return courses.map((course) => ({
    courseId: course.courseId,
    form: toCourseForm(course),
  }));
}

/**
 * 수정 모드에서 코스를 추가·삭제한 뒤 목록을 다시 불러올 때, 아직 저장하지 않은 다른 코스의
 * 편집값과 순서를 유지합니다. 서버에서 사라진 코스는 빼고, 새로 생긴 코스는 뒤에 붙입니다.
 */
function mergeLocalCourseEdits(
  localForms: CourseFormEntry[],
  serverForms: CourseFormEntry[],
): CourseFormEntry[] {
  const serverCourseIds = new Set(serverForms.map((course) => course.courseId));
  const localCourseIds = new Set(localForms.map((course) => course.courseId));

  return [
    ...localForms.filter((course) => serverCourseIds.has(course.courseId)),
    ...serverForms.filter((course) => !localCourseIds.has(course.courseId)),
  ];
}

function AdminEventSettingsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [eventForm, setEventForm] = useState<EventForm>(EMPTY_EVENT_FORM);
  const [courseForms, setCourseForms] = useState<CourseFormEntry[]>([]);
  const [newCourseForm, setNewCourseForm] = useState<CourseForm>(EMPTY_COURSE_FORM);
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isEventDetailLoading, setIsEventDetailLoading] = useState(false);
  const [isCoursesLoading, setIsCoursesLoading] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState<number | null>(null);
  const [pageError, setPageError] = useState('');
  const [courseError, setCourseError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);

  // 조회 모드(기본) / 수정 모드 전환. 운영에 영향이 큰 행사·코스 값을 곧바로 고칠 수 없도록
  // "설정 수정"을 눌러야 행사 필드와 코스 표가 함께 입력 가능해지고, 저장 시 한 번 더 확인을 받습니다.
  const [isEditMode, setIsEditMode] = useState(false);
  const [eventFormSnapshot, setEventFormSnapshot] = useState<EventForm | null>(null);
  const [savedCourseForms, setSavedCourseForms] = useState<CourseFormEntry[]>([]);
  const [draggedCourseId, setDraggedCourseId] = useState<number | null>(null);

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

  const previousEvent = useMemo(() => {
    const currentRoundNo = isCreatingEvent
      ? null
      : (() => {
          const roundNo = Number(eventForm.roundNo);
          return Number.isFinite(roundNo) ? roundNo : null;
        })();

    return findPreviousEvent(events, isCreatingEvent ? null : selectedEventId, currentRoundNo);
  }, [events, isCreatingEvent, selectedEventId, eventForm.roundNo]);

  const previousApplicationRange = previousEvent
    ? formatShortDateRange(previousEvent.applicationStartDate, previousEvent.applicationEndDate)
    : '';
  const previousEventRange = previousEvent
    ? formatShortDateRange(previousEvent.eventStartDate, previousEvent.eventEndDate)
    : '';

  // 기존 행사를 보는 중에는 "설정 수정"을 눌러야 입력이 열립니다. 새 행사 작성 중에는
  // 아직 저장된 값이 없으므로 곧바로 입력할 수 있습니다.
  const fieldsLocked = !isCreatingEvent && !isEditMode;
  const coursesLocked = !isCreatingEvent && !isEditMode;
  const isCoursesDirty = JSON.stringify(courseForms) !== JSON.stringify(savedCourseForms);

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
    setIsEditMode(false);

    if (nextEventId === null) {
      setIsEventDetailLoading(false);
      setIsCoursesLoading(false);
      setEventForm(EMPTY_EVENT_FORM);
      setCourseForms([]);
      setSavedCourseForms([]);
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

  const refreshCourses = async (eventId: number, keepLocalEdits = false) => {
    setIsCoursesLoading(true);

    try {
      const courses = await getAdminEventCourses(eventId);
      const nextCourseForms = toCourseFormEntries(courses);

      setCourseForms((current) =>
        keepLocalEdits ? mergeLocalCourseEdits(current, nextCourseForms) : nextCourseForms,
      );
      setSavedCourseForms(nextCourseForms);
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

        setPageError(getApiErrorMessage(error, '행사 목록을 불러오지 못했습니다.'));
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

    if (detailRequestRef.current === null || detailRequestRef.current.eventId !== eventId) {
      detailRequestRef.current = {
        eventId,
        promise: getAdminEvent(eventId),
      };
    }

    if (coursesRequestRef.current === null || coursesRequestRef.current.eventId !== eventId) {
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
          setPageError(getApiErrorMessage(error, '행사 상세를 불러오지 못했습니다.'));
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
          const nextCourseForms = toCourseFormEntries(courses);

          setCourseForms(nextCourseForms);
          setSavedCourseForms(nextCourseForms);
          setCourseError('');
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setCourseError(getApiErrorMessage(error, '코스 목록을 불러오지 못했습니다.'));
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
    setIsEditMode(false);
  };

  const handleCreateEventStart = () => {
    clearFeedback();
    setPageError('');
    setCourseError('');
    setSelectedEventId(null);
    setIsCreatingEvent(true);
    setIsEditMode(false);
    setIsEventDetailLoading(false);
    setIsCoursesLoading(false);
    setEventForm(EMPTY_EVENT_FORM);
    setCourseForms([]);
    setSavedCourseForms([]);
    setIsAddingCourse(false);
  };

  const handleCreateEventCancel = () => {
    clearFeedback();
    applyEvents(events);
  };

  const handleEnterEditMode = () => {
    clearFeedback();
    setEventFormSnapshot(eventForm);
    setIsEditMode(true);
  };

  const handleCancelEditMode = () => {
    clearFeedback();
    setIsAddingCourse(false);

    if (eventFormSnapshot) {
      setEventForm(eventFormSnapshot);
    }

    // 코스 필드·순서 변경은 "변경사항 저장" 전까지 로컬 상태로만 남아 있으므로,
    // 마지막으로 서버에서 불러온 스냅샷으로 되돌리기만 하면 됩니다(재요청 불필요).
    setCourseForms(savedCourseForms);

    setIsEditMode(false);
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

    if (!isCreatingEvent) {
      // 코스 필드/순서 변경도 이 저장 한 번에 함께 반영되므로, 코스 쪽 검증도 먼저 확인합니다.
      for (const course of courseForms) {
        const courseValidationMessage = validateCourseForm(course.form);

        if (courseValidationMessage) {
          showError(`"${course.form.name || '코스'}" - ${courseValidationMessage}`);
          return;
        }
      }
    }

    if (!isCreatingEvent) {
      const confirmed = window.confirm(
        `“${eventForm.title || '선택한 행사'}” 행사 설정을 변경하시겠습니까?`,
      );

      if (!confirmed) {
        return;
      }
    }

    setIsSavingEvent(true);
    clearFeedback();

    try {
      const request = toEventRequest(eventForm);

      if (isCreatingEvent) {
        const createdEvent = await createAdminEvent(request);

        if (!createdEvent) {
          throw new ApiError('생성된 행사 정보를 확인할 수 없습니다.', 200);
        }

        try {
          await Promise.all(
            (Object.keys(COURSE_PRESETS) as CoursePresetKey[]).map((presetKey) =>
              createAdminCourse(createdEvent.eventId, toCourseRequest(COURSE_PRESETS[presetKey])),
            ),
          );
        } catch (courseCreationError: unknown) {
          const nextEventId = await refreshEvents(createdEvent.eventId);

          if (nextEventId !== null) {
            await refreshCourses(nextEventId);
          }

          showError(
            getApiErrorMessage(
              courseCreationError,
              '행사는 생성되었지만 기본 코스 일부를 만들지 못했습니다. 생성된 코스를 확인해 주세요.',
            ),
          );
          return;
        }

        const nextEventId = await refreshEvents(createdEvent.eventId);

        if (nextEventId !== null) {
          const latestEvent = await getAdminEvent(nextEventId);
          setEventForm(toEventForm(latestEvent));
        }

        showSuccess('행사와 기본 코스 3개가 성공적으로 생성되었습니다.');
      } else if (selectedEventId !== null) {
        const updatedEvent = await updateAdminEvent(selectedEventId, request);
        await refreshEvents(selectedEventId);

        if (updatedEvent) {
          setEventForm(toEventForm(updatedEvent));
        } else {
          const latestEvent = await getAdminEvent(selectedEventId);
          setEventForm(toEventForm(latestEvent));
        }

        if (isCoursesDirty) {
          try {
            await Promise.all(
              courseForms.map((course) =>
                updateAdminCourse(course.courseId, toCourseRequest(course.form)),
              ),
            );
            await refreshCourses(selectedEventId);
            showSuccess('행사 설정과 코스 내용이 모두 저장되었습니다.');
          } catch (courseSaveError: unknown) {
            showError(
              getApiErrorMessage(
                courseSaveError,
                '행사 설정은 저장되었지만 코스 내용 저장에는 실패했습니다. 다시 시도해 주세요.',
              ),
            );
            return;
          }
        } else {
          showSuccess('행사 설정이 성공적으로 저장되었습니다.');
        }

        setIsAddingCourse(false);
        setIsEditMode(false);
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

    const selectedEvent = events.find((event) => event.eventId === selectedEventId);
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

  const updateCourseForm = (courseId: number, field: keyof CourseForm, value: string) => {
    clearFeedback();
    setCourseForms((current) =>
      current.map((course) =>
        course.courseId === courseId
          ? { ...course, form: { ...course.form, [field]: value } }
          : course,
      ),
    );
  };

  const handleCreateCourse = async () => {
    if (selectedEventId === null || isCreatingCourse) {
      return;
    }

    const validationMessage = validateCourseForm(newCourseForm);

    if (validationMessage) {
      showError(validationMessage);
      return;
    }

    setIsCreatingCourse(true);
    clearFeedback();

    try {
      await createAdminCourse(selectedEventId, toCourseRequest(newCourseForm));
      await refreshCourses(selectedEventId, true);
      setNewCourseForm({ ...EMPTY_COURSE_FORM, displayOrder: String(courseForms.length + 1) });
      setIsAddingCourse(false);
      showSuccess('코스가 생성되었습니다.');
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, '코스를 생성하지 못했습니다.'));
    } finally {
      setIsCreatingCourse(false);
    }
  };

  // 새 코스 입력 행은 행사 설정 <form> 안에 있어, input에서 Enter를 누르면 행사 전체 저장이
  // 암묵적으로 submit됩니다. 새 코스는 "코스 생성" 버튼으로만 만들도록 input의 Enter submit을 막습니다.
  const handleNewCourseRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
    }
  };

  const handleCourseDelete = async (courseId: number, courseName: string) => {
    if (selectedEventId === null || deletingCourseId !== null) {
      return;
    }

    if (
      !window.confirm(`“${courseName}” 코스를 삭제하시겠습니까? 삭제한 코스는 복구할 수 없습니다.`)
    ) {
      return;
    }

    setDeletingCourseId(courseId);
    clearFeedback();

    try {
      await deleteAdminCourse(courseId);
      await refreshCourses(selectedEventId, true);
      showSuccess('코스가 삭제되었습니다.');
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, '코스를 삭제하지 못했습니다.'));
    } finally {
      setDeletingCourseId(null);
    }
  };

  // 코스 표시 순서 drag: 로컬 상태만 바꾸고, "변경사항 저장"을 눌러야 서버에 반영됩니다.
  const moveCourse = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= courseForms.length || fromIndex === toIndex) {
      return;
    }

    clearFeedback();
    setCourseForms((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      return next.map((course, index) => ({
        ...course,
        form: { ...course.form, displayOrder: String(index + 1) },
      }));
    });
  };

  const handleCourseDragStart = (courseId: number) => (event: DragEvent<HTMLButtonElement>) => {
    setDraggedCourseId(courseId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleCourseDragEnd = () => {
    setDraggedCourseId(null);
  };

  // 드래그 중인 행의 위/아래 절반 중 포인터가 어디 있는지로 삽입 위치를 계산합니다.
  // 이렇게 하면 대상 행 위로 올라올 때마다 곧바로 자리를 맞바꾸며 흔들리는 대신,
  // 포인터가 실제로 넘어간 지점에서만 한 번 이동합니다.
  const handleCourseRowDragOver =
    (targetCourseId: number) => (event: DragEvent<HTMLTableRowElement>) => {
      if (draggedCourseId === null || draggedCourseId === targetCourseId) {
        return;
      }

      event.preventDefault();

      const fromIndex = courseForms.findIndex((course) => course.courseId === draggedCourseId);
      const targetIndex = courseForms.findIndex((course) => course.courseId === targetCourseId);

      if (fromIndex === -1 || targetIndex === -1) {
        return;
      }

      const rowRect = event.currentTarget.getBoundingClientRect();
      const isPointerAfterMidpoint = event.clientY - rowRect.top > rowRect.height / 2;

      let toIndex = targetIndex;

      if (isPointerAfterMidpoint && toIndex < fromIndex) {
        toIndex += 1;
      } else if (!isPointerAfterMidpoint && toIndex > fromIndex) {
        toIndex -= 1;
      }

      if (toIndex === fromIndex) {
        return;
      }

      moveCourse(fromIndex, toIndex);
    };

  const handleCourseRowDrop = (event: DragEvent<HTMLTableRowElement>) => {
    event.preventDefault();
    setDraggedCourseId(null);
  };

  const editingEvent = events.find((event) => event.eventId === selectedEventId) ?? null;

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

      {(editingEvent || isCreatingEvent) && (
        <div
          className={`admin-event-settings__editing-context ${isCreatingEvent ? 'is-new' : ''}`}
          aria-live="polite"
        >
          <div className="admin-event-settings__editing-context-info">
            <span>
              {isCreatingEvent ? '새 행사 작성 중' : fieldsLocked ? '조회 모드' : '수정 모드'}
            </span>
            <strong>
              {isCreatingEvent
                ? '아직 저장되지 않은 새 행사'
                : `${editingEvent?.roundNo}회 · ${editingEvent?.title}`}
            </strong>
            <small>
              {isCreatingEvent
                ? '저장하기 전까지 기존 행사에는 영향을 주지 않습니다.'
                : fieldsLocked
                  ? '내용을 안전하게 확인하는 중입니다. 값을 바꾸려면 "설정 수정"을 눌러주세요.'
                  : `${EVENT_STATUS_LABELS[editingEvent!.status]} · 행사와 아래 코스는 모두 이 행사에만 적용됩니다.`}
            </small>
          </div>

          {!isCreatingEvent && fieldsLocked && (
            <button
              type="button"
              className="admin-event-settings__save-button admin-event-settings__edit-entry-button"
              disabled={isEventDetailLoading || selectedEventId === null}
              onClick={handleEnterEditMode}
            >
              설정 수정
            </button>
          )}
        </div>
      )}

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
        <form className="admin-event-settings__form" noValidate onSubmit={handleEventSubmit}>
          <section className="admin-event-settings__panel" aria-labelledby="eventBasicTitle">
            <div className="admin-event-settings__section-heading">
              <div>
                <h2 id="eventBasicTitle">{isCreatingEvent ? '새 행사 정보' : '행사 기본 정보'}</h2>
                <p>행사명, 회차, 운영 상태와 공개 여부를 설정합니다.</p>
              </div>
              <span>필수</span>
            </div>

            <fieldset
              className="admin-event-settings__basic-grid"
              disabled={isEventDetailLoading || fieldsLocked}
            >
              <label className="admin-event-settings__wide-field admin-event-settings__title-field">
                <span>행사명</span>
                <input
                  type="text"
                  required
                  placeholder="예: 제7회 독서마라톤"
                  value={eventForm.title}
                  onChange={(event) => handleEventFieldChange('title', event.target.value)}
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
                  onChange={(event) => handleEventFieldChange('roundNo', event.target.value)}
                />
              </label>

              <label>
                <span>운영 상태</span>
                <select
                  value={eventForm.status}
                  onChange={(event) =>
                    handleEventFieldChange('status', event.target.value as EventStatus)
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

          <section className="admin-event-settings__panel" aria-labelledby="eventPeriodTitle">
            <div className="admin-event-settings__section-heading">
              <div>
                <h2 id="eventPeriodTitle">기간 설정</h2>
                <p>행사 운영 기간(독서일지 접수기간)과 참가 신청을 받는 기간을 입력합니다.</p>
              </div>
              <span>필수</span>
            </div>

            <div className="admin-event-settings__period-grid">
              <fieldset
                className="admin-event-settings__period-group"
                disabled={isEventDetailLoading || fieldsLocked}
              >
                <legend>행사 기간 (독서일지 접수기간)</legend>
                <div className="admin-event-settings__date-range">
                  <label>
                    <span>행사 시작일</span>
                    <input
                      type="date"
                      required
                      value={eventForm.eventStartDate}
                      onChange={(event) =>
                        handleEventFieldChange('eventStartDate', event.target.value)
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
                {previousEventRange && (
                  <p className="admin-event-settings__period-hint">
                    이전 행사: {previousEventRange}
                  </p>
                )}
              </fieldset>

              <fieldset
                className="admin-event-settings__period-group"
                disabled={isEventDetailLoading || fieldsLocked}
              >
                <legend>신청 기간</legend>
                <div className="admin-event-settings__date-range">
                  <label>
                    <span>신청 시작일</span>
                    <input
                      type="date"
                      required
                      value={eventForm.applicationStartDate}
                      onChange={(event) =>
                        handleEventFieldChange('applicationStartDate', event.target.value)
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
                        handleEventFieldChange('applicationEndDate', event.target.value)
                      }
                    />
                  </label>
                </div>
                {previousApplicationRange && (
                  <p className="admin-event-settings__period-hint">
                    이전 행사: {previousApplicationRange}
                  </p>
                )}
              </fieldset>
            </div>
          </section>

          <section className="admin-event-settings__panel" aria-labelledby="eventContactTitle">
            <div className="admin-event-settings__section-heading">
              <div>
                <h2 id="eventContactTitle">행사 안내</h2>
                <p>행사 설명과 문의 채널을 설정합니다.</p>
              </div>
              <span className="admin-event-settings__optional">선택</span>
            </div>

            <fieldset
              className="admin-event-settings__contact-grid"
              disabled={isEventDetailLoading || fieldsLocked}
            >
              <label>
                <span>문의 전화</span>
                <input
                  type="tel"
                  placeholder="예: 02-2173-2969"
                  value={eventForm.contactPhone}
                  onChange={(event) => handleEventFieldChange('contactPhone', event.target.value)}
                />
              </label>
              <label>
                <span>문의 이메일</span>
                <input
                  type="email"
                  placeholder="예: library@hufs.ac.kr"
                  value={eventForm.contactEmail}
                  onChange={(event) => handleEventFieldChange('contactEmail', event.target.value)}
                />
              </label>
              <label className="admin-event-settings__wide-field">
                <span>카카오 오픈채팅 URL</span>
                <input
                  type="url"
                  placeholder="예: https://open.kakao.com/o/..."
                  value={eventForm.kakaoOpenChatUrl}
                  onChange={(event) =>
                    handleEventFieldChange('kakaoOpenChatUrl', event.target.value)
                  }
                />
              </label>
              <label className="admin-event-settings__wide-field">
                <span>행사 설명</span>
                <textarea
                  rows={4}
                  placeholder="예: 참가 대상, 완주 기준, 유의사항 등을 안내해 주세요."
                  value={eventForm.description}
                  onChange={(event) => handleEventFieldChange('description', event.target.value)}
                />
              </label>
            </fieldset>
          </section>

          {isCreatingEvent && (
            <div className="admin-event-settings__default-courses-notice">
              <div>
                <span>자동 생성</span>
                <strong>행사를 저장하면 기본 코스 3개를 함께 만듭니다.</strong>
              </div>
              <ul>
                <li>단축 코스 · 10,000m</li>
                <li>하프 코스 · 21,100m</li>
                <li>풀 코스 · 42,195m</li>
              </ul>
              <p>생성 후 각 코스의 거리, 보상, 인원은 코스 설정에서 수정할 수 있습니다.</p>
            </div>
          )}

          {!isCreatingEvent && selectedEventId !== null && (
            <section
              className="admin-event-settings__panel admin-event-settings__courses-panel"
              aria-labelledby="courseStandardsTitle"
            >
              <div className="admin-event-settings__section-heading">
                <div>
                  <h2 id="courseStandardsTitle">{editingEvent?.title} 코스 기준·보상 설정</h2>
                  <p>
                    아래 변경사항은 현재 선택된 {editingEvent?.roundNo}회 행사에만 적용되며, 코스
                    내용과 순서는 "변경사항 저장"을 눌러야 반영됩니다.
                  </p>
                </div>
                {!coursesLocked && (
                  <button
                    type="button"
                    className="admin-event-settings__secondary-button"
                    disabled={isCoursesLoading || isCreatingCourse}
                    onClick={() => {
                      clearFeedback();
                      setNewCourseForm({
                        ...EMPTY_COURSE_FORM,
                        displayOrder: String(courseForms.length + 1),
                      });
                      setIsAddingCourse(true);
                    }}
                  >
                    코스 추가
                  </button>
                )}
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
                <>
                  {isAddingCourse && (
                    <div className="admin-event-settings__preset-bar">
                      <label>
                        <span>코스 기본값으로 시작</span>
                        <select
                          defaultValue="SHORT"
                          onChange={(event) => {
                            clearFeedback();
                            setNewCourseForm({
                              ...COURSE_PRESETS[event.target.value as CoursePresetKey],
                              displayOrder: String(courseForms.length + 1),
                            });
                          }}
                        >
                          <option value="SHORT">단축 코스 · 10,000m</option>
                          <option value="HALF">하프 코스 · 21,100m</option>
                          <option value="FULL">풀 코스 · 42,195m</option>
                        </select>
                      </label>
                      <p>선택한 코스의 거리, 독서량, 보상과 인원 기본값을 자동으로 채웁니다.</p>
                    </div>
                  )}

                  {courseForms.length === 0 && !isAddingCourse ? (
                    <div className="admin-event-settings__empty">등록된 코스가 없습니다.</div>
                  ) : (
                    <div className="admin-event-settings__course-table-wrapper">
                      <table className="admin-event-settings__course-table">
                        <caption className="sr-only">
                          {editingEvent?.title} 코스 기준·보상 목록
                        </caption>
                        <colgroup>
                          <col className="admin-event-settings__col-drag" />
                          <col className="admin-event-settings__col-name" />
                          <col className="admin-event-settings__col-number-wide" />
                          <col className="admin-event-settings__col-number" />
                          <col className="admin-event-settings__col-number" />
                          <col className="admin-event-settings__col-number" />
                          <col className="admin-event-settings__col-number" />
                          <col className="admin-event-settings__col-reward-type" />
                          <col className="admin-event-settings__col-number" />
                          <col className="admin-event-settings__col-actions" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th scope="col" aria-label="순서" />
                            <th scope="col">코스명</th>
                            <th scope="col">목표 거리</th>
                            <th scope="col">기준 도서 수</th>
                            <th scope="col">월평균 독서량</th>
                            <th scope="col">최대 수상자</th>
                            <th scope="col">추가 대출</th>
                            <th scope="col">보상 유형</th>
                            <th scope="col">보상 금액</th>
                            <th scope="col">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courseForms.map(({ courseId, form }) => (
                            <tr
                              key={courseId}
                              className={[
                                draggedCourseId === courseId
                                  ? 'admin-event-settings__course-row--dragging'
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onDragOver={handleCourseRowDragOver(courseId)}
                              onDrop={handleCourseRowDrop}
                            >
                              <td className="admin-event-settings__course-table-drag">
                                {!coursesLocked && (
                                  <button
                                    type="button"
                                    className="admin-event-settings__drag-handle"
                                    aria-label={`${form.name || '코스'} 드래그하여 순서 이동`}
                                    draggable
                                    onDragStart={handleCourseDragStart(courseId)}
                                    onDragEnd={handleCourseDragEnd}
                                  >
                                    ≡
                                  </button>
                                )}
                              </td>

                              <CourseFormFields
                                form={form}
                                disabled={coursesLocked}
                                updateField={(field, value) =>
                                  updateCourseForm(courseId, field, value)
                                }
                              />

                              <td className="admin-event-settings__course-table-actions">
                                {!coursesLocked && (
                                  <button
                                    type="button"
                                    className="admin-event-settings__danger-button"
                                    disabled={deletingCourseId !== null}
                                    onClick={() => handleCourseDelete(courseId, form.name)}
                                  >
                                    {deletingCourseId === courseId ? '삭제 중…' : '삭제'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}

                          {isAddingCourse && (
                            <tr
                              className="admin-event-settings__course-row--new"
                              onKeyDown={handleNewCourseRowKeyDown}
                            >
                              <td className="admin-event-settings__course-table-drag" />

                              <CourseFormFields
                                form={newCourseForm}
                                updateField={(field, value) => {
                                  clearFeedback();
                                  setNewCourseForm((current) => ({
                                    ...current,
                                    [field]: value,
                                  }));
                                }}
                              />

                              <td className="admin-event-settings__course-table-actions">
                                <button
                                  type="button"
                                  className="admin-event-settings__secondary-button"
                                  disabled={isCreatingCourse}
                                  onClick={() => setIsAddingCourse(false)}
                                >
                                  취소
                                </button>
                                <button
                                  type="button"
                                  className="admin-event-settings__save-button"
                                  disabled={isCreatingCourse}
                                  onClick={handleCreateCourse}
                                >
                                  {isCreatingCourse ? '생성 중…' : '코스 생성'}
                                </button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          <div className="admin-event-settings__form-footer">
            <div className="admin-event-settings__event-actions">
              {!isCreatingEvent && selectedEventId !== null && !fieldsLocked && (
                <button
                  type="button"
                  className="admin-event-settings__secondary-button"
                  disabled={isSavingEvent}
                  onClick={handleCancelEditMode}
                >
                  취소
                </button>
              )}
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

            {(isCreatingEvent || !fieldsLocked) && (
              <button
                type="submit"
                className="admin-event-settings__save-button"
                disabled={isSavingEvent || isEventDetailLoading}
              >
                {isSavingEvent ? '저장 중…' : isCreatingEvent ? '행사 생성' : '변경사항 저장'}
              </button>
            )}
          </div>
        </form>
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
