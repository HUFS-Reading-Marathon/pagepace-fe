import { reorderAdminCourses } from "../../api/adminEventApi";
import { preferredAdminEvent } from "../../utils/eventSelection";
import { useAdminEventState } from "../../hooks/useAdminEventState";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
} from "../../api/adminEventApi";
import { ApiError } from "../../api/apiClient";
import {
  EVENT_STATUSES,
  type AdminCourse,
  type AdminEvent,
  type CreateCourseRequest,
  type CreateEventRequest,
  type EventStatus,
} from "../../types/adminEvent";
import "../../styles/admin-event-settings.css";

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

type CourseNumberField = Exclude<keyof CourseForm, "name" | "rewardType">;
type CoursePresetKey = "SHORT" | "HALF" | "FULL";

const REWARD_TYPE_OPTIONS = [
  { value: "GIFT_CARD", label: "문화상품권" },
  { value: "CASH", label: "상금" },
] as const;

const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: "작성 중",
  READY: "준비",
  APPLICATION_OPEN: "신청 접수 중",
  APPLICATION_CLOSED: "신청 마감",
  IN_PROGRESS: "진행 중",
  ENDED: "종료",
  FINALIZED: "최종 확정",
  ARCHIVED: "보관",
};

const DEFAULT_EVENT_SELECTION_ORDER: EventStatus[] = [
  "APPLICATION_OPEN",
  "READY",
  "DRAFT",
];

const EMPTY_EVENT_FORM: EventForm = {
  title: "",
  roundNo: "",
  applicationStartDate: "",
  applicationEndDate: "",
  eventStartDate: "",
  eventEndDate: "",
  status: "DRAFT",
  description: "",
  contactPhone: "",
  contactEmail: "",
  kakaoOpenChatUrl: "",
  publicVisible: false,
};

const COURSE_PRESETS: Record<CoursePresetKey, CourseForm> = {
  SHORT: {
    name: "단축 코스",
    targetDistanceMeter: "10000",
    standardBookCount: "7",
    avgMonthlyReadingCount: "2.3",
    maxWinners: "15",
    extraLoanCount: "2",
    rewardType: "GIFT_CARD",
    rewardAmount: "30000",
    displayOrder: "1",
  },
  HALF: {
    name: "하프 코스",
    targetDistanceMeter: "21100",
    standardBookCount: "14",
    avgMonthlyReadingCount: "4.6",
    maxWinners: "20",
    extraLoanCount: "2",
    rewardType: "GIFT_CARD",
    rewardAmount: "50000",
    displayOrder: "2",
  },
  FULL: {
    name: "풀 코스",
    targetDistanceMeter: "42195",
    standardBookCount: "28",
    avgMonthlyReadingCount: "9.3",
    maxWinners: "3",
    extraLoanCount: "5",
    rewardType: "CASH",
    rewardAmount: "150000",
    displayOrder: "3",
  },
};

const EMPTY_COURSE_FORM: CourseForm = { ...COURSE_PRESETS.SHORT };

const COURSE_NUMBER_FIELDS: CourseNumberField[] = [
  "targetDistanceMeter",
  "standardBookCount",
  "avgMonthlyReadingCount",
  "maxWinners",
  "extraLoanCount",
  "rewardAmount",
  "displayOrder",
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
    description: event.description ?? "",
    contactPhone: event.contactPhone ?? "",
    contactEmail: event.contactEmail ?? "",
    kakaoOpenChatUrl: event.kakaoOpenChatUrl ?? "",
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
    rewardType: course.rewardType ?? "",
    rewardAmount: String(course.rewardAmount),
    displayOrder: String(course.displayOrder),
  };
}

function chooseEventId(events: AdminEvent[], preferredEventId?: number) {
  const remembered = preferredAdminEvent(events);
  if (remembered && !preferredEventId) return remembered.eventId;
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
  const [year, month, day] = value.split("-").map(Number);

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
    return "일정 미설정";
  }

  const todayUtc = getTodayUtcValue();
  const remainingDays = Math.ceil(
    (startUtc - todayUtc) / (24 * 60 * 60 * 1000),
  );

  if (remainingDays > 0) {
    return `D-${remainingDays}`;
  }

  if (remainingDays === 0) {
    return "D-DAY";
  }

  const endUtc = getDateUtcValue(endDate);

  if (endUtc !== null && todayUtc <= endUtc) {
    return "행사 진행 중";
  }

  return endUtc !== null ? "행사 종료" : "시작일 경과";
}

function formatDateLabel(value: string) {
  if (!value) {
    return "접수 시작일을 입력해 주세요.";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function validateEventForm(form: EventForm) {
  if (!form.title.trim()) {
    return "행사명을 입력해 주세요.";
  }

  const roundNo = Number(form.roundNo);

  if (!Number.isInteger(roundNo) || roundNo <= 0) {
    return "회차는 0보다 큰 정수여야 합니다.";
  }

  if (
    !form.applicationStartDate ||
    !form.applicationEndDate ||
    !form.eventStartDate ||
    !form.eventEndDate
  ) {
    return "독서일지 접수기간과 신청 기간의 날짜를 모두 입력해 주세요.";
  }

  if (form.applicationEndDate < form.applicationStartDate) {
    return "신청 종료일은 신청 시작일보다 빠를 수 없습니다.";
  }

  if (form.eventEndDate < form.eventStartDate) {
    return "접수 종료일은 접수 시작일보다 빠를 수 없습니다.";
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
    return "코스명을 입력해 주세요.";
  }

  for (const field of COURSE_NUMBER_FIELDS) {
    const value = Number(form[field]);

    if (!Number.isFinite(value) || value < 0) {
      return "코스 숫자 항목은 0 이상의 숫자여야 합니다.";
    }
  }

  if (
    Number(form.targetDistanceMeter) <= 0 ||
    Number(form.standardBookCount) <= 0
  ) {
    return "목표 거리와 기준 도서 수는 0보다 커야 합니다.";
  }

  if (!REWARD_TYPE_OPTIONS.some((option) => option.value === form.rewardType)) {
    return "보상 유형을 선택해 주세요.";
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
  const [editingSettings, setEditingSettings] = useState(false);
  const draggedCourse = useRef<number | null>(null);

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useAdminEventState();
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
  const [savingCourseId, setSavingCourseId] = useState<number | "new" | null>(
    null,
  );
  const [deletingCourseId, setDeletingCourseId] = useState<number | null>(null);
  const [pageError, setPageError] = useState("");
  const [courseError, setCourseError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
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
    setFeedbackMessage("");
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

      setPageError("");
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
      setCourseError("");
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

        setPageError("");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setPageError(
          getApiErrorMessage(error, "행사 목록을 불러오지 못했습니다."),
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
  }, [setSelectedEventId]);

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
          setPageError("");
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setPageError(
            getApiErrorMessage(error, "행사 상세를 불러오지 못했습니다."),
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
          setCourseError("");
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setCourseError(
            getApiErrorMessage(error, "코스 목록을 불러오지 못했습니다."),
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

    setEditingSettings(false);
    clearFeedback();
    setPageError("");
    setCourseError("");
    setIsAddingCourse(false);
    setIsEventDetailLoading(true);
    setIsCoursesLoading(true);
    setSelectedEventId(eventId);
    setIsCreatingEvent(false);
  };

  const handleCreateEventStart = () => {
    setEditingSettings(false);
    clearFeedback();
    setPageError("");
    setCourseError("");
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

    if (!isCreatingEvent) {
      const before = events.find((e) => e.eventId === selectedEventId);
      const changed = (Object.keys(eventForm) as (keyof EventForm)[]).filter(
        (key) =>
          String(before?.[key as keyof AdminEvent] ?? "") !==
          String(eventForm[key]),
      );
      const labels: Record<string, string> = {
        title: "행사명",
        roundNo: "회차",
        applicationStartDate: "신청 시작일",
        applicationEndDate: "신청 종료일",
        eventStartDate: "독서일지 접수 시작일",
        eventEndDate: "독서일지 접수 종료일",
        status: "운영 상태",
        publicVisible: "공개 여부",
        description: "설명",
        contactPhone: "문의 전화",
        contactEmail: "문의 이메일",
        kakaoOpenChatUrl: "문의 링크",
      };
      if (
        !window.confirm(
          `선택한 행사에 아래 변경사항을 저장할까요?\n${changed.map((key) => `${labels[key] ?? key}: ${String(before?.[key as keyof AdminEvent] ?? "없음")} → ${String(eventForm[key])}`).join("\n")}`,
        )
      )
        return;
    }
    setIsSavingEvent(true);
    clearFeedback();

    try {
      const request = toEventRequest(eventForm);

      if (isCreatingEvent) {
        const createdEvent = await createAdminEvent(request);

        if (!createdEvent) {
          throw new ApiError("생성된 행사 정보를 확인할 수 없습니다.", 200);
        }

        try {
          await Promise.all(
            (Object.keys(COURSE_PRESETS) as CoursePresetKey[]).map(
              (presetKey) =>
                createAdminCourse(
                  createdEvent.eventId,
                  toCourseRequest(COURSE_PRESETS[presetKey]),
                ),
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
              "행사는 생성되었지만 기본 코스 일부를 만들지 못했습니다. 생성된 코스를 확인해 주세요.",
            ),
          );
          return;
        }

        const nextEventId = await refreshEvents(createdEvent.eventId);

        if (nextEventId !== null) {
          const latestEvent = await getAdminEvent(nextEventId);
          setEventForm(toEventForm(latestEvent));
        }

        showSuccess("행사와 기본 코스 3개가 성공적으로 생성되었습니다.");
      } else if (selectedEventId !== null) {
        let updatedEvent;
        try {
          updatedEvent = await updateAdminEvent(selectedEventId, request);
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            error.code !== "EVENT_CHANGE_CONFIRMATION_REQUIRED"
          )
            throw error;
          const previous = events.find(
            (event) => event.eventId === selectedEventId,
          );
          if (
            !window.confirm(
              `참가자가 있는 행사입니다. 아래 변경은 접수와 공개 화면에 영향을 줍니다.\n신청기간: ${previous?.applicationStartDate}~${previous?.applicationEndDate} → ${request.applicationStartDate}~${request.applicationEndDate}\n독서일지 접수기간: ${previous?.eventStartDate}~${previous?.eventEndDate} → ${request.eventStartDate}~${request.eventEndDate}\n상태: ${previous?.status} → ${request.status}\n공개: ${previous?.publicVisible} → ${request.publicVisible}\n변경을 확정할까요?`,
            )
          )
            return;
          updatedEvent = await updateAdminEvent(selectedEventId, {
            ...request,
            confirmStructuralChange: true,
          });
        }
        await refreshEvents(selectedEventId);

        if (updatedEvent) {
          setEventForm(toEventForm(updatedEvent));
        } else {
          const latestEvent = await getAdminEvent(selectedEventId);
          setEventForm(toEventForm(latestEvent));
        }

        showSuccess("행사 설정이 성공적으로 저장되었습니다.");
      }
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, "행사 설정을 저장하지 못했습니다."));
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
      `“${selectedEvent?.title ?? "선택한 행사"}”를 보관하시겠습니까? 공개 화면에서 제외되며 기존 참가 기록은 유지됩니다.`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingEvent(true);
    clearFeedback();

    try {
      await deleteAdminEvent(selectedEventId, true);
      await refreshEvents();
      setCourseForms([]);
      showSuccess("행사를 보관하고 공개를 해제했습니다.");
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, "행사를 삭제하지 못했습니다."));
    } finally {
      setIsDeletingEvent(false);
    }
  };

  const moveCourse = async (courseId: number, offset: number) => {
    if (!selectedEventId || savingCourseId !== null) return;
    const index = courseForms.findIndex(
      (course) => course.courseId === courseId,
    );
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= courseForms.length) return;
    const ids = courseForms.map((course) => course.courseId);
    const [moving] = ids.splice(index, 1);
    ids.splice(nextIndex, 0, moving);
    if (
      !window.confirm(
        "코스 표시 순서를 저장할까요? 저장하지 않은 코스 입력은 유지됩니다.",
      )
    )
      return;
    setSavingCourseId(courseId);
    try {
      await reorderAdminCourses(selectedEventId, ids);
      setCourseForms((previous) =>
        ids.map((id, order) => {
          const item = previous.find((course) => course.courseId === id)!;
          return {
            ...item,
            form: { ...item.form, displayOrder: String(order + 1) },
          };
        }),
      );
      showSuccess("코스 표시 순서를 저장했습니다.");
    } catch (error) {
      showError(getApiErrorMessage(error, "순서를 저장하지 못했습니다."));
    } finally {
      setSavingCourseId(null);
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
      showSuccess("코스 설정이 저장되었습니다.");
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, "코스 설정을 저장하지 못했습니다."));
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

    setSavingCourseId("new");
    clearFeedback();

    try {
      await createAdminCourse(selectedEventId, toCourseRequest(newCourseForm));
      await refreshCourses(selectedEventId);
      setNewCourseForm(EMPTY_COURSE_FORM);
      setIsAddingCourse(false);
      showSuccess("코스가 생성되었습니다.");
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, "코스를 생성하지 못했습니다."));
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
      showSuccess("코스가 삭제되었습니다.");
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, "코스를 삭제하지 못했습니다."));
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
          onChange={(event) => updateField("name", event.target.value)}
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
              updateField("targetDistanceMeter", event.target.value)
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
              updateField("standardBookCount", event.target.value)
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
            updateField("avgMonthlyReadingCount", event.target.value)
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
          onChange={(event) => updateField("maxWinners", event.target.value)}
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
            updateField("extraLoanCount", event.target.value)
          }
        />
      </label>

      <label>
        <span>보상 유형</span>
        <select
          value={form.rewardType}
          required
          onChange={(event) => updateField("rewardType", event.target.value)}
        >
          <option value="">보상 유형 선택</option>
          {!REWARD_TYPE_OPTIONS.some(
            (option) => option.value === form.rewardType,
          ) &&
            form.rewardType && (
              <option value={form.rewardType} disabled>
                지원하지 않는 기존 값 ({form.rewardType})
              </option>
            )}
          {REWARD_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>보상 금액</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.rewardAmount}
          onChange={(event) => updateField("rewardAmount", event.target.value)}
        />
      </label>

      <label>
        <span>표시 순서</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.displayOrder}
          onChange={(event) => updateField("displayOrder", event.target.value)}
        />
      </label>
    </div>
  );

  const editingEvent =
    events.find((event) => event.eventId === selectedEventId) ?? null;

  return (
    <section
      className={`admin-page admin-event-settings ${!editingSettings && !isCreatingEvent ? "is-viewing" : ""}`}
    >
      <header className="admin-page__header admin-event-settings__header">
        <div>
          <h1>행사/코스 설정</h1>
          <p>
            조회 후 수정 버튼을 눌러 변경하세요. 신청 기간, 독서일지 접수기간
            순서로 설정합니다.
          </p>
          {!isCreatingEvent && (
            <button
              type="button"
              disabled={isSavingEvent || savingCourseId !== null}
              onClick={async () => {
                if (!editingSettings) {
                  setEditingSettings(true);
                  return;
                }
                if (!selectedEventId) return;
                if (
                  !window.confirm(
                    "조회 모드로 돌아갈까요? 저장하지 않은 입력은 취소됩니다.",
                  )
                )
                  return;
                setIsSavingEvent(true);
                try {
                  const [latest, courses] = await Promise.all([
                    getAdminEvent(selectedEventId),
                    getAdminEventCourses(selectedEventId),
                  ]);
                  setEventForm(toEventForm(latest));
                  setCourseForms(
                    courses.map((course) => ({
                      courseId: course.courseId,
                      form: toCourseForm(course),
                    })),
                  );
                  setIsAddingCourse(false);
                  setEditingSettings(false);
                } catch (error) {
                  showError(
                    getApiErrorMessage(
                      error,
                      "저장된 설정을 불러오지 못했습니다.",
                    ),
                  );
                } finally {
                  setIsSavingEvent(false);
                }
              }}
            >
              {editingSettings ? "조회 모드로 전환" : "설정 수정"}
            </button>
          )}
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
            value={selectedEventId ?? ""}
            disabled={
              isEventsLoading ||
              isCreatingEvent ||
              isSavingEvent ||
              savingCourseId !== null ||
              events.length === 0
            }
            onChange={(event) => handleEventSelection(event.target.value)}
          >
            {events.length === 0 && <option value="">등록된 행사 없음</option>}
            {events.map((event) => (
              <option key={event.eventId} value={event.eventId}>
                {event.roundNo}회 · {event.title} ·{" "}
                {EVENT_STATUS_LABELS[event.status]}
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
          className={`admin-event-settings__editing-context ${isCreatingEvent ? "is-new" : ""}`}
          aria-live="polite"
        >
          <span>
            {isCreatingEvent
              ? "새 행사 작성 중"
              : editingSettings
                ? "현재 수정 중인 행사"
                : "조회 중인 행사"}
          </span>
          <strong>
            {isCreatingEvent
              ? "아직 저장되지 않은 새 행사"
              : `${editingEvent?.roundNo}회 · ${editingEvent?.title}`}
          </strong>
          <small>
            {isCreatingEvent
              ? "저장하기 전까지 기존 행사에는 영향을 주지 않습니다."
              : `${EVENT_STATUS_LABELS[editingEvent!.status]} · 행사와 아래 코스는 모두 이 행사에만 적용됩니다.`}
          </small>
        </div>
      )}

      {pageError && (
        <p className="admin-event-settings__load-error" role="alert">
          {pageError}
        </p>
      )}

      {!editingSettings && !isCreatingEvent && editingEvent && (
        <section className="admin-event-settings__panel ux-event-overview">
          <h2>{editingEvent.title}</h2>
          <div className="race-metrics">
            <div>
              <span>신청 기간</span>
              <strong>
                {editingEvent.applicationStartDate} ~{" "}
                {editingEvent.applicationEndDate}
              </strong>
            </div>
            <div>
              <span>독서일지 접수기간</span>
              <strong>
                {editingEvent.eventStartDate} ~ {editingEvent.eventEndDate}
              </strong>
            </div>
          </div>
          <p>
            {EVENT_STATUS_LABELS[editingEvent.status]} ·{" "}
            {editingEvent.publicVisible ? "공개" : "비공개"}
          </p>
          <details>
            <summary>행사 설명 및 문의</summary>
            <p>{editingEvent.description || "등록된 설명 없음"}</p>
            <p>
              {editingEvent.contactPhone} · {editingEvent.contactEmail}
            </p>
          </details>
        </section>
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
          hidden={!editingSettings && !isCreatingEvent}
          className="admin-event-settings__form"
          noValidate
          onSubmit={handleEventSubmit}
        >
          <fieldset
            disabled={(!editingSettings && !isCreatingEvent) || isSavingEvent}
          >
            <section
              className="admin-event-settings__panel"
              aria-labelledby="eventBasicTitle"
            >
              <div className="admin-event-settings__section-heading">
                <div>
                  <h2 id="eventBasicTitle">
                    {isCreatingEvent ? "새 행사 정보" : "행사 기본 정보"}
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
                      handleEventFieldChange("title", event.target.value)
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
                      handleEventFieldChange("roundNo", event.target.value)
                    }
                  />
                </label>

                <label>
                  <span>운영 상태</span>
                  <select
                    value={eventForm.status}
                    onChange={(event) =>
                      handleEventFieldChange(
                        "status",
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
                      handleEventFieldChange(
                        "publicVisible",
                        event.target.checked,
                      )
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
                  <p>
                    참가 신청 기간 다음에 독서일지를 접수하는 기간을 설정합니다.
                  </p>
                  {events
                    .filter(
                      (e) =>
                        e.eventId !== selectedEventId &&
                        e.roundNo <
                          (editingEvent?.roundNo ?? Number(eventForm.roundNo)),
                    )
                    .sort((a, b) => b.roundNo - a.roundNo)
                    .slice(0, 1)
                    .map((e) => (
                      <p className="ux-form-note" key={e.eventId}>
                        이전 행사 참고 · {e.title}
                        <br />
                        신청 {e.applicationStartDate} ~ {e.applicationEndDate}
                        <br />
                        독서일지 접수 {e.eventStartDate} ~ {e.eventEndDate}
                      </p>
                    ))}
                </div>
                <span>필수</span>
              </div>

              <div className="admin-event-settings__period-grid">
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
                            "applicationStartDate",
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
                            "applicationEndDate",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                </fieldset>
                <fieldset className="admin-event-settings__period-group">
                  <legend>독서일지 접수기간</legend>
                  <div className="admin-event-settings__date-range">
                    <label>
                      <span>접수 시작일</span>
                      <input
                        type="date"
                        required
                        value={eventForm.eventStartDate}
                        onChange={(event) =>
                          handleEventFieldChange(
                            "eventStartDate",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <span className="admin-event-settings__range-mark">~</span>
                    <label>
                      <span>접수 종료일</span>
                      <input
                        type="date"
                        required
                        value={eventForm.eventEndDate}
                        onChange={(event) =>
                          handleEventFieldChange(
                            "eventEndDate",
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
                      handleEventFieldChange("contactPhone", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>문의 이메일</span>
                  <input
                    type="email"
                    value={eventForm.contactEmail}
                    onChange={(event) =>
                      handleEventFieldChange("contactEmail", event.target.value)
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
                        "kakaoOpenChatUrl",
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
                      handleEventFieldChange("description", event.target.value)
                    }
                  />
                </label>
              </div>
            </section>

            {isCreatingEvent && (
              <div className="admin-event-settings__default-courses-notice">
                <div>
                  <span>자동 생성</span>
                  <strong>
                    행사를 저장하면 기본 코스 3개를 함께 만듭니다.
                  </strong>
                </div>
                <ul>
                  <li>단축 코스 · 10,000m</li>
                  <li>하프 코스 · 21,100m</li>
                  <li>풀 코스 · 42,195m</li>
                </ul>
                <p>
                  생성 후 각 코스의 거리, 보상, 인원은 코스 설정에서 수정할 수
                  있습니다.
                </p>
              </div>
            )}

            <div className="admin-event-settings__form-footer">
              <div className="admin-event-settings__event-actions">
                {!isCreatingEvent && selectedEventId !== null && (
                  <button
                    type="button"
                    className="admin-event-settings__danger-button"
                    disabled={isDeletingEvent || isSavingEvent}
                    onClick={handleEventDelete}
                  >
                    {isDeletingEvent ? "보관 중…" : "행사 보관"}
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
                  ? "저장 중…"
                  : isCreatingEvent
                    ? "행사 생성"
                    : "행사 설정 저장"}
              </button>
            </div>
          </fieldset>
        </form>
      )}

      {!isCreatingEvent && selectedEventId !== null && (
        <section
          className="admin-event-settings__panel admin-event-settings__courses-panel"
          aria-labelledby="courseStandardsTitle"
        >
          <div className="admin-event-settings__section-heading">
            <div>
              <h2 id="courseStandardsTitle">
                {editingEvent?.title} 코스 기준·보상 설정
              </h2>
              <p>
                아래 변경사항은 현재 선택된 {editingEvent?.roundNo}회 행사에만
                적용됩니다.
              </p>
            </div>
            <button
              type="button"
              className="admin-event-settings__secondary-button"
              disabled={
                !editingSettings || isCoursesLoading || savingCourseId !== null
              }
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
            <>
              <div hidden={editingSettings} className="table-scroll">
                <table className="registration-table">
                  <thead>
                    <tr>
                      <th>순서</th>
                      <th>코스</th>
                      <th>목표 거리</th>
                      <th>기준 도서 수</th>
                      <th>보상</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseForms.map((c) => (
                      <tr key={c.courseId}>
                        <td>{c.form.displayOrder}</td>
                        <th>{c.form.name}</th>
                        <td>
                          {Number(c.form.targetDistanceMeter).toLocaleString()}m
                        </td>
                        <td>{c.form.standardBookCount}권</td>
                        <td>
                          {c.form.rewardType === "GIFT_CARD"
                            ? "문화상품권"
                            : "상금"}{" "}
                          {Number(c.form.rewardAmount).toLocaleString()}원
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-event-settings__course-grid">
                {courseForms.map(({ courseId, form }) => (
                  <form
                    key={courseId}
                    className="admin-event-settings__course-card"
                    draggable={editingSettings && savingCourseId === null}
                    onDragStart={() => {
                      draggedCourse.current = courseId;
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const from = draggedCourse.current;
                      draggedCourse.current = null;
                      if (from !== null && from !== courseId && editingSettings)
                        void moveCourse(
                          from,
                          courseForms.findIndex(
                            (c) => c.courseId === courseId,
                          ) - courseForms.findIndex((c) => c.courseId === from),
                        );
                    }}
                    onSubmit={(event) =>
                      handleExistingCourseSubmit(event, courseId)
                    }
                  >
                    <fieldset
                      disabled={!editingSettings || savingCourseId !== null}
                    >
                      <legend>
                        ⋮⋮ {form.name} · 표시 순서 {form.displayOrder}
                      </legend>
                      {renderCourseFields(form, (field, value) =>
                        updateCourseForm(courseId, field, value),
                      )}
                      <div className="admin-event-settings__course-actions">
                        <button
                          type="button"
                          disabled={
                            savingCourseId !== null ||
                            courseForms[0]?.courseId === courseId
                          }
                          onClick={() => void moveCourse(courseId, -1)}
                        >
                          위로 이동
                        </button>
                        <button
                          type="button"
                          disabled={
                            savingCourseId !== null ||
                            courseForms.at(-1)?.courseId === courseId
                          }
                          onClick={() => void moveCourse(courseId, 1)}
                        >
                          아래로 이동
                        </button>
                        <button
                          type="button"
                          className="admin-event-settings__danger-button"
                          disabled={
                            deletingCourseId !== null || savingCourseId !== null
                          }
                          onClick={() =>
                            handleCourseDelete(courseId, form.name)
                          }
                        >
                          {deletingCourseId === courseId ? "삭제 중…" : "삭제"}
                        </button>
                        <button
                          type="submit"
                          className="admin-event-settings__save-button"
                          disabled={
                            deletingCourseId !== null || savingCourseId !== null
                          }
                        >
                          {savingCourseId === courseId
                            ? "저장 중…"
                            : "코스 저장"}
                        </button>
                      </div>
                    </fieldset>
                  </form>
                ))}

                {isAddingCourse && (
                  <form
                    className="admin-event-settings__course-card admin-event-settings__course-card--new"
                    onSubmit={handleNewCourseSubmit}
                  >
                    <div className="admin-event-settings__preset-selector">
                      <label>
                        <span>코스 기본값</span>
                        <select
                          defaultValue="SHORT"
                          onChange={(event) => {
                            clearFeedback();
                            setNewCourseForm({
                              ...COURSE_PRESETS[
                                event.target.value as CoursePresetKey
                              ],
                            });
                          }}
                        >
                          <option value="SHORT">단축 코스 · 10,000m</option>
                          <option value="HALF">하프 코스 · 21,100m</option>
                          <option value="FULL">풀 코스 · 42,195m</option>
                        </select>
                      </label>
                      <p>
                        선택한 코스의 거리, 독서량, 보상과 인원 기본값을
                        자동으로 채웁니다.
                      </p>
                    </div>
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
                        {savingCourseId === "new" ? "생성 중…" : "코스 생성"}
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
            </>
          )}
        </section>
      )}

      <p
        className={[
          "admin-event-settings__feedback",
          feedbackIsError ? "admin-event-settings__feedback--error" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role={feedbackIsError ? "alert" : "status"}
        aria-live="polite"
      >
        {feedbackMessage}
      </p>
    </section>
  );
}

export default AdminEventSettingsPage;
