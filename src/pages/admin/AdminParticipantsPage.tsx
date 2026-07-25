import { useCallback, useMemo, useRef, useState } from 'react';
import ParticipantDetailDialog from '../../components/admin/participants/ParticipantDetailDialog';
import ParticipantFilters from '../../components/admin/participants/ParticipantFilters';
import ParticipantTable from '../../components/admin/participants/ParticipantTable';
import { ADMIN_PARTICIPANTS } from '../../mocks/adminParticipants';
import {
  COURSE_LABELS,
  PARTICIPANT_STATUS_LABELS,
  formatParticipantDateTime,
  getAffiliationDisplay,
  type AdminParticipant,
  type AdminParticipantUpdate,
  type ParticipantAffiliationFilter,
  type ParticipantCourseFilter,
  type ParticipantDialogMode,
  type ParticipantStatusFilter,
} from '../../types/adminParticipant';
import '../../styles/admin-participants.css';

type DialogRequest = {
  participantId: string;
  initialMode: ParticipantDialogMode;
};

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
  '개인정보 동의 여부',
  '반려 사유',
  '관리자 메모',
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

function AdminParticipantsPage() {
  const [participants, setParticipants] = useState<AdminParticipant[]>(() => [
    ...ADMIN_PARTICIPANTS,
  ]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<ParticipantStatusFilter>('ALL');
  const [courseFilter, setCourseFilter] =
    useState<ParticipantCourseFilter>('ALL');
  const [affiliationFilter, setAffiliationFilter] =
    useState<ParticipantAffiliationFilter>('ALL');
  const [dialogRequest, setDialogRequest] =
    useState<DialogRequest | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const dialogOpenerRef = useRef<HTMLElement | null>(null);

  const isLoading = false;
  const error: string | null = null;

  const statistics = useMemo(
    () => ({
      total: participants.length,
      pending: participants.filter(
        (participant) => participant.applicationStatus === 'PENDING',
      ).length,
      approved: participants.filter(
        (participant) => participant.applicationStatus === 'APPROVED',
      ).length,
      rejected: participants.filter(
        (participant) => participant.applicationStatus === 'REJECTED',
      ).length,
      cancelled: participants.filter(
        (participant) => participant.applicationStatus === 'CANCELLED',
      ).length,
    }),
    [participants],
  );

  const filteredParticipants = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    return participants.filter((participant) => {
      const matchesKeyword =
        !normalizedKeyword ||
        [participant.name, participant.loginId, participant.email].some(
          (value) => value.toLowerCase().includes(normalizedKeyword),
        );
      const matchesStatus =
        statusFilter === 'ALL' ||
        participant.applicationStatus === statusFilter;
      const matchesCourse =
        courseFilter === 'ALL' || participant.course === courseFilter;
      const matchesAffiliation =
        affiliationFilter === 'ALL' ||
        participant.affiliation === affiliationFilter;

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

  const selectedParticipant = dialogRequest
    ? participants.find(
        (participant) => participant.id === dialogRequest.participantId,
      )
    : undefined;

  const handleResetFilters = () => {
    setSearchKeyword('');
    setStatusFilter('ALL');
    setCourseFilter('ALL');
    setAffiliationFilter('ALL');
  };

  const handleOpenDialog = (
    participantId: string,
    initialMode: ParticipantDialogMode,
  ) => {
    dialogOpenerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDialogRequest({ participantId, initialMode });
  };

  const handleCloseDialog = useCallback(() => {
    const dialogOpener = dialogOpenerRef.current;

    setDialogRequest(null);
    window.requestAnimationFrame(() => dialogOpener?.focus());
  }, []);

  const handleApprove = (participantId: string) => {
    const participantName =
      participants.find((participant) => participant.id === participantId)
        ?.name ?? '참가자';

    setParticipants((currentParticipants) =>
      currentParticipants.map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              applicationStatus: 'APPROVED',
              rejectionReason: undefined,
            }
          : participant,
      ),
    );
    setFeedbackMessage(`${participantName}님의 참가 신청을 승인했습니다.`);
  };

  const handleReject = (participantId: string, reason: string) => {
    const participantName =
      participants.find((participant) => participant.id === participantId)
        ?.name ?? '참가자';

    setParticipants((currentParticipants) =>
      currentParticipants.map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              applicationStatus: 'REJECTED',
              rejectionReason: reason,
            }
          : participant,
      ),
    );
    setFeedbackMessage(`${participantName}님의 참가 신청을 반려했습니다.`);
  };

  const handleUpdate = (
    participantId: string,
    updates: AdminParticipantUpdate,
  ) => {
    const participantName =
      participants.find((participant) => participant.id === participantId)
        ?.name ?? '참가자';
    const isCourseOnlyUpdate =
      Object.keys(updates).length === 1 && updates.course !== undefined;

    setParticipants((currentParticipants) =>
      currentParticipants.map((participant) =>
        participant.id === participantId
          ? { ...participant, ...updates }
          : participant,
      ),
    );
    setFeedbackMessage(
      isCourseOnlyUpdate
        ? `${participantName}님의 참가 코스를 변경했습니다.`
        : `${participantName}님의 정보를 수정했습니다.`,
    );
  };

  const handleCancelParticipation = (participantId: string) => {
    const participantName =
      participants.find((participant) => participant.id === participantId)
        ?.name ?? '참가자';

    setParticipants((currentParticipants) =>
      currentParticipants.map((participant) =>
        participant.id === participantId
          ? { ...participant, applicationStatus: 'CANCELLED' }
          : participant,
      ),
    );
    setFeedbackMessage(`${participantName}님의 참가를 취소했습니다.`);
  };

  const handleDownload = () => {
    if (filteredParticipants.length === 0) {
      return;
    }

    const rows = filteredParticipants.map((participant) => [
      PARTICIPANT_STATUS_LABELS[participant.applicationStatus],
      participant.name,
      participant.loginId,
      participant.department,
      getAffiliationDisplay(participant.affiliation, participant.grade),
      participant.phone,
      participant.email,
      COURSE_LABELS[participant.course],
      formatParticipantDateTime(participant.appliedAt),
      participant.privacyAgreed ? '동의' : '미동의',
      participant.rejectionReason ?? '',
      participant.adminMemo ?? '',
    ]);
    const csv = [CSV_HEADERS, ...rows]
      .map((row) => row.map(escapeCsvValue).join(','))
      .join('\r\n');

    // 별도 xlsx 라이브러리 없이 Excel에서 열 수 있는 UTF-8 BOM CSV를 생성한다.
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
            aria-pressed={statusFilter === 'PENDING'}
            onClick={() => setStatusFilter('PENDING')}
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
        role="status"
        aria-live="polite"
      >
        {feedbackMessage}
      </div>

      <ParticipantTable
        participants={filteredParticipants}
        hasParticipants={participants.length > 0}
        isLoading={isLoading}
        error={error}
        onOpenDetails={(participantId) =>
          handleOpenDialog(participantId, 'view')
        }
        onApprove={handleApprove}
        onReject={(participantId) => handleOpenDialog(participantId, 'reject')}
      />

      {selectedParticipant && dialogRequest && (
        <ParticipantDetailDialog
          participant={selectedParticipant}
          initialMode={dialogRequest.initialMode}
          onClose={handleCloseDialog}
          onApprove={handleApprove}
          onReject={handleReject}
          onUpdate={handleUpdate}
          onCancelParticipation={handleCancelParticipation}
        />
      )}
    </section>
  );
}

export default AdminParticipantsPage;
