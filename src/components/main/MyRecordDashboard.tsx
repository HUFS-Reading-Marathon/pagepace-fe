import { Link } from 'react-router-dom';
import type { MyRecordSummary } from '../../pages/main/mainPageContent';
import { formatDistance, getProgressRate } from '../../utils/reading';

type MyRecordDashboardProps = {
  record: MyRecordSummary;
};

/** 로그인 사용자의 메인 화면 우측 "나의 기록" 카드 */
function MyRecordDashboard({ record }: MyRecordDashboardProps) {
  const progressRate = getProgressRate(record.totalDistance, record.targetDistance);

  return (
    <div className="my-record-dashboard">
      <div className="my-record-dashboard-head">
        <div>
          <span>My Record</span>
          <h2>나의 기록</h2>
        </div>
        <b>{record.course}</b>
      </div>

      <div className="my-record-main">
        <span>누적 독서 거리</span>
        <strong>{formatDistance(record.totalDistance)}</strong>
        <p>
          목표 거리 {formatDistance(record.targetDistance)} 중{' '}
          {progressRate}% 달성했습니다.
        </p>
      </div>

      <div className="my-record-progress">
        <div className="my-record-progress-top">
          <span>달성률</span>
          <b>{progressRate}%</b>
        </div>
        <div
          className="my-record-progress-track"
          aria-label={`목표 달성률 ${progressRate}%`}
        >
          <span style={{ width: `${progressRate}%` }} />
        </div>
      </div>

      <dl className="my-record-meta">
        <div>
          <dt>인정 페이지</dt>
          <dd>{record.totalPages.toLocaleString()}쪽</dd>
        </div>
        <div>
          <dt>독서일지</dt>
          <dd>{record.approvedLogs}건</dd>
        </div>
        <div>
          <dt>최근 제출</dt>
          <dd>{record.lastSubmittedAt}</dd>
        </div>
      </dl>

      <div className="my-record-dashboard-actions">
        <Link to="/my">나의 전체 기록 보기</Link>
      </div>
    </div>
  );
}

export default MyRecordDashboard;
