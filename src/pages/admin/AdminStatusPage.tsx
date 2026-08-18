import { useEffect, useMemo, useRef, useState } from 'react';
import { getAdminApplications } from '../../api/adminApplicationApi';
import { ApiError } from '../../api/apiClient';
import {
  getAdminEventCourses,
  getAdminEvents,
} from '../../api/adminEventApi';
import { getAdminReadingLogs } from '../../api/adminReadingLogApi';
import StatusCourseSummary from '../../components/admin/status/StatusCourseSummary';
import StatusFilters from '../../components/admin/status/StatusFilters';
import StatusPublishPanel from '../../components/admin/status/StatusPublishPanel';
import StatusSummary from '../../components/admin/status/StatusSummary';
import StatusTable from '../../components/admin/status/StatusTable';
import type { AdminApplicationListItem } from '../../types/adminApplication';
import type { AdminCourse, AdminEvent, EventStatus } from '../../types/adminEvent';
import type { AdminReadingLogResponse } from '../../types/adminReadingLogApi';
import type {
  AdminCompetitionCourseFilter,
  AdminCompetitionSortOption,
  StatusActivityFilter,
} from '../../types/adminStatus';
import {
  buildAdminCompetitionRows,
  formatStatusDate,
  getAdminCompetitionCourseSummaries,
} from '../../utils/statusAggregation';
import '../../styles/admin-status.css';

type CompetitionData = {
  applications: AdminApplicationListItem[];
  logs: AdminReadingLogResponse[];
  courses: AdminCourse[];
  fetchedAt: string;
};

const EVENT_SELECTION_ORDER: EventStatus[] = [
  'IN_PROGRESS',
  'APPLICATION_OPEN',
  'APPLICATION_CLOSED',
  'READY',
  'DRAFT',
  'ENDED',
  'FINALIZED',
  'ARCHIVED',
];

function chooseEventId(events: AdminEvent[]) {
  for (const status of EVENT_SELECTION_ORDER) {
    const event = events.find((item) => item.status === status);

    if (event) {
      return event.eventId;
    }
  }

  return events[0]?.eventId ?? null;
}

function getLocalDateValue(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function getDefaultSelectedDate(event: AdminEvent) {
  const today = getLocalDateValue();

  if (today < event.eventStartDate) {
    return event.eventStartDate;
  }

  if (today > event.eventEndDate) {
    return event.eventEndDate;
  }

  return today;
}

function getApiErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : '대회 현황 데이터를 불러오지 못했습니다.';
}

function requestCompetitionData(eventId: number) {
  return Promise.all([
    getAdminApplications(eventId),
    getAdminReadingLogs({ eventId }),
    getAdminEventCourses(eventId),
  ]).then(([applications, logs, courses]) => ({
    applications,
    logs,
    courses,
    fetchedAt: new Date().toISOString(),
  }));
}

function AdminStatusPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [competitionData, setCompetitionData] =
    useState<CompetitionData | null>(null);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [courseFilter, setCourseFilter] =
    useState<AdminCompetitionCourseFilter>('ALL');
  const [activityFilter, setActivityFilter] =
    useState<StatusActivityFilter>('ALL');
  const [sortOption, setSortOption] =
    useState<AdminCompetitionSortOption>('distance-desc');
  const initialEventsRequestRef = useRef<Promise<AdminEvent[]> | null>(null);
  const dataRequestRef = useRef<{
    eventId: number;
    promise: Promise<CompetitionData>;
  } | null>(null);
  const requestSequenceRef = useRef(0);

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
        const nextEvent =
          nextEvents.find((event) => event.eventId === nextEventId) ?? null;

        setEvents(nextEvents);
        setSelectedEventId(nextEventId);
        setSelectedDate(nextEvent ? getDefaultSelectedDate(nextEvent) : '');
        setIsDataLoading(nextEventId !== null);
        setError(
          nextEventId === null
            ? '관리할 행사가 없습니다. 행사/코스 설정에서 행사를 등록해 주세요.'
            : null,
        );
      })
      .catch((requestError: unknown) => {
        if (isActive) {
          setError(getApiErrorMessage(requestError));
        }
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
    if (selectedEventId === null) {
      return;
    }

    let isActive = true;
    const sequence = ++requestSequenceRef.current;

    if (
      dataRequestRef.current === null ||
      dataRequestRef.current.eventId !== selectedEventId
    ) {
      dataRequestRef.current = {
        eventId: selectedEventId,
        promise: requestCompetitionData(selectedEventId),
      };
    }

    const request = dataRequestRef.current;

    request.promise
      .then((data) => {
        if (isActive && requestSequenceRef.current === sequence) {
          setCompetitionData(data);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (isActive && requestSequenceRef.current === sequence) {
          setCompetitionData(null);
          setError(getApiErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (dataRequestRef.current === request) {
          dataRequestRef.current = null;
        }

        if (isActive && requestSequenceRef.current === sequence) {
          setIsDataLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedEventId]);

  const selectedEvent = useMemo(
    () =>
      events.find((event) => event.eventId === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const rows = useMemo(
    () =>
      competitionData && selectedDate
        ? buildAdminCompetitionRows(
            competitionData.applications,
            competitionData.logs,
            competitionData.courses,
            selectedDate,
          )
        : [],
    [competitionData, selectedDate],
  );
  const summary = useMemo(
    () =>
      competitionData
        ? {
            participantCount: rows.length,
            activeParticipantCount: rows.filter(
              (participant) => participant.dailyIncreasePages > 0,
            ).length,
            completedCount: null,
            newlyCompletedCount: null,
            totalPages: rows.reduce(
              (sum, participant) => sum + participant.cumulativePages,
              0,
            ),
            totalDistanceMeters: rows.reduce(
              (sum, participant) =>
                sum + participant.cumulativeDistanceMeters,
              0,
            ),
          }
        : {
            participantCount: null,
            activeParticipantCount: null,
            completedCount: null,
            newlyCompletedCount: null,
            totalPages: null,
            totalDistanceMeters: null,
          },
    [competitionData, rows],
  );
  const courseSummaries = useMemo(
    () =>
      getAdminCompetitionCourseSummaries(
        rows,
        competitionData?.courses ?? [],
      ),
    [competitionData?.courses, rows],
  );
  const filteredParticipants = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    return rows
      .filter((participant) => {
        const matchesKeyword =
          !normalizedKeyword ||
          participant.name.toLowerCase().includes(normalizedKeyword) ||
          participant.studentNumber.toLowerCase().includes(normalizedKeyword);
        const matchesCourse =
          courseFilter === 'ALL' || participant.courseId === courseFilter;
        const matchesActivity =
          activityFilter === 'ALL' ||
          (activityFilter === 'active'
            ? participant.dailyIncreasePages > 0
            : participant.dailyIncreasePages === 0);

        return matchesKeyword && matchesCourse && matchesActivity;
      })
      .sort((left, right) => {
        if (sortOption === 'pages-desc') {
          return (
            right.cumulativePages - left.cumulativePages ||
            left.name.localeCompare(right.name, 'ko-KR')
          );
        }

        if (sortOption === 'name-asc') {
          return left.name.localeCompare(right.name, 'ko-KR');
        }

        return (
          right.cumulativeDistanceMeters - left.cumulativeDistanceMeters ||
          left.name.localeCompare(right.name, 'ko-KR')
        );
      });
  }, [activityFilter, courseFilter, rows, searchKeyword, sortOption]);

  const handleEventSelection = (value: string) => {
    const eventId = Number(value);
    const nextEvent = events.find((event) => event.eventId === eventId);

    if (!nextEvent || eventId === selectedEventId) {
      return;
    }

    requestSequenceRef.current += 1;
    setCompetitionData(null);
    setIsDataLoading(true);
    setError(null);
    setFeedbackMessage('');
    setSearchKeyword('');
    setCourseFilter('ALL');
    setActivityFilter('ALL');
    setSortOption('distance-desc');
    setSelectedDate(getDefaultSelectedDate(nextEvent));
    setSelectedEventId(eventId);
  };

  const handleRefresh = async () => {
    if (selectedEventId === null || isDataLoading) {
      return;
    }

    const eventId = selectedEventId;
    const sequence = ++requestSequenceRef.current;

    setIsDataLoading(true);
    setError(null);
    setFeedbackMessage('');

    try {
      const data = await requestCompetitionData(eventId);

      if (requestSequenceRef.current !== sequence) {
        return;
      }

      setCompetitionData(data);
      setFeedbackMessage('선택한 행사의 서버 데이터를 다시 조회했습니다.');
    } catch (requestError: unknown) {
      if (requestSequenceRef.current === sequence) {
        setCompetitionData(null);
        setError(getApiErrorMessage(requestError));
      }
    } finally {
      if (requestSequenceRef.current === sequence) {
        setIsDataLoading(false);
      }
    }
  };

  const handleResetFilters = () => {
    setSearchKeyword('');
    setCourseFilter('ALL');
    setActivityFilter('ALL');
    setSortOption('distance-desc');
  };

  const eventPeriodLabel = selectedEvent
    ? `${formatStatusDate(selectedEvent.eventStartDate)} ~ ${formatStatusDate(
        selectedEvent.eventEndDate,
      )}`
    : '행사 기간 미설정';

  return (
    <section className="admin-page admin-status">
      <header className="admin-page__header admin-status__header">
        <div className="admin-status__heading">
          <h1>대회 현황 관리</h1>
          <p>
            승인된 참가자와 독서일지를 기준으로 실제 서버 현황을
            조회합니다.
          </p>
        </div>

        <div className="admin-status__header-controls">
          <div className="admin-status__date-control">
            <label htmlFor="statusEventSelect">관리 행사</label>
            <select
              id="statusEventSelect"
              value={selectedEventId ?? ''}
              disabled={isEventsLoading || events.length === 0}
              onChange={(event) => handleEventSelection(event.target.value)}
            >
              {events.length === 0 && <option value="">등록된 행사 없음</option>}
              {events.map((event) => (
                <option key={event.eventId} value={event.eventId}>
                  {event.roundNo}회 · {event.title}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-status__date-control">
            <label htmlFor="statusSelectedDate">기준 날짜</label>
            <input
              id="statusSelectedDate"
              type="date"
              min={selectedEvent?.eventStartDate}
              max={selectedEvent?.eventEndDate}
              value={selectedDate}
              disabled={!selectedEvent}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setFeedbackMessage(
                  `${formatStatusDate(event.target.value)} 기준으로 표시합니다.`,
                );
              }}
            />
            <small>행사 운영 기간 {eventPeriodLabel}</small>
          </div>
        </div>
      </header>

      <StatusSummary {...summary} />

      <aside className="admin-status__policy" aria-label="현황 집계 정책">
        <strong>집계 정책</strong>
        <span>승인 참가자만 포함</span>
        <span>승인된 독서일지만 반영</span>
        <span>서버 페이지·거리 값 사용</span>
        <span>완주·순위는 서버 판정 API 필요</span>
      </aside>

      <StatusPublishPanel
        lastCalculatedAt={competitionData?.fetchedAt ?? null}
        isRefreshing={isDataLoading}
        canRefresh={selectedEventId !== null}
        onRecalculate={handleRefresh}
      />

      <div className="admin-status__feedback" role="status" aria-live="polite">
        {feedbackMessage}
      </div>

      <StatusCourseSummary summaries={courseSummaries} />

      <div className="admin-status__section-heading admin-status__table-heading">
        <div>
          <h2>참가자별 현황</h2>
          <p>검색과 필터는 조회된 전체 행사 데이터에 적용됩니다.</p>
        </div>
      </div>

      <StatusFilters
        searchKeyword={searchKeyword}
        courseFilter={courseFilter}
        courses={competitionData?.courses ?? []}
        activityFilter={activityFilter}
        sortOption={sortOption}
        resultCount={filteredParticipants.length}
        totalCount={rows.length}
        onSearchKeywordChange={setSearchKeyword}
        onCourseFilterChange={setCourseFilter}
        onActivityFilterChange={setActivityFilter}
        onSortOptionChange={setSortOption}
        onReset={handleResetFilters}
      />

      <StatusTable
        participants={filteredParticipants}
        hasParticipants={rows.length > 0}
        isLoading={isEventsLoading || isDataLoading}
        error={error}
      />
    </section>
  );
}

export default AdminStatusPage;
