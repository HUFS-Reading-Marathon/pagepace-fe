import { type FormEvent, useMemo, useState } from 'react';
import {
  DEFAULT_EVENT_SETTINGS,
  EVENT_SETTINGS_STORAGE_KEY,
  type EventSettings,
} from '../../types/adminEventSettings';
import '../../styles/admin-event-settings.css';

type CourseKey = keyof EventSettings['courseStandards'];
type DateField =
  | 'eventStartDate'
  | 'eventEndDate'
  | 'applyStartDate'
  | 'applyEndDate';
type EventSettingsField = DateField | CourseKey;

type EventSettingsForm = Omit<EventSettings, 'courseStandards'> & {
  courseStandards: Record<CourseKey, string>;
};

type ValidationError = {
  message: string;
  fields: EventSettingsField[];
};

const COURSE_FIELDS: ReadonlyArray<{
  key: CourseKey;
  label: string;
  description: string;
}> = [
  {
    key: 'short',
    label: '단축코스 목표',
    description: '현재 공개 기준 10,000m',
  },
  {
    key: 'half',
    label: '하프코스 목표',
    description: '현재 공개 기준 21,100m',
  },
  {
    key: 'full',
    label: '풀코스 목표',
    description: '현재 공개 기준 42,195m',
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStoredEventSettings(value: unknown): value is EventSettings {
  if (!isRecord(value) || !isRecord(value.courseStandards)) {
    return false;
  }

  return (
    typeof value.eventStartDate === 'string' &&
    typeof value.eventEndDate === 'string' &&
    typeof value.applyStartDate === 'string' &&
    typeof value.applyEndDate === 'string' &&
    typeof value.rewardStandard === 'string' &&
    typeof value.courseStandards.short === 'number' &&
    Number.isFinite(value.courseStandards.short) &&
    typeof value.courseStandards.half === 'number' &&
    Number.isFinite(value.courseStandards.half) &&
    typeof value.courseStandards.full === 'number' &&
    Number.isFinite(value.courseStandards.full)
  );
}

function loadEventSettings(): EventSettings {
  try {
    const storedValue = window.localStorage.getItem(
      EVENT_SETTINGS_STORAGE_KEY,
    );

    if (!storedValue) {
      return DEFAULT_EVENT_SETTINGS;
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    return isStoredEventSettings(parsedValue)
      ? parsedValue
      : DEFAULT_EVENT_SETTINGS;
  } catch {
    return DEFAULT_EVENT_SETTINGS;
  }
}

function toFormState(settings: EventSettings): EventSettingsForm {
  return {
    eventStartDate: settings.eventStartDate,
    eventEndDate: settings.eventEndDate,
    applyStartDate: settings.applyStartDate,
    applyEndDate: settings.applyEndDate,
    courseStandards: {
      short: String(settings.courseStandards.short),
      half: String(settings.courseStandards.half),
      full: String(settings.courseStandards.full),
    },
    rewardStandard: settings.rewardStandard,
  };
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

  return Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
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

function validateSettings(form: EventSettingsForm): ValidationError | null {
  const dateFields: DateField[] = [
    'eventStartDate',
    'eventEndDate',
    'applyStartDate',
    'applyEndDate',
  ];
  const emptyDateFields = dateFields.filter((field) => !form[field]);

  if (emptyDateFields.length > 0) {
    return {
      message: '행사 기간과 신청 기간의 날짜를 모두 입력해 주세요.',
      fields: emptyDateFields,
    };
  }

  const emptyCourseFields = COURSE_FIELDS.map(({ key }) => key).filter(
    (key) => !form.courseStandards[key].trim(),
  );

  if (emptyCourseFields.length > 0) {
    return {
      message: '단축·하프·풀코스 목표값을 모두 입력해 주세요.',
      fields: emptyCourseFields,
    };
  }

  const invalidCourseFields = COURSE_FIELDS.map(({ key }) => key).filter(
    (key) => {
      const value = Number(form.courseStandards[key]);

      return !Number.isFinite(value) || value <= 0;
    },
  );

  if (invalidCourseFields.length > 0) {
    return {
      message: '코스 목표값은 모두 0보다 큰 숫자여야 합니다.',
      fields: invalidCourseFields,
    };
  }

  if (form.eventEndDate < form.eventStartDate) {
    return {
      message: '행사 종료일은 행사 시작일보다 빠를 수 없습니다.',
      fields: ['eventStartDate', 'eventEndDate'],
    };
  }

  if (form.applyEndDate < form.applyStartDate) {
    return {
      message: '신청 종료일은 신청 시작일보다 빠를 수 없습니다.',
      fields: ['applyStartDate', 'applyEndDate'],
    };
  }

  return null;
}

function AdminEventSettingsPage() {
  const [form, setForm] = useState<EventSettingsForm>(() =>
    toFormState(loadEventSettings()),
  );
  const [validationError, setValidationError] =
    useState<ValidationError | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const eventCountdown = useMemo(
    () => getEventCountdown(form.eventStartDate, form.eventEndDate),
    [form.eventEndDate, form.eventStartDate],
  );

  const clearMessages = () => {
    setValidationError(null);
    setFeedbackMessage('');
  };

  const handleDateChange = (field: DateField, value: string) => {
    clearMessages();
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const handleCourseChange = (course: CourseKey, value: string) => {
    clearMessages();
    setForm((currentForm) => ({
      ...currentForm,
      courseStandards: {
        ...currentForm.courseStandards,
        [course]: value,
      },
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValidationError = validateSettings(form);

    if (nextValidationError) {
      setValidationError(nextValidationError);
      setFeedbackMessage('');
      return;
    }

    const nextSettings: EventSettings = {
      eventStartDate: form.eventStartDate,
      eventEndDate: form.eventEndDate,
      applyStartDate: form.applyStartDate,
      applyEndDate: form.applyEndDate,
      courseStandards: {
        short: Number(form.courseStandards.short),
        half: Number(form.courseStandards.half),
        full: Number(form.courseStandards.full),
      },
      rewardStandard: form.rewardStandard.trim(),
    };

    try {
      window.localStorage.setItem(
        EVENT_SETTINGS_STORAGE_KEY,
        JSON.stringify(nextSettings),
      );
      setForm(toFormState(nextSettings));
      setValidationError(null);
      setFeedbackMessage('설정이 성공적으로 저장되었습니다.');
    } catch {
      setValidationError({
        message:
          '브라우저 저장소에 설정을 저장하지 못했습니다. 저장 공간과 브라우저 설정을 확인해 주세요.',
        fields: [],
      });
      setFeedbackMessage('');
    }
  };

  const hasFieldError = (field: EventSettingsField) =>
    validationError?.fields.includes(field) ?? false;

  return (
    <section className="admin-page admin-event-settings">
      <header className="admin-page__header admin-event-settings__header">
        <div>
          <h1>행사/코스 설정</h1>
          <p>행사 기간, 신청 기간, 코스 기준, 보상 기준을 설정합니다.</p>
        </div>

        <div
          className="admin-event-settings__countdown"
          aria-live="polite"
        >
          <span>행사 시작까지</span>
          <strong>{eventCountdown}</strong>
          <small>{formatDateLabel(form.eventStartDate)}</small>
        </div>
      </header>

      <form
        className="admin-event-settings__form"
        noValidate
        onSubmit={handleSubmit}
      >
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
                    value={form.eventStartDate}
                    aria-invalid={hasFieldError('eventStartDate')}
                    aria-describedby={
                      hasFieldError('eventStartDate')
                        ? 'eventSettingsError'
                        : undefined
                    }
                    onChange={(event) =>
                      handleDateChange(
                        'eventStartDate',
                        event.target.value,
                      )
                    }
                  />
                </label>
                <span
                  className="admin-event-settings__range-mark"
                  aria-hidden="true"
                >
                  ~
                </span>
                <label>
                  <span>행사 종료일</span>
                  <input
                    type="date"
                    required
                    value={form.eventEndDate}
                    aria-invalid={hasFieldError('eventEndDate')}
                    aria-describedby={
                      hasFieldError('eventEndDate')
                        ? 'eventSettingsError'
                        : undefined
                    }
                    onChange={(event) =>
                      handleDateChange('eventEndDate', event.target.value)
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
                    value={form.applyStartDate}
                    aria-invalid={hasFieldError('applyStartDate')}
                    aria-describedby={
                      hasFieldError('applyStartDate')
                        ? 'eventSettingsError'
                        : undefined
                    }
                    onChange={(event) =>
                      handleDateChange(
                        'applyStartDate',
                        event.target.value,
                      )
                    }
                  />
                </label>
                <span
                  className="admin-event-settings__range-mark"
                  aria-hidden="true"
                >
                  ~
                </span>
                <label>
                  <span>신청 종료일</span>
                  <input
                    type="date"
                    required
                    value={form.applyEndDate}
                    aria-invalid={hasFieldError('applyEndDate')}
                    aria-describedby={
                      hasFieldError('applyEndDate')
                        ? 'eventSettingsError'
                        : undefined
                    }
                    onChange={(event) =>
                      handleDateChange('applyEndDate', event.target.value)
                    }
                  />
                </label>
              </div>
            </fieldset>
          </div>
        </section>

        <section
          className="admin-event-settings__panel"
          aria-labelledby="courseStandardsTitle"
        >
          <div className="admin-event-settings__section-heading">
            <div>
              <h2 id="courseStandardsTitle">코스 기준 설정</h2>
              <p>완주 판정에 사용할 코스별 목표 독서 페이지를 설정합니다.</p>
            </div>
            <span>필수</span>
          </div>

          <div className="admin-event-settings__course-grid">
            {COURSE_FIELDS.map((course) => (
              <label
                key={course.key}
                className="admin-event-settings__course-field"
              >
                <span>{course.label}</span>
                <small>{course.description}</small>
                <div className="admin-event-settings__number-control">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    inputMode="numeric"
                    value={form.courseStandards[course.key]}
                    aria-invalid={hasFieldError(course.key)}
                    aria-describedby={
                      hasFieldError(course.key)
                        ? 'eventSettingsError'
                        : undefined
                    }
                    onChange={(event) =>
                      handleCourseChange(course.key, event.target.value)
                    }
                  />
                  <span>쪽</span>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section
          className="admin-event-settings__panel"
          aria-labelledby="rewardStandardTitle"
        >
          <div className="admin-event-settings__section-heading">
            <div>
              <h2 id="rewardStandardTitle">보상 기준 설정</h2>
              <p>수료증 발급과 코스 완주 보상에 관한 안내를 입력합니다.</p>
            </div>
            <span className="admin-event-settings__optional">선택</span>
          </div>

          <label className="admin-event-settings__reward-field">
            <span>수료증·보상 안내</span>
            <textarea
              rows={5}
              maxLength={500}
              value={form.rewardStandard}
              placeholder="예: 코스 목표를 달성한 참가자에게 수료증을 발급합니다."
              onChange={(event) => {
                clearMessages();
                setForm((currentForm) => ({
                  ...currentForm,
                  rewardStandard: event.target.value,
                }));
              }}
            />
            <small>{form.rewardStandard.length}/500자</small>
          </label>
        </section>

        <div className="admin-event-settings__form-footer">
          <div className="admin-event-settings__messages">
            {validationError && (
              <p
                id="eventSettingsError"
                className="admin-event-settings__error"
                role="alert"
              >
                {validationError.message}
              </p>
            )}
            <p
              className="admin-event-settings__feedback"
              role="status"
              aria-live="polite"
            >
              {feedbackMessage}
            </p>
          </div>

          <button
            type="submit"
            className="admin-event-settings__save-button"
          >
            설정 저장
          </button>
        </div>
      </form>
    </section>
  );
}

export default AdminEventSettingsPage;
