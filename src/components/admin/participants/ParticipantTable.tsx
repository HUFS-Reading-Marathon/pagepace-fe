import {
  AFFILIATION_LABELS,
  COURSE_LABELS,
  formatParticipantDate,
  type AdminParticipant,
} from '../../../types/adminParticipant';
import ParticipantStatusBadge from './ParticipantStatusBadge';

type ParticipantTableProps = {
  participants: AdminParticipant[];
  hasParticipants: boolean;
  isLoading: boolean;
  error: string | null;
  onOpenDetails: (participantId: string) => void;
  onApprove: (participantId: string) => void;
  onReject: (participantId: string) => void;
};

function ParticipantTable({
  participants,
  hasParticipants,
  isLoading,
  error,
  onOpenDetails,
  onApprove,
  onReject,
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
        참가자 목록을 불러오지 못했습니다.
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
            <tr key={participant.id}>
              <td>
                <ParticipantStatusBadge
                  status={participant.applicationStatus}
                />
              </td>
              <td className="admin-participants__name">
                {participant.name}
              </td>
              <td className="admin-participants__nowrap">
                {participant.loginId}
              </td>
              <td className="admin-participants__department">
                {participant.department}
              </td>
              <td>{AFFILIATION_LABELS[participant.affiliation]}</td>
              <td className="admin-participants__nowrap">
                {COURSE_LABELS[participant.course]}
              </td>
              <td className="admin-participants__nowrap">
                {participant.phone}
              </td>
              <td className="admin-participants__nowrap">
                {formatParticipantDate(participant.appliedAt)}
              </td>
              <td>
                <div className="admin-participants__row-actions">
                  <button
                    type="button"
                    className="admin-participants__table-button"
                    onClick={() => onOpenDetails(participant.id)}
                  >
                    상세 보기
                  </button>

                  {participant.applicationStatus === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        className="admin-participants__table-button admin-participants__table-button--approve"
                        onClick={() => onApprove(participant.id)}
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        className="admin-participants__table-button admin-participants__table-button--reject"
                        onClick={() => onReject(participant.id)}
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
