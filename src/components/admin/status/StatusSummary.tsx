import { formatStatusDistance } from '../../../utils/statusAggregation';

type StatusSummaryProps = {
  participantCount: number;
  activeParticipantCount: number;
  completedCount: number;
  newlyCompletedCount: number;
  totalPages: number;
  totalDistanceMeters: number;
};

function StatusSummary({
  participantCount,
  activeParticipantCount,
  completedCount,
  newlyCompletedCount,
  totalPages,
  totalDistanceMeters,
}: StatusSummaryProps) {
  return (
    <dl className="admin-status__summary" aria-label="대회 현황 요약">
      <div>
        <dt>집계 참가자</dt>
        <dd>{participantCount}명</dd>
      </div>
      <div>
        <dt>당일 독서</dt>
        <dd>{activeParticipantCount}명</dd>
      </div>
      <div>
        <dt>전체 완주</dt>
        <dd>{completedCount}명</dd>
      </div>
      <div>
        <dt>신규 완주</dt>
        <dd>{newlyCompletedCount}명</dd>
      </div>
      <div>
        <dt>승인 누적</dt>
        <dd>{totalPages.toLocaleString('ko-KR')}쪽</dd>
      </div>
      <div>
        <dt>누적 거리</dt>
        <dd>{formatStatusDistance(totalDistanceMeters)}</dd>
      </div>
    </dl>
  );
}

export default StatusSummary;

