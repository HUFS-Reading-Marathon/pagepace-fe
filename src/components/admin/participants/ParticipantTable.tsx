import {
  ADMIN_APPLICATION_AFFILIATION_LABELS,
  formatAdminApplicationDate,
  type AdminApplicationListItem,
} from '../../../types/adminApplication';
import ParticipantStatusBadge from './ParticipantStatusBadge';

type ParticipantTableProps = {
  participants: AdminApplicationListItem[];
  hasParticipants: boolean;
  isLoading: boolean;
  error: string | null;
  processingApplicationId: number | null;
  onOpenDetails: (applicationId: number) => void;
  onApprove: (applicationId: number) => void;
};

function ParticipantTable({
  participants,
  hasParticipants,
  isLoading,
  error,
  processingApplicationId,
  onOpenDetails,
  onApprove,
}: ParticipantTableProps) {
  if (isLoading) {
    return (
      <div className="admin-participants__empty" role="status">
        참가자 목록을 불러오는 중입니다.
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-participants__empty" role="alert">
        {error}
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="admin-participants__empty">
        {hasParticipants
          ? '조건에 맞는 참가자가 없습니다.'
          : '등록된 참가 신청이 없습니다.'}
      </div>
    );
  }

  return (
    <div className="admin-participants__table-wrapper">
      <table className="admin-participants__table">
        <caption className="sr-only">독서마라톤 참가 신청자 목록</caption>
        <thead>
          <tr>
            <th scope="col">신청 상태</th>
            <th scope="col">이름</th>
            <th scope="col">학번/사번</th>
            <th scope="col">소속</th>
            <th scope="col">신분</th>
            <th scope="col">선택 코스</th>
            <th scope="col">연락처</th>
            <th scope="col">신청일</th>
            <th scope="col">관리</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((participant) => (
            <tr key={participant.applicationId}>
              <td>
                <ParticipantStatusBadge status={participant.status} />
              </td>
              <td className="admin-participants__name">
                {participant.name}
              </td>
              <td className="admin-participants__nowrap">
                {participant.studentNo || '-'}
              </td>
              <td className="admin-participants__department">
                {participant.department || '-'}
              </td>
              <td>
                {ADMIN_APPLICATION_AFFILIATION_LABELS[
                  participant.affiliationType
                ] ?? participant.affiliationType}
              </td>
              <td className="admin-participants__nowrap">
                {participant.courseName || '-'}
              </td>
              <td className="admin-participants__nowrap">
                {participant.phone || '-'}
              </td>
              <td className="admin-participants__nowrap">
                {formatAdminApplicationDate(participant.appliedAt)}
              </td>
              <td>
                <div className="admin-participants__row-actions">
                  <button
                    type="button"
                    className="admin-participants__table-button"
                    onClick={() =>
                      onOpenDetails(participant.applicationId)
                    }
                  >
                    상세 보기
                  </button>

                  {participant.status === 'APPLIED' && (
                    <>
                      <button
                        type="button"
                        className="admin-participants__table-button admin-participants__table-button--approve"
                        onClick={() =>
                          onApprove(participant.applicationId)
                        }
                        disabled={
                          processingApplicationId ===
                          participant.applicationId
                        }
                      >
                        {processingApplicationId === participant.applicationId
                          ? '처리 중...'
                          : '승인'}
                      </button>
                      <button
                        type="button"
                        className="admin-participants__table-button admin-participants__table-button--reject"
                        disabled
                        title="백엔드 반려 API 확인이 필요합니다."
                      >
                        반려
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ParticipantTable;
