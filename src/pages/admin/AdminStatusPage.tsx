import { useMemo, useState } from 'react';
import StatusCourseSummary from '../../components/admin/status/StatusCourseSummary';
import StatusFilters from '../../components/admin/status/StatusFilters';
import StatusPreviewToggle from '../../components/admin/status/StatusPreviewToggle';
import StatusPublishConfirmDialog from '../../components/admin/status/StatusPublishConfirmDialog';
import StatusPublishPanel from '../../components/admin/status/StatusPublishPanel';
import StatusSummary from '../../components/admin/status/StatusSummary';
import StatusTable from '../../components/admin/status/StatusTable';
import {
  STATUS_PARTICIPANTS,
  STATUS_READING_LOGS,
} from '../../mocks/adminStatus';
import {
  DEFAULT_EVENT_SETTINGS,
  EVENT_SETTINGS_STORAGE_KEY,
  type EventSettings,
} from '../../types/adminEventSettings';
import type {
  StatusActivityFilter,
  StatusCompletionFilter,
  StatusCourseFilter,
  StatusDialogMode,
  StatusSortOption,
  StatusVisibilitySettings,
} from '../../types/adminStatus';
import {
  buildStatusSnapshot,
  cloneStatusSnapshot,
  formatStatusDate,
  formatStatusDateTime,
  getStatusCourseSummaries,
  hasUnpublishedChanges,
  STATUS_COURSE_ORDER,
} from '../../utils/statusAggregation';
import '../../styles/admin-status.css';

const INITIAL_VISIBILITY_SETTINGS: StatusVisibilitySettings = {
  maskNames: true,
  showRanks: true,
};

function isEventSettings(value: unknown): value is EventSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const settings = value as Partial<EventSettings>;
  const standards = settings.courseStandards;

  return (
    typeof settings.eventStartDate === 'string' &&
    typeof settings.eventEndDate === 'string' &&
    typeof settings.applyStartDate === 'string' &&
    typeof settings.applyEndDate === 'string' &&
    typeof settings.rewardStandard === 'string' &&
    Boolean(standards) &&
    typeof standards?.short === 'number' &&
    typeof standards.half === 'number' &&
    typeof standards.full === 'number'
  );
}

function readEventSettings() {
  try {
    const storedValue = window.localStorage.getItem(
      EVENT_SETTINGS_STORAGE_KEY,
    );

    if (!storedValue) {
      return DEFAULT_EVENT_SETTINGS;
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    return isEventSettings(parsedValue)
      ? parsedValue
      : DEFAULT_EVENT_SETTINGS;
  } catch {
    return DEFAULT_EVENT_SETTINGS;
  }
}

function getLocalDateValue(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
}

function getDefaultSelectedDate(settings: EventSettings) {
  const today = getLocalDateValue();
  const { eventStartDate, eventEndDate } = settings;

  if (eventStartDate && today < eventStartDate) {
    return eventStartDate;
  }

  if (eventEndDate && today > eventEndDate) {
    return eventEndDate;
  }

  return today;
}

function escapeCsvCell(value: string | number) {
  const stringValue = String(value);

  return /[",\r\n]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue;
}

function AdminStatusPage() {
  const [eventSettings] = useState(readEventSettings);
  const [selectedDate, setSelectedDate] = useState(() =>
    getDefaultSelectedDate(eventSettings),
  );
  const [publishSettings, setPublishSettings] =
    useState<StatusVisibilitySettings>(INITIAL_VISIBILITY_SETTINGS);
  const [draftSnapshot, setDraftSnapshot] = useState(() =>
    buildStatusSnapshot(
      STATUS_PARTICIPANTS,
      STATUS_READING_LOGS,
      selectedDate,
      eventSettings.courseStandards,
      INITIAL_VISIBILITY_SETTINGS,
    ),
  );
  const [publishedSnapshot, setPublishedSnapshot] =
    useState<ReturnType<typeof cloneStatusSnapshot> | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(
    null,
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewCourseFilter, setPreviewCourseFilter] =
    useState<StatusCourseFilter>('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [courseFilter, setCourseFilter] =
    useState<StatusCourseFilter>('ALL');
  const [completionFilter, setCompletionFilter] =
    useState<StatusCompletionFilter>('ALL');
  const [activityFilter, setActivityFilter] =
    useState<StatusActivityFilter>('ALL');
  const [sortOption, setSortOption] =
    useState<StatusSortOption>('course-rank');
  const [dialogMode, setDialogMode] =
    useState<StatusDialogMode>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const isLoading = false;
  const error: string | null = null;

  const summary = useMemo(() => {
    const rows = draftSnapshot.participants;
    const totalPages = rows.reduce(
      (sum, participant) => sum + participant.cumulativePages,
      0,
    );

    return {
      participantCount: rows.length,
      activeParticipantCount: rows.filter(
        (participant) => participant.dailyIncreasePages > 0,
      ).length,
      completedCount: rows.filter((participant) => participant.isCompleted)
        .length,
      newlyCompletedCount: rows.filter(
        (participant) => participant.completedAt === selectedDate,
      ).length,
      totalPages,
      totalDistanceMeters: totalPages * 5,
    };
  }, [draftSnapshot.participants, selectedDate]);

  const courseSummaries = useMemo(
    () => getStatusCourseSummaries(draftSnapshot.participants),
    [draftSnapshot.participants],
  );

  const filteredParticipants = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    return draftSnapshot.participants
      .filter((participant) => {
        const matchesKeyword =
          !normalizedKeyword ||
          participant.name.toLowerCase().includes(normalizedKeyword) ||
          participant.studentNumber
            .toLowerCase()
            .includes(normalizedKeyword);
        const matchesCourse =
          courseFilter === 'ALL' || participant.courseId === courseFilter;
        const matchesCompletion =
          completionFilter === 'ALL' ||
          (completionFilter === 'completed'
            ? participant.isCompleted
            : !participant.isCompleted);
        const matchesActivity =
          activityFilter === 'ALL' ||
          (activityFilter === 'active'
            ? participant.dailyIncreasePages > 0
            : participant.dailyIncreasePages === 0);

        return (
          matchesKeyword &&
          matchesCourse &&
          matchesCompletion &&
          matchesActivity
        );
      })
      .sort((firstParticipant, secondParticipant) => {
        if (sortOption === 'overall-rank') {
          return (
            firstParticipant.overallRank - secondParticipant.overallRank
          );
        }

        if (sortOption === 'pages-desc') {
          return (
            secondParticipant.cumulativePages -
              firstParticipant.cumulativePages ||
            firstParticipant.overallRank - secondParticipant.overallRank
          );
        }

        if (sortOption === 'name-asc') {
          return firstParticipant.name.localeCompare(
            secondParticipant.name,
            'ko-KR',
          );
        }

        return (
          STATUS_COURSE_ORDER.indexOf(firstParticipant.courseId) -
            STATUS_COURSE_ORDER.indexOf(secondParticipant.courseId) ||
          firstParticipant.courseRank - secondParticipant.courseRank
        );
      });
  }, [
    activityFilter,
    completionFilter,
    courseFilter,
    draftSnapshot.participants,
    searchKeyword,
    sortOption,
  ]);

  const draftHasUnpublishedChanges = useMemo(
    () => hasUnpublishedChanges(draftSnapshot, publishedSnapshot),
    [draftSnapshot, publishedSnapshot],
  );

  const rebuildDraft = (
    baseDate: string,
    settings: StatusVisibilitySettings,
  ) =>
    buildStatusSnapshot(
      STATUS_PARTICIPANTS,
      STATUS_READING_LOGS,
      baseDate,
      eventSettings.courseStandards,
      settings,
    );

  const handleSelectedDateChange = (value: string) => {
    if (!value) {
      return;
    }

    setSelectedDate(value);
    setDraftSnapshot(rebuildDraft(value, publishSettings));
    setFeedbackMessage(
      `${formatStatusDate(value)} 기준 현황을 집계했습니다.`,
    );
  };

  const handleSettingsChange = (
    field: keyof StatusVisibilitySettings,
    checked: boolean,
  ) => {
    const nextSettings = {
      ...publishSettings,
      [field]: checked,
    };

    setPublishSettings(nextSettings);
    setDraftSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      settings: { ...nextSettings },
    }));
    setFeedbackMessage('공개 미리보기 설정을 변경했습니다.');
  };

  const handleRecalculate = () => {
    setDraftSnapshot(rebuildDraft(selectedDate, publishSettings));
    setFeedbackMessage(
      '현재 원본 데이터로 초안을 다시 계산했습니다. 공개본은 변경되지 않았습니다.',
    );
  };

  const handleResetFilters = () => {
    setSearchKeyword('');
    setCourseFilter('ALL');
    setCompletionFilter('ALL');
    setActivityFilter('ALL');
    setSortOption('course-rank');
  };

  const handleDownload = () => {
    if (draftSnapshot.participants.length === 0) {
      return;
    }

    const headers = [
      '기준 날짜',
      '코스별 순위',
      '전체 참고 순위',
      '이름',
      '학번',
      '코스',
      '목표 페이지',
      '누적 페이지',
      '누적 거리(m)',
      '해당 날짜 증가 페이지',
      '해당 날짜 증가 거리(m)',
      '달성률(%)',
      '완주 여부',
      '완주일',
      '마지막 반영 일시',
    ];
    const rows = draftSnapshot.participants.map((participant) => [
      draftSnapshot.baseDate,
      participant.courseRank,
      participant.overallRank,
      participant.name,
      participant.studentNumber,
      participant.courseName,
      participant.targetPages,
      participant.cumulativePages,
      participant.cumulativeDistanceMeters,
      participant.dailyIncreasePages,
      participant.dailyIncreaseDistanceMeters,
      participant.progressRate.toFixed(1),
      participant.isCompleted ? '완주' : '미완주',
      participant.completedAt ?? '',
      participant.lastProgressAt
        ? formatStatusDateTime(participant.lastProgressAt)
        : '',
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\r\n');
    const downloadBlob = new Blob([`\uFEFF${csvContent}`], {
      type: 'text/csv;charset=utf-8',
    });
    const objectUrl = URL.createObjectURL(downloadBlob);
    const downloadLink = document.createElement('a');

    downloadLink.href = objectUrl;
    downloadLink.download = `독서마라톤_대회현황_${draftSnapshot.baseDate}.csv`;
    document.body.append(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(objectUrl);
    setFeedbackMessage(
      '현재 전체 초안 현황을 Excel 호환 CSV로 다운로드했습니다.',
    );
  };

  const handleConfirmDialog = () => {
    if (dialogMode === 'publish') {
      const publishedAt = new Date().toISOString();
      const nextPublishedSnapshot = cloneStatusSnapshot(
        draftSnapshot,
        `status-published-${publishedAt}`,
        publishedAt,
      );

      setPublishedSnapshot(nextPublishedSnapshot);
      setIsPublic(true);
      setLastPublishedAt(publishedAt);
      setFeedbackMessage(
        isPublic
          ? '현재 전체 초안으로 공개본을 업데이트했습니다.'
          : '현재 전체 초안으로 대회 현황을 공개했습니다.',
      );
    } else if (dialogMode === 'unpublish') {
      setIsPublic(false);
      setFeedbackMessage(
        '대회 현황을 비공개로 전환했습니다. 기존 공개본은 유지됩니다.',
      );
    }

    setDialogMode(null);
  };

  const eventPeriodLabel =
    eventSettings.eventStartDate && eventSettings.eventEndDate
      ? `${formatStatusDate(
          eventSettings.eventStartDate,
        )} ~ ${formatStatusDate(eventSettings.eventEndDate)}`
      : '행사 기간 미설정';

  return (
    <section className="admin-page admin-status">
      <header className="admin-page__header admin-status__header">
        <div className="admin-status__heading">
          <h1>대회 현황 관리</h1>
          <p>
            승인된 참가자와 독서일지를 기준으로 현황을 집계하고 사용자
            공개본을 관리합니다.
          </p>
        </div>

        <div className="admin-status__date-control">
          <label htmlFor="statusSelectedDate">기준 날짜</label>
          <input
            id="statusSelectedDate"
            type="date"
            min={eventSettings.eventStartDate || undefined}
            max={eventSettings.eventEndDate || undefined}
            value={selectedDate}
            onChange={(event) =>
              handleSelectedDateChange(event.target.value)
            }
          />
          <small>행사 운영 기간 {eventPeriodLabel}</small>
        </div>
      </header>

      <StatusSummary {...summary} />

      <aside className="admin-status__policy" aria-label="현황 집계 정책">
        <strong>집계 정책</strong>
        <span>승인 참가자만 포함</span>
        <span>승인된 독서일지만 반영</span>
        <span>1쪽 = 5m</span>
        <span>기준 날짜까지의 독서 날짜로 계산</span>
      </aside>

      <StatusPublishPanel
        isPublic={isPublic}
        hasUnpublishedChanges={draftHasUnpublishedChanges}
        settings={publishSettings}
        lastCalculatedAt={draftSnapshot.generatedAt}
        lastPublishedAt={lastPublishedAt}
        publishedSnapshot={publishedSnapshot}
        canDownload={draftSnapshot.participants.length > 0}
        onSettingsChange={handleSettingsChange}
        onRecalculate={handleRecalculate}
        onDownload={handleDownload}
        onPublish={() => setDialogMode('publish')}
        onUnpublish={() => setDialogMode('unpublish')}
      />

      <div
        className="admin-status__feedback"
        role="status"
        aria-live="polite"
      >
        {feedbackMessage}
      </div>

      <StatusPreviewToggle
        isOpen={isPreviewOpen}
        baseDate={draftSnapshot.baseDate}
        participants={draftSnapshot.participants}
        settings={publishSettings}
        isPublic={isPublic}
        hasUnpublishedChanges={draftHasUnpublishedChanges}
        courseFilter={previewCourseFilter}
        onToggle={() => setIsPreviewOpen((currentValue) => !currentValue)}
        onCourseFilterChange={setPreviewCourseFilter}
      />

      <StatusCourseSummary summaries={courseSummaries} />

      <div className="admin-status__section-heading admin-status__table-heading">
        <div>
          <h2>참가자별 현황</h2>
          <p>
            검색과 필터는 관리자 표에만 적용되며 공개본과 다운로드에는
            영향을 주지 않습니다.
          </p>
        </div>
      </div>

      <StatusFilters
        searchKeyword={searchKeyword}
        courseFilter={courseFilter}
        completionFilter={completionFilter}
        activityFilter={activityFilter}
        sortOption={sortOption}
        resultCount={filteredParticipants.length}
        totalCount={draftSnapshot.participants.length}
        onSearchKeywordChange={setSearchKeyword}
        onCourseFilterChange={setCourseFilter}
        onCompletionFilterChange={setCompletionFilter}
        onActivityFilterChange={setActivityFilter}
        onSortOptionChange={setSortOption}
        onReset={handleResetFilters}
      />

      <StatusTable
        participants={filteredParticipants}
        hasParticipants={draftSnapshot.participants.length > 0}
        isLoading={isLoading}
        error={error}
      />

      {dialogMode && (
        <StatusPublishConfirmDialog
          mode={dialogMode}
          snapshot={draftSnapshot}
          isPublic={isPublic}
          onClose={() => setDialogMode(null)}
          onConfirm={handleConfirmDialog}
        />
      )}
    </section>
  );
}

export default AdminStatusPage;
