import type { ParticipantStatusRow } from '../../../types/adminStatus';
import {
  formatStatusDate,
  formatStatusDateTime,
  formatStatusDistance,
} from '../../../utils/statusAggregation';

type StatusTableProps = {
  participants: ParticipantStatusRow[];
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
        대회 현황을 불러오지 못했습니다.
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
            <th scope="col">코스 순위</th>
            <th scope="col">전체 순위</th>
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
            <tr key={participant.participantId}>
              <td className="admin-status__rank">
                {participant.courseRank}위
              </td>
              <td className="admin-status__rank">
                {participant.overallRank}위
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
                {participant.progressRate.toFixed(1)}%
              </td>
              <td>
                {participant.isCompleted ? (
                  <span className="admin-status__completion admin-status__completion--complete">
                    완주
                    {participant.courseId === 'full' && (
                      <small>FULL</small>
                    )}
                  </span>
                ) : (
                  <span className="admin-status__completion admin-status__completion--progress">
                    진행 중
                  </span>
                )}
              </td>
              <td className="admin-status__nowrap">
                {participant.completedAt
                  ? formatStatusDate(participant.completedAt)
                  : '—'}
              </td>
              <td className="admin-status__last-progress">
                {participant.lastProgressAt
                  ? formatStatusDateTime(participant.lastProgressAt)
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

