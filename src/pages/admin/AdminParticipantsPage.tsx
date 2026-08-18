import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  approveAdminApplication,
  getAdminApplicationDetail,
  getAdminApplications,
} from '../../api/adminApplicationApi';
import { ApiError } from '../../api/apiClient';
import { getCurrentEvent } from '../../api/eventApi';
import ParticipantDetailDialog from '../../components/admin/participants/ParticipantDetailDialog';
import ParticipantFilters from '../../components/admin/participants/ParticipantFilters';
import ParticipantTable from '../../components/admin/participants/ParticipantTable';
import {
  ADMIN_APPLICATION_AFFILIATION_LABELS,
  ADMIN_APPLICATION_STATUS_LABELS,
  formatAdminApplicationDateTime,
  type AdminApplicationAffiliationType,
  type AdminApplicationDetail,
  type AdminApplicationListItem,
  type ParticipantAffiliationFilter,
  type ParticipantCourseFilter,
  type ParticipantStatusFilter,
} from '../../types/adminApplication';
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

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function getLocalDateStamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function AdminParticipantsPage() {
  const [participants, setParticipants] = useState<
    AdminApplicationListItem[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEventId, setCurrentEventId] = useState<number | null>(null);
  const initialListRequestRef = useRef<
    Promise<{
      eventId: number;
      applications: AdminApplicationListItem[];
    }> | null
  >(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<ParticipantStatusFilter>('ALL');
  const [courseFilter, setCourseFilter] =
    useState<ParticipantCourseFilter>('ALL');
  const [affiliationFilter, setAffiliationFilter] =
    useState<ParticipantAffiliationFilter>('ALL');
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    number | null
  >(null);
  const [detailApplication, setDetailApplication] =
    useState<AdminApplicationDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailActionError, setDetailActionError] = useState<string | null>(
    null,
  );
  const detailRequestSequenceRef = useRef(0);
  const [processingApplicationId, setProcessingApplicationId] = useState<
    number | null
  >(null);
  const processingApplicationIdRef = useRef<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const dialogOpenerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let isActive = true;

    if (initialListRequestRef.current === null) {
      initialListRequestRef.current = (async () => {
        const currentEvent = await getCurrentEvent();
        const applications = await getAdminApplications(currentEvent.eventId);

        return {
          eventId: currentEvent.eventId,
          applications,
        };
      })();
    }

    initialListRequestRef.current
      .then(({ eventId, applications }) => {
        if (!isActive) {
          return;
        }

        setCurrentEventId(eventId);
        setParticipants(applications);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!isActive) {
          return;
        }

        setCurrentEventId(null);
        setParticipants([]);
        setError(
          getApiErrorMessage(
            requestError,
            '참가신청 목록을 불러오지 못했습니다.',
          ),
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const statistics = useMemo(
    () => ({
      total: participants.length,
      pending: participants.filter(
        (participant) => participant.status === 'APPLIED',
      ).length,
      approved: participants.filter(
        (participant) => participant.status === 'APPROVED',
      ).length,
      rejected: participants.filter(
        (participant) => participant.status === 'REJECTED',
      ).length,
      cancelled: participants.filter(
        (participant) => participant.status === 'CANCELLED',
      ).length,
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
      [
        ...new Set(
          participants.map((participant) => participant.affiliationType),
        ),
      ].sort((first, second) =>
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
        [participant.name, participant.studentNo, participant.email].some(
          (value) => value.toLowerCase().includes(normalizedKeyword),
        );
      const matchesStatus =
        statusFilter === 'ALL' || participant.status === statusFilter;
      const matchesCourse =
        courseFilter === 'ALL' || participant.courseName === courseFilter;
      const matchesAffiliation =
        affiliationFilter === 'ALL' ||
        participant.affiliationType === affiliationFilter;

      return (
        matchesKeyword &&
        matchesStatus &&
        matchesCourse &&
        matchesAffiliation
      );
    });
  }, [
    affiliationFilter,
    courseFilter,
    participants,
    searchKeyword,
    statusFilter,
  ]);

  const selectedListApplication =
    selectedApplicationId === null
      ? undefined
      : participants.find(
          (participant) =>
            participant.applicationId === selectedApplicationId,
        );

  const handleResetFilters = () => {
    setSearchKeyword('');
    setStatusFilter('ALL');
    setCourseFilter('ALL');
    setAffiliationFilter('ALL');
  };

  const handleOpenDialog = async (applicationId: number) => {
    const requestSequence = detailRequestSequenceRef.current + 1;
    detailRequestSequenceRef.current = requestSequence;
    dialogOpenerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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
        setDetailError(
          getApiErrorMessage(
            requestError,
            '참가신청 상세를 불러오지 못했습니다.',
          ),
        );
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
      participants.find(
        (participant) => participant.applicationId === applicationId,
      )?.name ?? '참가자';

    processingApplicationIdRef.current = applicationId;
    setProcessingApplicationId(applicationId);
    setFeedbackMessage('');
    setFeedbackIsError(false);
    setDetailActionError(null);

    try {
      await approveAdminApplication(applicationId);
    } catch (requestError) {
      const message = getApiErrorMessage(
        requestError,
        '참가 신청을 승인하지 못했습니다.',
      );

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
          const nextDetailApplication =
            await getAdminApplicationDetail(applicationId);

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

      setFeedbackMessage(
        `${participantName}님의 참가 신청을 승인했습니다.`,
      );
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
      ADMIN_APPLICATION_STATUS_LABELS[participant.status] ??
        participant.status,
      participant.name,
      participant.studentNo,
      participant.department,
      ADMIN_APPLICATION_AFFILIATION_LABELS[participant.affiliationType] ??
        participant.affiliationType,
      participant.phone,
      participant.email,
      participant.courseName,
      formatAdminApplicationDateTime(participant.appliedAt),
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
    anchor.download = `독서마라톤_참가자목록_${getLocalDateStamp(new Date())}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    setFeedbackIsError(false);
    setFeedbackMessage(
      `현재 검색 결과 ${filteredParticipants.length}명의 목록을 다운로드했습니다.`,
    );
  };

  return (
    <section className="admin-page admin-participants">
      <header className="admin-page__header admin-participants__header">
        <div>
          <h1>참가자 관리</h1>
          <p>
            독서마라톤 참가 신청자를 확인하고 승인 상태와 참가 정보를
            관리합니다.
          </p>
        </div>

        <div
          className="admin-participants__summary"
          aria-label="참가 신청 현황"
        >
          <button
            type="button"
            aria-pressed={statusFilter === 'ALL'}
            onClick={() => setStatusFilter('ALL')}
          >
            <span>전체</span>
            <strong>{statistics.total}</strong>
          </button>
          <button
            type="button"
            aria-pressed={statusFilter === 'APPLIED'}
            onClick={() => setStatusFilter('APPLIED')}
          >
            <span>승인 대기</span>
            <strong>{statistics.pending}</strong>
          </button>
          <button
            type="button"
            aria-pressed={statusFilter === 'APPROVED'}
            onClick={() => setStatusFilter('APPROVED')}
          >
            <span>승인</span>
            <strong>{statistics.approved}</strong>
          </button>
          <button
            type="button"
            aria-pressed={statusFilter === 'REJECTED'}
            onClick={() => setStatusFilter('REJECTED')}
          >
            <span>반려</span>
            <strong>{statistics.rejected}</strong>
          </button>
          <button
            type="button"
            aria-pressed={statusFilter === 'CANCELLED'}
            onClick={() => setStatusFilter('CANCELLED')}
          >
            <span>참가 취소</span>
            <strong>{statistics.cancelled}</strong>
          </button>
        </div>
      </header>

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
        onOpenDetails={handleOpenDialog}
        onApprove={handleApprove}
      />

      {selectedListApplication && selectedApplicationId !== null && (
        <ParticipantDetailDialog
          application={detailApplication}
          fallbackApplication={selectedListApplication}
          isLoading={isDetailLoading}
          error={detailError}
          actionError={detailActionError}
          isProcessing={
            processingApplicationId === selectedApplicationId
          }
          onClose={handleCloseDialog}
          onApprove={handleApprove}
        />
      )}
    </section>
  );
}

export default AdminParticipantsPage;
