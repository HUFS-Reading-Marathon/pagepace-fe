import type { AdminCompetitionParticipantRow } from '../../../types/adminStatus';
import { formatStatusDistance } from '../../../utils/statusAggregation';
import { formatKoDateKey } from '../../../utils/date';

type StatusTableProps = {
  participants: AdminCompetitionParticipantRow[];
  hasParticipants: boolean;
  isLoading: boolean;
  error: string | null;
};

function StatusTable({
  participants,
  hasParticipants,
  isLoading,
  error,
}: StatusTableProps) {
  if (isLoading) {
    return (
      <div className="admin-status__empty" role="status">
        대회 현황을 집계하는 중입니다.
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-status__empty" role="alert">
        {error}
      </div>
    );
  }

  if (!hasParticipants) {
    return (
      <div className="admin-status__empty">집계할 참가자가 없습니다.</div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="admin-status__empty">
        조건에 맞는 참가자가 없습니다.
      </div>
    );
  }

  return (
    <div className="admin-status__table-wrapper">
      <table className="admin-status__table">
        <caption className="sr-only">관리자용 참가자별 대회 현황</caption>
        <thead>
          <tr>
            <th scope="col">소속</th>
            <th scope="col">승인 일지</th>
            <th scope="col">이름</th>
            <th scope="col">학번</th>
            <th scope="col">코스</th>
            <th scope="col">누적 페이지</th>
            <th scope="col">누적 거리</th>
            <th scope="col">전날 대비</th>
            <th scope="col">달성률</th>
            <th scope="col">완주 여부</th>
            <th scope="col">완주일</th>
            <th scope="col">마지막 반영</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((participant) => (
            <tr key={participant.applicationId}>
              <td>{participant.department || '—'}</td>
              <td className="admin-status__number">
                {participant.approvedLogCount}건
              </td>
              <td className="admin-status__name">{participant.name}</td>
              <td className="admin-status__nowrap">
                {participant.studentNumber}
              </td>
              <td className="admin-status__nowrap">
                {participant.courseName}
              </td>
              <td className="admin-status__number">
                {participant.cumulativePages.toLocaleString('ko-KR')}쪽
              </td>
              <td className="admin-status__nowrap">
                {formatStatusDistance(
                  participant.cumulativeDistanceMeters,
                )}
              </td>
              <td className="admin-status__increase">
                {participant.dailyIncreasePages > 0
                  ? `+${participant.dailyIncreasePages.toLocaleString(
                      'ko-KR',
                    )}쪽`
                  : '—'}
              </td>
              <td className="admin-status__nowrap">
                {participant.progressRate === null
                  ? '—'
                  : `${participant.progressRate.toFixed(1)}%`}
              </td>
              <td>
                <span className="admin-status__completion admin-status__completion--progress">
                  판정 미지원
                </span>
              </td>
              <td className="admin-status__nowrap">
                —
              </td>
              <td className="admin-status__last-progress">
                {participant.lastReadingDate
                  ? formatKoDateKey(participant.lastReadingDate)
                  : '승인 기록 없음'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StatusTable;

