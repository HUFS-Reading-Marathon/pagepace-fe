import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  approveAdminApplication,
  getAdminApplicationDetail,
  getAdminApplications,
  rejectAdminApplication,
} from '../../api/adminApplicationApi';
import { getApiErrorMessage } from '../../api/apiClient';
import { getAdminEvents } from '../../api/adminEventApi';
import { preferredAdminEvent } from '../../utils/eventSelection';
import { useAdminEventState } from '../../hooks/useAdminEventState';
import type { AdminEvent } from '../../types/adminEvent';
import ParticipantRegistration from '../../components/admin/participants/ParticipantRegistration';
import ParticipantDetailDialog from '../../components/admin/participants/ParticipantDetailDialog';
import ParticipantFilters from '../../components/admin/participants/ParticipantFilters';
import ParticipantTable from '../../components/admin/participants/ParticipantTable';
import {
  ADMIN_APPLICATION_AFFILIATION_LABELS,
  ADMIN_APPLICATION_STATUS_LABELS,
  type AdminApplicationAffiliationType,
  type AdminApplicationDetail,
  type AdminApplicationListItem,
  type ParticipantAffiliationFilter,
  type ParticipantCourseFilter,
  type ParticipantStatusFilter,
} from '../../types/adminApplication';
import { formatKoDateTime, getLocalDateKey } from '../../utils/date';
import '../../styles/admin-participants.css';

const CSV_HEADERS = [
  '신청 상태',
  '이름',
  '학번/사번',
  '소속',
  '신분',
  '연락처',
  '이메일',
  '선택 코스',
  '신청일',
];

/** 참가 신청서를 승인 대기·승인·반려·취소 상태로 구분해 보여 주는 탭(직접 등록 참가자는 위 목록에서 관리) */
const STATUS_TABS: ReadonlyArray<{
  value: ParticipantStatusFilter;
  label: string;
  countKey: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'total';
}> = [
  { value: 'APPLIED', label: '승인 대기 신청서', countKey: 'pending' },
  { value: 'APPROVED', label: '승인된 신청서', countKey: 'approved' },
  { value: 'REJECTED', label: '반려', countKey: 'rejected' },
  { value: 'CANCELLED', label: '참가 취소', countKey: 'cancelled' },
  { value: 'ALL', label: '전체 신청', countKey: 'total' },
];

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function AdminParticipantsPage() {
  const [participants, setParticipants] = useState<AdminApplicationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEventId, setCurrentEventId] = useAdminEventState();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchParams] = useSearchParams();
  // 오늘의 업무에서 ?status=APPLIED로 들어오면 승인 대기 신청서부터 보여 줍니다.
  const [statusFilter, setStatusFilter] = useState<ParticipantStatusFilter>(() =>
    searchParams.get('status') === 'APPLIED' ? 'APPLIED' : 'ALL',
  );
  const [courseFilter, setCourseFilter] = useState<ParticipantCourseFilter>('ALL');
  const [affiliationFilter, setAffiliationFilter] = useState<ParticipantAffiliationFilter>('ALL');
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);
  const [detailApplication, setDetailApplication] = useState<AdminApplicationDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailActionError, setDetailActionError] = useState<string | null>(null);
  const detailRequestSequenceRef = useRef(0);
  const [processingApplicationId, setProcessingApplicationId] = useState<number | null>(null);
  const processingApplicationIdRef = useRef<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const dialogOpenerRef = useRef<HTMLElement | null>(null);
  const [dialogStartsRejecting, setDialogStartsRejecting] = useState(false);

  useEffect(() => {
    let active = true;
    getAdminEvents()
      .then((next) => {
        if (active) {
          setEvents(next);
          setCurrentEventId(preferredAdminEvent(next)?.eventId ?? null);
          if (!next.length) setIsLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setError(error.message);
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [setCurrentEventId]);
  useEffect(() => {
    if (currentEventId === null) return;
    let active = true;
    getAdminApplications(currentEventId)
      .then((next) => {
        if (active) {
          setParticipants(next);
          setError(null);
        }
      })
      .catch((error) => {
        if (active) {
          setParticipants([]);
          setError(error.message);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentEventId]);

  const statistics = useMemo(
    () => ({
      total: participants.length,
      pending: participants.filter((participant) => participant.status === 'APPLIED').length,
      approved: participants.filter((participant) => participant.status === 'APPROVED').length,
      rejected: participants.filter((participant) => participant.status === 'REJECTED').length,
      cancelled: participants.filter((participant) => participant.status === 'CANCELLED').length,
    }),
    [participants],
  );

  const courseOptions = useMemo(
    () =>
      [...new Set(participants.map((participant) => participant.courseName))]
        .filter(Boolean)
        .sort((first, second) => first.localeCompare(second, 'ko')),
    [participants],
  );

  const affiliationOptions = useMemo(
    () =>
      [...new Set(participants.map((participant) => participant.affiliationType))].sort(
        (first, second) =>
          ADMIN_APPLICATION_AFFILIATION_LABELS[first].localeCompare(
            ADMIN_APPLICATION_AFFILIATION_LABELS[second],
            'ko',
          ),
      ) as AdminApplicationAffiliationType[],
    [participants],
  );

  const filteredParticipants = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    return participants.filter((participant) => {
      const matchesKeyword =
        !normalizedKeyword ||
        [participant.name, participant.studentNo, participant.email].some((value) =>
          value?.toLowerCase().includes(normalizedKeyword),
        );
      const matchesStatus = statusFilter === 'ALL' || participant.status === statusFilter;
      const matchesCourse = courseFilter === 'ALL' || participant.courseName === courseFilter;
      const matchesAffiliation =
        affiliationFilter === 'ALL' || participant.affiliationType === affiliationFilter;

      return matchesKeyword && matchesStatus && matchesCourse && matchesAffiliation;
    });
  }, [affiliationFilter, courseFilter, participants, searchKeyword, statusFilter]);

  const selectedListApplication =
    selectedApplicationId === null
      ? undefined
      : participants.find((participant) => participant.applicationId === selectedApplicationId);

  const handleResetFilters = () => {
    setSearchKeyword('');
    setStatusFilter('ALL');
    setCourseFilter('ALL');
    setAffiliationFilter('ALL');
  };

  const handleOpenDialog = (applicationId: number, startRejecting = false) => {
    dialogOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDialogStartsRejecting(startRejecting);
    void showApplication(applicationId);
  };

  /** 상세 시트에 신청서를 표시합니다. 시트 안에서 이전·다음으로 이동할 때도 사용합니다. */
  const showApplication = async (applicationId: number) => {
    const requestSequence = detailRequestSequenceRef.current + 1;
    detailRequestSequenceRef.current = requestSequence;
    setSelectedApplicationId(applicationId);
    setDetailApplication(null);
    setDetailError(null);
    setDetailActionError(null);
    setIsDetailLoading(true);

    try {
      const application = await getAdminApplicationDetail(applicationId);

      if (detailRequestSequenceRef.current === requestSequence) {
        setDetailApplication(application);
      }
    } catch (requestError) {
      if (detailRequestSequenceRef.current === requestSequence) {
        setDetailError(getApiErrorMessage(requestError, '참가신청 상세를 불러오지 못했습니다.'));
      }
    } finally {
      if (detailRequestSequenceRef.current === requestSequence) {
        setIsDetailLoading(false);
      }
    }
  };

  const handleCloseDialog = useCallback(() => {
    const dialogOpener = dialogOpenerRef.current;

    detailRequestSequenceRef.current += 1;
    setSelectedApplicationId(null);
    setDetailApplication(null);
    setDetailError(null);
    setDetailActionError(null);
    setIsDetailLoading(false);
    window.requestAnimationFrame(() => dialogOpener?.focus());
  }, []);

  const handleApprove = async (applicationId: number) => {
    if (processingApplicationIdRef.current !== null) {
      return;
    }

    if (currentEventId === null) {
      setFeedbackMessage('현재 관리할 행사 정보를 확인할 수 없습니다.');
      setFeedbackIsError(true);
      return;
    }

    const participantName =
      participants.find((participant) => participant.applicationId === applicationId)?.name ??
      '참가자';

    processingApplicationIdRef.current = applicationId;
    setProcessingApplicationId(applicationId);
    setFeedbackMessage('');
    setFeedbackIsError(false);
    setDetailActionError(null);

    try {
      await approveAdminApplication(applicationId);
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, '참가 신청을 승인하지 못했습니다.');

      setFeedbackMessage(message);
      setFeedbackIsError(true);

      if (selectedApplicationId === applicationId) {
        setDetailActionError(message);
      }

      processingApplicationIdRef.current = null;
      setProcessingApplicationId(null);
      return;
    }

    try {
      const nextParticipants = await getAdminApplications(currentEventId);

      setParticipants(nextParticipants);
      setError(null);

      if (selectedApplicationId === applicationId) {
        try {
          const nextDetailApplication = await getAdminApplicationDetail(applicationId);

          setDetailApplication(nextDetailApplication);
          setDetailError(null);
        } catch (detailRequestError) {
          setDetailError(
            getApiErrorMessage(
              detailRequestError,
              '승인은 완료됐지만 상세 정보를 다시 불러오지 못했습니다.',
            ),
          );
        }
      }

      setFeedbackMessage(`${participantName}님의 참가 신청을 승인했습니다.`);
    } catch (refreshError) {
      const message = getApiErrorMessage(
        refreshError,
        '승인은 완료됐지만 목록을 다시 불러오지 못했습니다.',
      );

      setFeedbackMessage(message);
      setFeedbackIsError(true);
      setError(message);

      if (selectedApplicationId === applicationId) {
        setDetailActionError(message);
      }
    } finally {
      processingApplicationIdRef.current = null;
      setProcessingApplicationId(null);
    }
  };

  const handleDownload = () => {
    if (filteredParticipants.length === 0) {
      return;
    }

    const rows = filteredParticipants.map((participant) => [
      ADMIN_APPLICATION_STATUS_LABELS[participant.status] ?? participant.status,
      participant.name,
      participant.studentNo,
      participant.department ?? '',
      ADMIN_APPLICATION_AFFILIATION_LABELS[participant.affiliationType] ??
        participant.affiliationType,
      participant.phone,
      participant.email,
      participant.courseName,
      formatKoDateTime(participant.appliedAt),
    ]);
    const csv = [CSV_HEADERS, ...rows]
      .map((row) => row.map((value) => escapeCsvValue(value ?? '')).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8',
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = objectUrl;
    anchor.download = `독서마라톤_참가자목록_${getLocalDateKey()}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    setFeedbackIsError(false);
    setFeedbackMessage(
      `현재 검색 결과 ${filteredParticipants.length}명의 목록을 다운로드했습니다.`,
    );
  };

  const handleReject = async (applicationId: number, reason: string) => {
    if (processingApplicationIdRef.current !== null || currentEventId === null || !reason.trim()) {
      return false;
    }

    processingApplicationIdRef.current = applicationId;
    setProcessingApplicationId(applicationId);
    setFeedbackMessage('');
    setFeedbackIsError(false);
    setDetailActionError(null);

    try {
      await rejectAdminApplication(applicationId, reason);
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, '참가 신청을 반려하지 못했습니다.');
      setFeedbackMessage(message);
      setFeedbackIsError(true);
      setDetailActionError(message);
      processingApplicationIdRef.current = null;
      setProcessingApplicationId(null);
      return false;
    }

    try {
      setParticipants(await getAdminApplications(currentEventId));
      setDetailApplication(await getAdminApplicationDetail(applicationId));
      setFeedbackMessage('참가 신청을 반려했습니다.');
    } catch (refreshError) {
      const message = getApiErrorMessage(
        refreshError,
        '반려는 완료됐지만 목록을 다시 불러오지 못했습니다.',
      );
      setFeedbackMessage(message);
      setFeedbackIsError(true);
    } finally {
      processingApplicationIdRef.current = null;
      setProcessingApplicationId(null);
    }

    return true;
  };

  const selectedIndex = filteredParticipants.findIndex(
    (participant) => participant.applicationId === selectedApplicationId,
  );

  return (
    <section className="admin-page admin-participants">
      <header className="admin-page__header admin-participants__header">
        <div>
          <h1>참가자 관리</h1>
          <p>
            참가 신청서를 검수하고, 승인 참가자 확인과 직접 등록을 관리합니다. 신청서 상태와 실제
            참가자 목록(직접 등록 포함)은 구분해 표시합니다.
          </p>
        </div>
      </header>

      <label>
        관리할 행사{' '}
        <select
          aria-label="관리할 행사"
          value={currentEventId ?? ''}
          disabled={processingApplicationId !== null}
          onChange={(e) => {
            handleCloseDialog();
            setParticipants([]);
            setIsLoading(true);
            setCurrentEventId(Number(e.target.value));
          }}
        >
          {events.map((event) => (
            <option key={event.eventId} value={event.eventId}>
              {event.title}
            </option>
          ))}
        </select>
      </label>
      {currentEventId !== null && (
        <ParticipantRegistration
          key={`${currentEventId}-${statistics.approved}`}
          eventId={currentEventId}
        />
      )}
      <h2>참가 신청서</h2>
      <div className="admin-participants__tabs">
        <div className="admin-segmented" aria-label="신청 상태별 보기">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={statusFilter === tab.value}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
              <b>{statistics[tab.countKey]}</b>
            </button>
          ))}
        </div>
      </div>

      <ParticipantFilters
        searchKeyword={searchKeyword}
        statusFilter={statusFilter}
        courseFilter={courseFilter}
        affiliationFilter={affiliationFilter}
        courseOptions={courseOptions}
        affiliationOptions={affiliationOptions}
        resultCount={filteredParticipants.length}
        onSearchKeywordChange={setSearchKeyword}
        onStatusFilterChange={setStatusFilter}
        onCourseFilterChange={setCourseFilter}
        onAffiliationFilterChange={setAffiliationFilter}
        onReset={handleResetFilters}
        onDownload={handleDownload}
      />

      <div
        className="admin-participants__feedback"
        role={feedbackIsError ? 'alert' : 'status'}
        aria-live="polite"
      >
        {feedbackMessage}
      </div>

      <ParticipantTable
        participants={filteredParticipants}
        hasParticipants={participants.length > 0}
        isLoading={isLoading}
        error={error}
        processingApplicationId={processingApplicationId}
        onOpenDetails={(applicationId) => handleOpenDialog(applicationId)}
        onApprove={handleApprove}
        onRejectStart={(applicationId) => handleOpenDialog(applicationId, true)}
      />

      {selectedListApplication && selectedApplicationId !== null && (
        <ParticipantDetailDialog
          key={selectedApplicationId}
          position={{
            index: Math.max(selectedIndex, 0),
            total: Math.max(filteredParticipants.length, 1),
          }}
          initialRejecting={dialogStartsRejecting}
          onPrevious={
            selectedIndex > 0
              ? () => {
                  setDialogStartsRejecting(false);
                  void showApplication(filteredParticipants[selectedIndex - 1].applicationId);
                }
              : undefined
          }
          onNext={
            selectedIndex >= 0 && selectedIndex < filteredParticipants.length - 1
              ? () => {
                  setDialogStartsRejecting(false);
                  void showApplication(filteredParticipants[selectedIndex + 1].applicationId);
                }
              : undefined
          }
          application={detailApplication}
          fallbackApplication={selectedListApplication}
          isLoading={isDetailLoading}
          error={detailError}
          actionError={detailActionError}
          isProcessing={processingApplicationId === selectedApplicationId}
          onClose={handleCloseDialog}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </section>
  );
}

export default AdminParticipantsPage;
