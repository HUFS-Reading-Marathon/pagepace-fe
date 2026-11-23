import { downloadCsv } from '../../utils/csv';
import { preferredAdminEvent } from '../../utils/eventSelection';
import { useAdminEventState } from '../../hooks/useAdminEventState';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAdminParticipations, type AdminParticipation } from '../../api/adminParticipationApi';
import { getApiErrorMessage } from '../../api/apiClient';
import { getAdminEventCourses, getAdminEvents } from '../../api/adminEventApi';
import { getAdminReadingLogs } from '../../api/adminReadingLogApi';
import StatusCourseSummary from '../../components/admin/status/StatusCourseSummary';
import StatusFilters from '../../components/admin/status/StatusFilters';
import StatusPublishPanel from '../../components/admin/status/StatusPublishPanel';
import StatusTable from '../../components/admin/status/StatusTable';
import type { AdminCourse, AdminEvent, EventStatus } from '../../types/adminEvent';
import type { AdminReadingLogResponse } from '../../types/adminReadingLogApi';
import type {
  AdminCompetitionCourseFilter,
  AdminCompetitionSortOption,
  StatusActivityFilter,
} from '../../types/adminStatus';
import {
  buildAdminCompetitionRows,
  sortCompetitionStandings,
  getAdminCompetitionCourseSummaries,
} from '../../utils/statusAggregation';
import { chooseEventIdByStatus } from '../../utils/adminEvent';
import { formatKoDateKey, getLocalDateKey } from '../../utils/date';
import AdminPageTabs from '../../components/admin/AdminPageTabs';
import { COMPETITION_TABS } from '../../constants/adminNavigation';
import '../../styles/admin-status.css';

type CompetitionData = {
  participants: AdminParticipation[];
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

function getDefaultSelectedDate(event: AdminEvent) {
  const today = getLocalDateKey();

  if (today < event.eventStartDate) {
    return event.eventStartDate;
  }

  if (today > event.eventEndDate) {
    return event.eventEndDate;
  }

  return today;
}

const LOAD_ERROR_MESSAGE = '대회 현황 데이터를 불러오지 못했습니다.';

function requestCompetitionData(eventId: number) {
  return Promise.all([
    getAdminParticipations(eventId),
    getAdminReadingLogs({ eventId }),
    getAdminEventCourses(eventId),
  ]).then(([participants, logs, courses]) => ({
    participants,
    logs,
    courses,
    fetchedAt: new Date().toISOString(),
  }));
}

function AdminStatusPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useAdminEventState();
  const [selectedDate, setSelectedDate] = useState('');
  const [competitionData, setCompetitionData] = useState<CompetitionData | null>(null);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [completionFilter, setCompletionFilter] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [courseFilter, setCourseFilter] = useState<AdminCompetitionCourseFilter>('ALL');
  const [activityFilter, setActivityFilter] = useState<StatusActivityFilter>('ALL');
  const [sortOption, setSortOption] = useState<AdminCompetitionSortOption>('distance-desc');
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

        const nextEventId =
          preferredAdminEvent(nextEvents)?.eventId ??
          chooseEventIdByStatus(nextEvents, EVENT_SELECTION_ORDER);
        const nextEvent = nextEvents.find((event) => event.eventId === nextEventId) ?? null;

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
          setError(getApiErrorMessage(requestError, LOAD_ERROR_MESSAGE));
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
  }, [setSelectedEventId]);

  useEffect(() => {
    if (selectedEventId === null) {
      return;
    }

    let isActive = true;
    const sequence = ++requestSequenceRef.current;

    if (dataRequestRef.current === null || dataRequestRef.current.eventId !== selectedEventId) {
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
          setError(getApiErrorMessage(requestError, LOAD_ERROR_MESSAGE));
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
    () => events.find((event) => event.eventId === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const rows = useMemo(
    () =>
      competitionData
        ? buildAdminCompetitionRows(
            competitionData.participants,
            competitionData.logs,
            competitionData.courses,
            selectedDate,
          )
        : [],
    [competitionData, selectedDate],
  );
  const courseSummaries = useMemo(
    () => getAdminCompetitionCourseSummaries(rows, competitionData?.courses ?? []),
    [competitionData?.courses, rows],
  );
  const filteredParticipants = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    const matches = rows.filter((participant) => {
      const matchesKeyword =
        !normalizedKeyword ||
        participant.name.toLowerCase().includes(normalizedKeyword) ||
        participant.studentNumber.toLowerCase().includes(normalizedKeyword);
      const matchesCourse = courseFilter === 'ALL' || participant.courseId === courseFilter;
      const matchesActivity =
        activityFilter === 'ALL' ||
        (activityFilter === 'active'
          ? participant.dailyIncreasePages > 0
          : participant.dailyIncreasePages === 0);

      return (
        matchesKeyword &&
        matchesCourse &&
        matchesActivity &&
        (completionFilter === 'ALL' || participant.completionStatus === completionFilter)
      );
    });
    return sortCompetitionStandings(
      matches,
      sortOption,
      (row) => row.cumulativeDistanceMeters,
      (row) => row.cumulativePages,
    );
  }, [activityFilter, completionFilter, courseFilter, rows, searchKeyword, sortOption]);

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
    setCompletionFilter('ALL');
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
        setError(getApiErrorMessage(requestError, LOAD_ERROR_MESSAGE));
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
    setCompletionFilter('ALL');
    setSortOption('distance-desc');
  };

  const eventPeriodLabel = selectedEvent
    ? `${formatKoDateKey(selectedEvent.eventStartDate)} ~ ${formatKoDateKey(
        selectedEvent.eventEndDate,
      )}`
    : '행사 기간 미설정';

  return (
    <section className="admin-page admin-status">
      <header className="admin-page__header admin-status__header">
        <div className="admin-status__heading">
          <h1>대회 현황·랭킹</h1>
          <p>기준 날짜는 당일 독서량에 적용됩니다.</p>
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
                setFeedbackMessage('');
              }}
            />
            <small>행사 운영 기간 {eventPeriodLabel}</small>
          </div>
        </div>
      </header>

      <AdminPageTabs label="대회 현황·랭킹 화면" tabs={COMPETITION_TABS} />

      {competitionData && !error && <StatusCourseSummary summaries={courseSummaries} />}
      <div className="admin-status__table-toolbar">
        <h2>참가자별 현황</h2>
        <StatusPublishPanel
          lastCalculatedAt={competitionData?.fetchedAt ?? null}
          isRefreshing={isDataLoading}
          canRefresh={selectedEventId !== null}
          onRecalculate={handleRefresh}
          publicVisible={
            !!selectedEvent?.publicVisible && !['DRAFT', 'ARCHIVED'].includes(selectedEvent.status)
          }
          canExport={!!competitionData && !isDataLoading && !error}
          onExport={() =>
            downloadCsv(`event-${selectedEventId}-status.csv`, [
              [
                '순번',
                '이름',
                '학번',
                '학과',
                '코스',
                '승인 쪽수',
                '인정 거리(m)',
                '완주 상태',
                '완주일',
              ],
              ...filteredParticipants.map((p, index) => [
                index + 1,
                p.name,
                p.studentNumber,
                p.department,
                p.courseName,
                p.cumulativePages,
                p.cumulativeDistanceMeters,
                p.completionStatus === 'completed' ? '완주' : '진행 중',
                p.completedAt ?? '',
              ]),
            ])
          }
        />
      </div>

      <StatusFilters
        completionFilter={completionFilter}
        onCompletionFilterChange={setCompletionFilter}
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

      <div className="admin-status__feedback" role="status" aria-live="polite">
        {feedbackMessage}
      </div>
    </section>
  );
}

export default AdminStatusPage;
